
import {
  DataRow,
  PivotConfig,
  PivotResult,
  PivotRowHeader,
  PivotColumnHeader,
  PivotDataCell,
  AggregationType,
  PivotValueFieldConfig,
  PivotOptions,
  CalculatedMeasureConfig
} from '../types';
import * as XLSX from 'xlsx';

// Helper to get a unique key for a set of field values
const getFieldValuesKey = (
  dataRow: DataRow,
  fields: string[]
): string => {
  return fields.map(field => dataRow[field] ?? 'null').join('|-|');
};

export const DUMMY_COLUMN_KEY_FOR_VALUES_ONLY = '__pivot_values_only__';

const aggregateValues = (
  dataRows: DataRow[],
  valueConfigs: PivotValueFieldConfig[]
): PivotDataCell => {
  const result: PivotDataCell = {};

  valueConfigs.forEach(vc => {
    const key = `${vc.field} (${vc.aggregation})`;
    const values = dataRows
      .map(row => parseFloat(String(row[vc.field])))
      .filter(val => !isNaN(val));

    if (values.length === 0 && vc.aggregation !== AggregationType.COUNT && vc.aggregation !== AggregationType.COUNT_NON_EMPTY && vc.aggregation !== AggregationType.UNIQUE_COUNT) {
      result[key] = null;
      return;
    }
    
    const rawValues = dataRows.map(row => row[vc.field]);

    switch (vc.aggregation) {
      case AggregationType.SUM:
        result[key] = values.reduce((sum, val) => sum + val, 0);
        break;
      case AggregationType.AVERAGE:
        result[key] = values.length > 0 ? values.reduce((sum, val) => sum + val, 0) / values.length : null;
        break;
      case AggregationType.COUNT:
        result[key] = dataRows.length;
        break;
      case AggregationType.COUNT_NON_EMPTY:
         result[key] = rawValues.filter(val => val !== null && val !== undefined && String(val).trim() !== '').length;
        break;
      case AggregationType.MIN:
        result[key] = values.length > 0 ? Math.min(...values) : null;
        break;
      case AggregationType.MAX:
        result[key] = values.length > 0 ? Math.max(...values) : null;
        break;
      case AggregationType.UNIQUE_COUNT:
        result[key] = new Set(rawValues.filter(val => val !== null && val !== undefined).map(String)).size;
        break;
      case AggregationType.STDEV:
        if (values.length < 2) { result[key] = null; break; }
        const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
        // Using (values.length - 1) for sample standard deviation if length > 1, else use values.length to avoid division by zero.
        const varianceDenominator = values.length > 1 ? values.length -1 : values.length;
        const variance = varianceDenominator > 0 ? values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / varianceDenominator : 0;
        result[key] = Math.sqrt(variance);
        break;
      default:
        result[key] = null;
    }
    if (typeof result[key] === 'number') {
        result[key] = parseFloat((result[key] as number).toFixed(2));
    }
  });
  return result;
};

// Builds a hierarchical tree of headers.
const buildHeaderTreeRecursive = (
  data: DataRow[],
  fields: string[],
  parentKey: string = '',
  level: number = 0,
  parentOriginalValues: Record<string, any> = {}
): any[] => { // Can be PivotRowHeader[] or PivotColumnHeader[]
  if (fields.length === 0) {
    return [];
  }

  const currentField = fields[0];
  const remainingFields = fields.slice(1);
  const grouped = new Map<string | number | boolean | null, DataRow[]>();

  data.forEach(row => {
    const value = row[currentField];
    if (!grouped.has(value)) {
      grouped.set(value, []);
    }
    grouped.get(value)!.push(row);
  });

  const headers: any[] = [];
  grouped.forEach((rowsInGroup, value) => {
    const label = String(value ?? 'N/A');
    // currentOriginalValues accumulates criteria from ancestors + current level
    const currentOriginalValues = { ...parentOriginalValues, [currentField]: value };
    // Key is based on the full path of original values for uniqueness at this level
    const key = Object.entries(currentOriginalValues).map(([k,v]) => `${k}:${String(v)}`).sort().join('|-|');


    const headerNode: any = {
      key,
      label,
      level,
      originalValues: { ...currentOriginalValues }, // Ensure originalValues is a copy
      children: buildHeaderTreeRecursive(rowsInGroup, remainingFields, key, level + 1, currentOriginalValues),
    };
    headers.push(headerNode);
  });
  
  // Sort headers by label for consistent order
  headers.sort((a,b) => String(a.label).localeCompare(String(b.label)));
  return headers;
};

const evaluateCalculatedMeasure = (
    formula: string,
    baseAggregatedValues: PivotDataCell, // Values from `aggregateValues` for the current cell
    allValueConfigs: PivotValueFieldConfig[] // All original value field configurations
): number | null => {
    let formulaToEvaluate = formula;

    // Replace tokens like `[SUM(Sales)]` with their numeric values
    allValueConfigs.forEach(vc => {
        const token = `[${vc.aggregation.toUpperCase()}(${vc.field})]`;
        // The key in baseAggregatedValues already includes aggregation type
        const valueKey = `${vc.field} (${vc.aggregation})`;
        const value = baseAggregatedValues[valueKey];
        
        // Regex to match token, case-insensitive for aggregation part
        // e.g., [SUM(Sales)], [sum(Sales)], [Sum(Sales)]
        const tokenRegex = new RegExp(`\\[${vc.aggregation.toUpperCase()}\\(${vc.field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\)\\]`, 'gi');
        
        if (value !== undefined && value !== null && !isNaN(Number(value))) {
            formulaToEvaluate = formulaToEvaluate.replace(tokenRegex, String(value));
        } else {
            // If a referenced value is null/undefined, replace with 0 or handle as error
            formulaToEvaluate = formulaToEvaluate.replace(tokenRegex, '0'); 
        }
    });
    
    // Ensure no unreplaced tokens remain (which would cause evaluation errors)
    // This regex looks for any remaining bracketed tokens like `[Anything]`
    if (/\[.*?\]/.test(formulaToEvaluate)) {
        console.warn(`Formula still contains unreplaced tokens: ${formulaToEvaluate}. Original: ${formula}`);
        return null; // Or handle as an error
    }

    try {
        // Use Function constructor for safer evaluation
        const func = new Function('return ' + formulaToEvaluate);
        const result = func();
        return (typeof result === 'number' && !isNaN(result)) ? parseFloat(result.toFixed(2)) : null;
    } catch (e) {
        console.error("Error evaluating calculated measure formula:", e, "Processed Formula:", formulaToEvaluate, "Original Base Values:", baseAggregatedValues);
        return null;
    }
};


export const generatePivotData = (
  sourceData: DataRow[],
  config: PivotConfig,
  options: PivotOptions
): PivotResult | null => {
  if (!sourceData || sourceData.length === 0) return null;

  // 1. Apply Pre-Pivot Filters
  let filteredData = [...sourceData];
  config.filters.forEach(filter => {
    if (filter.selectedValues.length > 0) {
      filteredData = filteredData.filter(row =>
        filter.selectedValues.includes(String(row[filter.field]))
      );
    }
  });

  // If filters result in no data, return structure with empty data but potentially headers
  if (filteredData.length === 0 && sourceData.length > 0) {
    const rowDimFieldsForEmpty = config.rows.map(r => r.field);
    const colDimFieldsForEmpty = config.columns.map(c => c.field);
    // Use original sourceData to derive headers if filteredData is empty
    const rawRowHierarchyEmpty = buildHeaderTreeRecursive(sourceData, rowDimFieldsForEmpty);
    const rawColHierarchyEmpty = colDimFieldsForEmpty.length > 0 ? buildHeaderTreeRecursive(sourceData, colDimFieldsForEmpty) : [];
    
    return {
        rowHeadersTree: rawRowHierarchyEmpty,
        columnHeadersTree: rawColHierarchyEmpty,
        dataMatrix: new Map(),
        allRowKeys: rawRowHierarchyEmpty.flatMap(node => [node.key, ...(node.children?.flatMap(child => child.key) || [])]),
        allColumnKeys: rawColHierarchyEmpty.flatMap(node => [node.key, ...(node.children?.flatMap(child => child.key) || [])]),
      };
  }
  if (filteredData.length === 0) return null; // No source data and no filtered data.

  // 2. Build Raw Hierarchies for Rows and Columns
  const rowDimFields = config.rows.map(r => r.field);
  const colDimFields = config.columns.map(c => c.field);

  const rawRowHierarchy = buildHeaderTreeRecursive(filteredData, rowDimFields);
  const rawColHierarchy = colDimFields.length > 0
    ? buildHeaderTreeRecursive(filteredData, colDimFields)
    : [];

  const dataMatrix = new Map<string, Map<string, PivotDataCell>>();

  // Helper to get all leaf nodes from a hierarchy tree
  const getTreeLeafNodes = (nodes: Array<PivotRowHeader | PivotColumnHeader>): Array<PivotRowHeader | PivotColumnHeader> => {
    const leaves: Array<PivotRowHeader | PivotColumnHeader> = [];
    nodes.forEach(node => {
      if (!node.children || node.children.length === 0) {
        leaves.push(node);
      } else {
        leaves.push(...getTreeLeafNodes(node.children));
      }
    });
    return leaves;
  };

  // 3. Populate dataMatrix for Leaf-Level Cells (Including Calculated Measures)
  const rowLeafNodes = getTreeLeafNodes(rawRowHierarchy);
  const colLeafNodes = colDimFields.length > 0 
    ? getTreeLeafNodes(rawColHierarchy) 
    : [{ key: DUMMY_COLUMN_KEY_FOR_VALUES_ONLY, label: 'Values', level:0, originalValues: {} } as PivotColumnHeader];

  rowLeafNodes.forEach(rNode => {
    if (!dataMatrix.has(rNode.key)) dataMatrix.set(rNode.key, new Map());
    colLeafNodes.forEach(cNode => {
      const relevantData = filteredData.filter(dataRow => {
        const rowMatch = Object.entries(rNode.originalValues!).every(([field, val]) => String(dataRow[field] ?? 'N/A') === String(val ?? 'N/A'));
        const colMatch = (cNode.key === DUMMY_COLUMN_KEY_FOR_VALUES_ONLY) || Object.entries(cNode.originalValues!).every(([field, val]) => String(dataRow[field] ?? 'N/A') === String(val ?? 'N/A'));
        return rowMatch && colMatch;
      });
      
      let cellValues = aggregateValues(relevantData, config.values);
      
      // Calculate calculated measures
      if (config.calculatedMeasures && config.calculatedMeasures.length > 0) {
        config.calculatedMeasures.forEach(calcMeasure => {
            cellValues[calcMeasure.name] = evaluateCalculatedMeasure(calcMeasure.formula, cellValues, config.values);
        });
      }
      dataMatrix.get(rNode.key)!.set(cNode.key, cellValues);
    });
  });

  // 4. Prepare Final Header Lists and Calculate Totals (Including Calculated Measures)
  const finalRowHeadersTree: PivotRowHeader[] = [];
  const allRowKeysSet = new Set<string>();
  const finalColumnHeadersTree: PivotColumnHeader[] = [];
  const allColKeysSet = new Set<string>();

  function processHierarchyForTotalsAndFlatten(
    nodes: Array<PivotRowHeader | PivotColumnHeader>,
    isRowDimension: boolean,
    finalHeaderList: Array<PivotRowHeader | PivotColumnHeader>,
    allKeysAccumulator: Set<string>,
    showSubtotalsOption: boolean
  ) {
    nodes.forEach(node => {
      finalHeaderList.push(node); 
      allKeysAccumulator.add(node.key);

      if (node.children && node.children.length > 0) {
        processHierarchyForTotalsAndFlatten(node.children, isRowDimension, finalHeaderList, allKeysAccumulator, showSubtotalsOption);

        const groupAggregateDataKey = `${node.key}|-|SUBTOTAL`; 

        if (isRowDimension) { 
            if (!dataMatrix.has(groupAggregateDataKey)) dataMatrix.set(groupAggregateDataKey, new Map());
            const effectiveColLeafNodes = rawColHierarchy.length > 0 ? getTreeLeafNodes(rawColHierarchy) : [{ key: DUMMY_COLUMN_KEY_FOR_VALUES_ONLY, label: 'Values', level:0, originalValues: {} } as PivotColumnHeader];
            effectiveColLeafNodes.forEach(cLeafNode => {
                 const relevantData = filteredData.filter(dataRow => {
                    const groupMatch = Object.entries(node.originalValues!).every(([f, v]) => String(dataRow[f] ?? 'N/A') === String(v ?? 'N/A'));
                    const colMatch = (cLeafNode.key === DUMMY_COLUMN_KEY_FOR_VALUES_ONLY) || Object.entries(cLeafNode.originalValues!).every(([f, v]) => String(dataRow[f] ?? 'N/A') === String(v ?? 'N/A'));
                    return groupMatch && colMatch;
                });
                let subtotalCellValues = aggregateValues(relevantData, config.values);
                if (config.calculatedMeasures && config.calculatedMeasures.length > 0) {
                    config.calculatedMeasures.forEach(calcMeasure => {
                        subtotalCellValues[calcMeasure.name] = evaluateCalculatedMeasure(calcMeasure.formula, subtotalCellValues, config.values);
                    });
                }
                dataMatrix.get(groupAggregateDataKey)!.set(cLeafNode.key, subtotalCellValues);
            });
        } else { 
            getTreeLeafNodes(rawRowHierarchy).forEach(rLeafNode => {
              const relevantData = filteredData.filter(dataRow => {
                const groupMatch = Object.entries(node.originalValues!).every(([f, v]) => String(dataRow[f] ?? 'N/A') === String(v ?? 'N/A'));
                const rowMatch = Object.entries(rLeafNode.originalValues!).every(([f, v]) => String(dataRow[f] ?? 'N/A') === String(v ?? 'N/A'));
                return groupMatch && rowMatch;
              });
              const cellMap = dataMatrix.get(rLeafNode.key) ?? new Map<string, PivotDataCell>();
              let subtotalCellValues = aggregateValues(relevantData, config.values);
              if (config.calculatedMeasures && config.calculatedMeasures.length > 0) {
                  config.calculatedMeasures.forEach(calcMeasure => {
                      subtotalCellValues[calcMeasure.name] = evaluateCalculatedMeasure(calcMeasure.formula, subtotalCellValues, config.values);
                  });
              }
              cellMap.set(groupAggregateDataKey, subtotalCellValues);
              dataMatrix.set(rLeafNode.key, cellMap);
            });
        }
        
        if (showSubtotalsOption) {
          finalHeaderList.push({
            key: groupAggregateDataKey,
            label: `Subtotal ${node.label}`,
            level: node.level,
            isSubtotal: true,
            originalValues: { ...node.originalValues } 
          } as PivotRowHeader | PivotColumnHeader);
          allKeysAccumulator.add(groupAggregateDataKey);
        }
      }
    });
  }

  processHierarchyForTotalsAndFlatten(rawRowHierarchy, true, finalRowHeadersTree, allRowKeysSet, options.showRowSubtotals);
  if (colDimFields.length > 0) {
    processHierarchyForTotalsAndFlatten(rawColHierarchy, false, finalColumnHeadersTree, allColKeysSet, options.showColumnSubtotals);
  } else if (config.values.length > 0 || (config.calculatedMeasures && config.calculatedMeasures.length > 0)) { 
    allColKeysSet.add(DUMMY_COLUMN_KEY_FOR_VALUES_ONLY);
    if (!finalColumnHeadersTree.find(h => h.key === DUMMY_COLUMN_KEY_FOR_VALUES_ONLY)){
        finalColumnHeadersTree.push({ key: DUMMY_COLUMN_KEY_FOR_VALUES_ONLY, label: 'Values', level: 0, originalValues: {} } as PivotColumnHeader);
    }
  }

  // 5. Row Grand Total Calculation
  if (options.showRowGrandTotals && rawRowHierarchy.length > 0) {
    const grandTotalRowKey = `GRANDTOTAL_ROWS`;
    if (!finalRowHeadersTree.find(h => h.key === grandTotalRowKey)) {
        finalRowHeadersTree.push({ key: grandTotalRowKey, label: `Grand Total`, level: 0, isGrandTotal: true, originalValues: {} });
    }
    allRowKeysSet.add(grandTotalRowKey);
    if (!dataMatrix.has(grandTotalRowKey)) dataMatrix.set(grandTotalRowKey, new Map());

    allColKeysSet.forEach(colKey => {
        const columnNode = finalColumnHeadersTree.find(ch => ch.key === colKey);
        if (columnNode?.isGrandTotal && !options.showColumnGrandTotals) return;
        if (columnNode?.isSubtotal && !options.showColumnSubtotals) return;
        
        let relevantData;
        if (colKey === DUMMY_COLUMN_KEY_FOR_VALUES_ONLY || columnNode?.isGrandTotal || (columnNode?.key.endsWith('|-|SUBTOTAL') && colDimFields.length > 0 )) {
             relevantData = filteredData.filter(dataRow =>
                (columnNode?.key === DUMMY_COLUMN_KEY_FOR_VALUES_ONLY || columnNode?.isGrandTotal) ? true :
                Object.entries(columnNode.originalValues!).every(([field, val]) => String(dataRow[field] ?? 'N/A') === String(val ?? 'N/A'))
            );
        } else if (columnNode && columnNode.originalValues && !columnNode.isSubtotal && !columnNode.isGrandTotal) {
            relevantData = filteredData.filter(dataRow =>
                Object.entries(columnNode.originalValues!).every(([field, val]) => String(dataRow[field] ?? 'N/A') === String(val ?? 'N/A'))
            );
        } else {
            const specificColNode = colLeafNodes.find(cn => cn.key === colKey);
            if(specificColNode && specificColNode.originalValues) {
                 relevantData = filteredData.filter(dataRow =>
                    Object.entries(specificColNode.originalValues!).every(([field, val]) => String(dataRow[field] ?? 'N/A') === String(val ?? 'N/A'))
                );
            } else {
                relevantData = filteredData;
            }
        }
        
        let grandTotalCellValues = aggregateValues(relevantData, config.values);
        if (config.calculatedMeasures && config.calculatedMeasures.length > 0) {
            config.calculatedMeasures.forEach(calcMeasure => {
                grandTotalCellValues[calcMeasure.name] = evaluateCalculatedMeasure(calcMeasure.formula, grandTotalCellValues, config.values);
            });
        }
        dataMatrix.get(grandTotalRowKey)!.set(colKey, grandTotalCellValues);
    });
  }

  // 6. Column Grand Total Calculation
  if (options.showColumnGrandTotals && (config.values.length > 0 || (config.calculatedMeasures && config.calculatedMeasures.length > 0))) {
    const grandTotalColKey = `GRANDTOTAL_COLS`;
    if (!finalColumnHeadersTree.find(h => h.key === grandTotalColKey)) {
        finalColumnHeadersTree.push({ key: grandTotalColKey, label: `Grand Total`, level: 0, isGrandTotal: true, originalValues: {} });
    }
    allColKeysSet.add(grandTotalColKey);

    finalRowHeadersTree.forEach(rNode => {
        if (rNode.isGrandTotal && !options.showRowGrandTotals) return;
        const dataLookupKeyForRow = rNode.key;
        if ((rNode.isSubtotal && options.showRowSubtotals) || (rNode.isGrandTotal && options.showRowGrandTotals) || (!rNode.isSubtotal && !rNode.isGrandTotal)) {
            let relevantDataForRow: DataRow[];
            if (rNode.isGrandTotal) { 
                relevantDataForRow = filteredData;
            } else if (rNode.originalValues) { 
                relevantDataForRow = filteredData.filter(dataRow =>
                    Object.entries(rNode.originalValues!).every(([field, val]) => String(dataRow[field] ?? 'N/A') === String(val ?? 'N/A'))
                );
            } else {
                relevantDataForRow = filteredData;
            }
            
            const cellMap = dataMatrix.get(dataLookupKeyForRow) ?? new Map<string, PivotDataCell>();
            let grandTotalCellValues = aggregateValues(relevantDataForRow, config.values);
             if (config.calculatedMeasures && config.calculatedMeasures.length > 0) {
                config.calculatedMeasures.forEach(calcMeasure => {
                    grandTotalCellValues[calcMeasure.name] = evaluateCalculatedMeasure(calcMeasure.formula, grandTotalCellValues, config.values);
                });
            }
            cellMap.set(grandTotalColKey, grandTotalCellValues);
            dataMatrix.set(dataLookupKeyForRow, cellMap);
        }
    });
  }
  
  if (colDimFields.length === 0 && (config.values.length > 0 || (config.calculatedMeasures && config.calculatedMeasures.length > 0)) && !allColKeysSet.has(DUMMY_COLUMN_KEY_FOR_VALUES_ONLY)) {
    allColKeysSet.add(DUMMY_COLUMN_KEY_FOR_VALUES_ONLY);
  }

  return {
    rowHeadersTree: finalRowHeadersTree,
    columnHeadersTree: finalColumnHeadersTree,
    dataMatrix,
    allRowKeys: Array.from(allRowKeysSet),
    allColumnKeys: Array.from(allColKeysSet).filter(key => key !== undefined), 
  };
};

type UnifiedMeasureConfigForExport = 
  | (PivotValueFieldConfig & { isCalculated: false })
  | (CalculatedMeasureConfig & { isCalculated: true; aggregation: 'Calculated' });


export const exportPivotToExcel = (pivotResult: PivotResult, config: PivotConfig, options: PivotOptions, themeCardBg: string) => {
  if (!pivotResult) return;
  const { rowHeadersTree, columnHeadersTree, dataMatrix, allRowKeys, allColumnKeys } = pivotResult;

  const maxRowDepth = config.rows.length > 0 ? Math.max(0, ...config.rows.map((_, i) => i + 1)) : 1;
  
  let maxColHeaderLevel = 0;
  if (config.columns.length > 0) {
    maxColHeaderLevel = config.columns.length;
  } else if (config.values.length > 0 || (config.calculatedMeasures && config.calculatedMeasures.length > 0)) { 
    maxColHeaderLevel = 1;
  } else {
     maxColHeaderLevel = 1;
  }

  const sheetData: any[][] = [];

  const allMeasureCfgsForHeader: UnifiedMeasureConfigForExport[] = [
      ...(config.values || []).map(vc => ({...vc, isCalculated: false as const })), 
      ...(config.calculatedMeasures || []).map(cm => ({...cm, isCalculated: true as const, aggregation: 'Calculated' as const }))
  ];


  for (let i = 0; i < maxColHeaderLevel; i++) {
    const headerRow: any[] = Array(maxRowDepth).fill(''); 
    let currentExcelColIdx = maxRowDepth;

    if (config.columns.length > 0 ) { 
        (columnHeadersTree || [])
            .filter(ch => ch.level === i && (!ch.isGrandTotal || options.showColumnGrandTotals) && (!ch.isSubtotal || options.showColumnSubtotals))
            .forEach(colHeader => {
                headerRow[currentExcelColIdx] = colHeader.label;
                const isLeafDimensionOrTotal = (colHeader.level === config.columns.length - 1 && !colHeader.children) || colHeader.isGrandTotal || colHeader.isSubtotal;
                const numValueFields = Math.max(1, allMeasureCfgsForHeader.length);
                const span = isLeafDimensionOrTotal ? numValueFields : 1; 
                
                for(let s=1; s < span; s++) headerRow[currentExcelColIdx+s] = '';
                currentExcelColIdx += span;
            });
    } else if (i === 0 && allMeasureCfgsForHeader.length > 0) { 
        allMeasureCfgsForHeader.forEach(mc => {
            if (mc.isCalculated) {
                headerRow[currentExcelColIdx++] = mc.name;
            } else {
                // Type assertion
                const pivotValueConf = mc as PivotValueFieldConfig;
                headerRow[currentExcelColIdx++] = `${pivotValueConf.field} (${pivotValueConf.aggregation})`;
            }
        });
    }
    sheetData.push(headerRow);
  }
  
  allRowKeys.forEach(rowKey => {
    const rowHeaderNode = rowHeadersTree.find(rh => rh.key === rowKey);
    if (!rowHeaderNode || (rowHeaderNode.isGrandTotal && !options.showRowGrandTotals) || (rowHeaderNode.isSubtotal && !options.showRowSubtotals && !rowHeaderNode.isGrandTotal)) {
        return; 
    }

    const dataRow: any[] = Array(maxRowDepth).fill('');
    if (rowHeaderNode.level >=0 && rowHeaderNode.level < maxRowDepth) {
       dataRow[rowHeaderNode.level] = rowHeaderNode.label;
    } else if (rowHeaderNode.isGrandTotal || rowHeaderNode.isSubtotal){ 
       dataRow[0] = rowHeaderNode.label;
    }

    allColumnKeys.forEach(colKey => { 
        if (colKey === DUMMY_COLUMN_KEY_FOR_VALUES_ONLY && config.columns.length > 0) return; 
        
        const colHeaderNodeForFilter = columnHeadersTree.find(ch => ch.key === colKey);
        if (colHeaderNodeForFilter) {
            if (colHeaderNodeForFilter.isGrandTotal && !options.showColumnGrandTotals) return;
            if (colHeaderNodeForFilter.isSubtotal && !options.showColumnSubtotals && !colHeaderNodeForFilter.isGrandTotal) return;
        }

      const cellDataMap = dataMatrix.get(rowKey);
      const cellData = cellDataMap?.get(colKey);

      if (cellData) {
        allMeasureCfgsForHeader.forEach(mc => {
          let measureKey: string;
          if (mc.isCalculated) {
              measureKey = mc.name;
          } else {
              // Type assertion
              const pivotValueConf = mc as PivotValueFieldConfig;
              measureKey = `${pivotValueConf.field} (${pivotValueConf.aggregation})`;
          }
          dataRow.push(cellData[measureKey] ?? '');
        });
      } else if (allMeasureCfgsForHeader.length > 0) {
        if (pivotResult.allColumnKeys.includes(colKey)) { 
             allMeasureCfgsForHeader.forEach(() => dataRow.push(''));
        }
      }
    });
    sheetData.push(dataRow);
  });
  
  try {
    const ws: XLSX.WorkSheet = XLSX.utils.aoa_to_sheet(sheetData);
    if (sheetData.length > 0 && sheetData[0]?.length > 0) {
        const colWidths = sheetData[0].map((_, i) => ({
            wch: sheetData.reduce((w, r) => Math.max(w, String(r[i] || '').length), 10)
        }));
        ws['!cols'] = colWidths;
    }

    const wb: XLSX.WorkBook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'PivotData');
    XLSX.writeFile(wb, `pivot_table_export_${Date.now()}.xlsx`);
  } catch (error) {
    console.error("Error exporting to Excel:", error);
    alert("Failed to export to Excel. See console for details.");
  }
};


// --- Data Table Export Functions ---

const sanitizeForExport = (data: DataRow[], headersToExport?: string[]): DataRow[] => {
  return data.map(row => {
    const newRow: DataRow = {};
    const effectiveHeaders = headersToExport || Object.keys(row);
    effectiveHeaders.forEach(header => {
      if (header !== '__ROW_ID__' && header !== 'calculatedColumnFormula') {
        newRow[header] = row[header];
      }
    });
    return newRow;
  });
};

export const exportTableToExcel = (data: DataRow[], fileName: string, headersToExport?: string[]): void => {
  if (!fileName.toLowerCase().endsWith('.xlsx')) {
    fileName += '.xlsx';
  }
  const sanitizedData = sanitizeForExport(data, headersToExport);
  const worksheet = XLSX.utils.json_to_sheet(sanitizedData, { header: headersToExport });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
  XLSX.writeFile(workbook, fileName);
};

export const exportTableToCSV = (data: DataRow[], fileName: string, headersToExport?: string[]): void => {
  if (!fileName.toLowerCase().endsWith('.csv')) {
    fileName += '.csv';
  }
  const sanitizedData = sanitizeForExport(data, headersToExport);
  const csvString = XLSX.utils.sheet_to_csv(XLSX.utils.json_to_sheet(sanitizedData, { header: headersToExport }));
  
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const exportTableToJson = (data: DataRow[], fileName: string, headersToExport?: string[]): void => {
  if (!fileName.toLowerCase().endsWith('.json')) {
    fileName += '.json';
  }
  const sanitizedData = sanitizeForExport(data, headersToExport);
  const jsonString = JSON.stringify(sanitizedData, null, 2);
  
  const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
