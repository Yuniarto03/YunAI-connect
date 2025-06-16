
import React, { useContext, useMemo, useState, useEffect } from 'react';
import { AppContext } from '../contexts/AppContext';
import { 
    AppContextType, PivotResult, ChartConfig, DataRow, ColumnSummary, 
    NumericStats, CategoricalStats, ColumnType, PivotOptions, 
    PivotValueFieldConfig, CalculatedMeasureConfig, AggregationType, 
    Theme as AppTheme, PivotConfig, FilterSlot, PivotRowHeader, PivotColumnHeader
} from '../types';
import { generatePivotData, DUMMY_COLUMN_KEY_FOR_VALUES_ONLY } from '../services/DataProcessingService';
import FuturisticBackground from './shared/FuturisticBackground';
import Button from './shared/Button';
import Input from './shared/Input';
import LoadingSpinner from './shared/LoadingSpinner';
import { analyzeDocumentWithGemini } from '../services/geminiService';

import { AlertTriangle, TrendingUp, BarChartHorizontalBig, FileWarning, LayoutGrid, BarChart2 as ChartIconLucide, EyeOff, Sigma, Filter as FilterIcon, MessageCircle, Info, Send, PlusCircle, Trash2 } from 'lucide-react';
import { RAW_COLOR_VALUES, CHART_COLOR_PALETTE as GLOBAL_CHART_COLOR_PALETTE } from '../constants';
import { ResponsiveContainer, ComposedChart, Bar, PieChart, Pie, Line, Area, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell, LabelList } from 'recharts';
import { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent';
import { createInitialPivotConfig, createInitialPivotOptions } from '../contexts/AppContext';
import { getSharedSelectBaseStyles } from '../utils';


// --- Helper functions (copied from DataVisualization.tsx for consistency) ---
const aggregateData = (data: DataRow[], groupKey: string, valueKey: string, aggType: AggregationType): { name: string; value: number }[] => {
  if (!data || data.length === 0 || !groupKey || !valueKey) return [];

  const grouped = data.reduce((acc, row) => {
    const group = String(row[groupKey]);
    const rawValue = row[valueKey];
    const numericVal = parseFloat(String(rawValue));

    if (!acc[group]) {
      acc[group] = { values: [], rawValues: [], sum: 0, count: 0 };
    }
    
    acc[group].rawValues.push(rawValue);

    if (!isNaN(numericVal)) {
        acc[group].values.push(numericVal);
        acc[group].sum += numericVal;
    }
    acc[group].count += 1;
    
    return acc;
  }, {} as Record<string, { values: number[]; rawValues: (string | number | boolean | null)[]; sum: number; count: number }>);
  
  return Object.entries(grouped).map(([name, groupData]) => {
    let value: number;
    switch (aggType) {
      case AggregationType.SUM: value = groupData.sum; break;
      case AggregationType.AVERAGE: value = groupData.values.length > 0 ? groupData.sum / groupData.values.length : 0; break;
      case AggregationType.COUNT: value = groupData.count; break;
      case AggregationType.COUNT_NON_EMPTY: value = groupData.rawValues.filter(val => val !== null && val !== undefined && String(val).trim() !== '').length; break;
      case AggregationType.MIN: value = groupData.values.length > 0 ? Math.min(...groupData.values) : 0; break;
      case AggregationType.MAX: value = groupData.values.length > 0 ? Math.max(...groupData.values) : 0; break;
      case AggregationType.UNIQUE_COUNT: value = new Set(groupData.rawValues.filter(val => val !== null && val !== undefined).map(String)).size; break;
      case AggregationType.STDEV:
        if (groupData.values.length < 2) { value = 0; break; }
        const mean = groupData.sum / groupData.values.length;
        const variance = groupData.values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / groupData.values.length;
        value = Math.sqrt(variance);
        break;
      default: value = groupData.sum;
    }
    return { name, value: parseFloat(value.toFixed(2)) };
  });
};

const toProperCase = (str: string): string => {
  return str.replace(/_/g, ' ')
            .toLowerCase()
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
};

interface PayloadItem {
  name?: NameType;
  value?: ValueType;
  color?: string;
  dataKey?: string;
  payload?: any;
}

interface CustomTooltipContentProps {
  active?: boolean;
  payload?: PayloadItem[];
  label?: string | number;
  config: ChartConfig;
  theme: AppTheme;
}

const CustomChartTooltip: React.FC<CustomTooltipContentProps> = ({ active, payload, label, config, theme }) => {
  const themeTextColorHex = RAW_COLOR_VALUES[theme.textColor.replace('text-', '')] || '#E0E0E0';
  const themeAccent1Hex = RAW_COLOR_VALUES[theme.accent1] || '#00D4FF';
  const themeAccent3Hex = RAW_COLOR_VALUES[theme.accent3] || '#00FF88';
  const themeAccent4Hex = RAW_COLOR_VALUES[theme.accent4] || '#FF6B35';
  const themeDarkGrayHex = RAW_COLOR_VALUES[theme.darkGray] || '#1E293B';
  const themeMediumGrayHex = RAW_COLOR_VALUES[theme.mediumGray] || '#333F58';

  if (active && payload && payload.length) {
    const primaryPayload = payload.find(p => p.dataKey === 'primaryValue');
    const secondaryPayload = payload.find(p => p.dataKey === 'secondaryValue');

    let gapInfo = null;
    if (primaryPayload && typeof primaryPayload.value === 'number' && 
        secondaryPayload && typeof secondaryPayload.value === 'number') {
      const primaryValueNum = primaryPayload.value as number;
      const secondaryValueNum = secondaryPayload.value as number;
      const gapAbsolut = primaryValueNum - secondaryValueNum;
      const gapPersen = secondaryValueNum !== 0 ? ((gapAbsolut) / Math.abs(secondaryValueNum)) * 100 : (primaryValueNum !== 0 ? Infinity : 0);
      const gapColor = gapAbsolut >= 0 ? themeAccent3Hex : themeAccent4Hex;

      gapInfo = (
        <>
          <p style={{ color: gapColor, marginTop: '5px', paddingTop: '5px', borderTop: `1px dashed ${themeMediumGrayHex}` }}>
            Gap (Pri - Sec): {gapAbsolut.toLocaleString(undefined, {maximumFractionDigits:2})}
          </p>
          {isFinite(gapPersen) && (
            <p style={{ color: gapColor }}>
              Gap %: {gapPersen.toFixed(0)}%
            </p>
          )}
        </>
      );
    }
    
    const tooltipTitleLabel = (config.chartType === 'pie' || config.chartType === 'donut') && primaryPayload?.name
                         ? primaryPayload.name 
                         : `${config.xAxisKey}: ${label}`;

    return (
      <div 
        className="p-3 rounded-lg shadow-xl" 
        style={{ 
            backgroundColor: `${themeDarkGrayHex}E6`, 
            border: `1px solid ${themeAccent1Hex}`,
            color: themeTextColorHex 
        }}
      >
        <p className="font-bold mb-2" style={{ color: themeAccent1Hex }}>{tooltipTitleLabel}</p>
        {primaryPayload && (
          <p style={{ color: primaryPayload.color || config.color }}>
            {`${primaryPayload.name || config.yAxisKey} (${toProperCase(config.yAxisAggregation)}): `}
            {typeof primaryPayload.value === 'number' ? primaryPayload.value.toLocaleString(undefined, {maximumFractionDigits: 2}) : primaryPayload.value}
          </p>
        )}
        {secondaryPayload && config.secondaryYAxisKey && (
          <p style={{ color: secondaryPayload.color || config.secondaryYAxisColor }}>
            {`${secondaryPayload.name || config.secondaryYAxisKey} (${toProperCase(config.secondaryYAxisAggregation || AggregationType.SUM)}): `}
            {typeof secondaryPayload.value === 'number' ? secondaryPayload.value.toLocaleString(undefined, {maximumFractionDigits: 2}) : secondaryPayload.value}
          </p>
        )}
        {gapInfo}
      </div>
    );
  }
  return null;
};
// --- End Helper Functions ---

const detectColumnTypeForReport = (values: any[]): ColumnType => {
  if (values.every(v => v === null || v === undefined || String(v).trim() === '')) return 'empty';
  const nonNullValues = values.filter(v => v !== null && v !== undefined && String(v).trim() !== '');
  if (nonNullValues.length === 0) return 'empty';
  const isNumeric = nonNullValues.every(v => !isNaN(parseFloat(String(v))) && isFinite(Number(v)));
  if (isNumeric) return 'numeric';
  const isBoolean = nonNullValues.every(v => typeof v === 'boolean' || ['true', 'false'].includes(String(v).toLowerCase()));
  if (isBoolean) return 'boolean';
  let hasNumber = false, hasString = false, hasBool = false;
  for (const v of nonNullValues) {
    if (!isNaN(parseFloat(String(v))) && isFinite(Number(v))) hasNumber = true;
    else if (typeof v === 'boolean' || ['true', 'false'].includes(String(v).toLowerCase())) hasBool = true;
    else if (typeof v === 'string' && String(v).trim() !== '') hasString = true;
  }
  if (hasString && !hasNumber && !hasBool) return 'string';
  if (hasNumber && !hasString && !hasBool) return 'numeric';
  if (hasBool && !hasString && !hasNumber) return 'boolean';
  return 'mixed';
};

const calculateColumnSummariesForReport = (data: DataRow[], headers: string[]): ColumnSummary[] => {
  if (!data || data.length === 0) return [];
  return headers.map(header => {
    const columnValues = data.map(row => row[header]);
    const type = detectColumnTypeForReport(columnValues);
    const nonMissingValues = columnValues.filter(v => v !== null && v !== undefined && String(v).trim() !== '');
    const missingCount = data.length - nonMissingValues.length;
    const uniqueCount = new Set(nonMissingValues).size;
    let numericStats: NumericStats = {};
    let categoricalStats: CategoricalStats = { mostFrequent: [], leastFrequent: [] };

    if (type === 'numeric') {
      const numbers = nonMissingValues.map(v => parseFloat(String(v))).filter(n => !isNaN(n));
      if (numbers.length > 0) {
        numericStats.sum = numbers.reduce((s, n) => s + n, 0);
        numericStats.mean = numericStats.sum / numbers.length;
      }
    } else if (type === 'string' || type === 'mixed' || type === 'boolean') {
      const freqMap = new Map<string, number>();
      nonMissingValues.forEach(val => {
        const strVal = String(val);
        freqMap.set(strVal, (freqMap.get(strVal) || 0) + 1);
      });
      const sortedFreq = Array.from(freqMap.entries()).sort((a, b) => b[1] - a[1]);
      categoricalStats.mostFrequent = sortedFreq.slice(0, 1).map(item => ({ value: item[0], count: item[1] }));
    }
    
    return {
      name: header, type, totalRows: data.length,
      missingCount, missingPercentage: data.length > 0 ? parseFloat(((missingCount / data.length) * 100).toFixed(1)) : 0,
      uniqueCount, ...numericStats, ...categoricalStats,
    };
  });
};

type UnifiedMeasureConfigForReport = 
  | (PivotValueFieldConfig & { isCalculated: false })
  | (CalculatedMeasureConfig & { isCalculated: true; aggregation: 'Calculated' });


const DashboardReport: React.FC = () => {
  const {
    theme, processedData, chartConfigs, reduceMotion,
    activePivotViews, currentEditingPivotViewId,
  } = useContext(AppContext) as AppContextType;

  const [globalFilters, setGlobalFilters] = useState<[FilterSlot, FilterSlot]>([{}, {}]);
  const [showSecondGlobalFilter, setShowSecondGlobalFilter] = useState<boolean>(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [isAiSummaryLoading, setIsAiSummaryLoading] = useState(false);
  const [showAllColumnSummaries, setShowAllColumnSummaries] = useState(false);

  const lastUpdated = useMemo(() => new Date().toLocaleString(), [processedData, globalFilters, showSecondGlobalFilter]);
  const allHeaders = useMemo(() => processedData?.headers || [], [processedData]);

  const globallyFilteredData = useMemo(() => {
    if (!processedData) return null;
    let dataToFilter = [...processedData.data];
    
    // Apply first filter
    if (globalFilters[0].header && globalFilters[0].value !== undefined) {
      dataToFilter = dataToFilter.filter(row => String(row[globalFilters[0].header!]) === globalFilters[0].value);
    }
    // Apply second filter if shown and active
    if (showSecondGlobalFilter && globalFilters[1].header && globalFilters[1].value !== undefined) {
      dataToFilter = dataToFilter.filter(row => String(row[globalFilters[1].header!]) === globalFilters[1].value);
    }
    return { ...processedData, data: dataToFilter };
  }, [processedData, globalFilters, showSecondGlobalFilter]);

  const currentViewForReport = useMemo(() => 
    activePivotViews.find(v => v.id === currentEditingPivotViewId) || activePivotViews[0],
  [activePivotViews, currentEditingPivotViewId]);
  
  const pivotConfig = currentViewForReport?.pivotConfig || createInitialPivotConfig();
  const pivotOptions = currentViewForReport?.pivotOptions || createInitialPivotOptions();


  const columnSummaries = useMemo(() => {
    if (!globallyFilteredData) return [];
    return calculateColumnSummariesForReport(globallyFilteredData.data, globallyFilteredData.headers);
  }, [globallyFilteredData]);

  const displayedColumnSummaries = useMemo(() => {
    return showAllColumnSummaries ? columnSummaries : columnSummaries.slice(0, 4);
  }, [columnSummaries, showAllColumnSummaries]);


  const keyMetrics = useMemo(() => {
    if (!globallyFilteredData) return [];
    const totalCells = globallyFilteredData.data.length * globallyFilteredData.headers.length;
    let totalNonNullCells = 0;
    globallyFilteredData.data.forEach(row => {
      globallyFilteredData.headers.forEach(header => {
        if (row[header] !== null && row[header] !== undefined && String(row[header]).trim() !== '') {
          totalNonNullCells++;
        }
      });
    });
    const missingPercentage = totalCells > 0 ? ((totalCells - totalNonNullCells) / totalCells) * 100 : 0;

    return [
      { label: 'Total Rows (Filtered)', value: globallyFilteredData.data.length.toLocaleString(), icon: TrendingUp, color: theme.accent1 },
      { label: 'Total Columns', value: globallyFilteredData.headers.length.toLocaleString(), icon: BarChartHorizontalBig, color: theme.accent2 },
      { label: 'Missing Cells (Filtered)', value: `${missingPercentage.toFixed(1)}%`, icon: FileWarning, color: theme.accent4 },
    ];
  }, [globallyFilteredData, theme]);

  const dataQualityHighlights = useMemo(() => {
    const highlights = [];
    const highMissingThreshold = 30; // %
    const highCardinalityRatio = 0.5; // 50% unique values relative to total rows

    for (const summary of columnSummaries) {
      if (summary.missingPercentage > highMissingThreshold) {
        highlights.push(`Perhatian: Kolom "${summary.name}" memiliki ${summary.missingPercentage}% nilai yang hilang.`);
      }
      if (summary.type === 'string' || summary.type === 'mixed') {
        if (globallyFilteredData && summary.uniqueCount / globallyFilteredData.data.length > highCardinalityRatio && summary.uniqueCount > 10) {
          highlights.push(`Info: Kolom "${summary.name}" memiliki kardinalitas tinggi (${summary.uniqueCount} nilai unik).`);
        }
      }
      if (summary.type === 'mixed') {
        highlights.push(`Info: Kolom "${summary.name}" berisi tipe data campuran.`);
      }
    }
    return highlights.slice(0, 3); // Show top 3 highlights
  }, [columnSummaries, globallyFilteredData]);

  const pivotResult = useMemo(() => {
    if (!globallyFilteredData || !pivotConfig || !pivotOptions) return null;
    return generatePivotData(globallyFilteredData.data, pivotConfig, pivotOptions);
  }, [globallyFilteredData, pivotConfig, pivotOptions]);
  
 const handleGlobalFilterChange = (filterIndex: number, type: 'header' | 'value', newValue: string | undefined) => {
    setGlobalFilters(prevFilters => {
        const newFilters = [...prevFilters] as [FilterSlot, FilterSlot];
        newFilters[filterIndex] = { ...newFilters[filterIndex] }; 

        if (type === 'header') {
            newFilters[filterIndex].header = newValue;
            newFilters[filterIndex].value = undefined; 
            
            if (filterIndex === 0 && newValue === undefined && showSecondGlobalFilter) {
                newFilters[1] = { ...newFilters[1], value: undefined };
            }
        } else { 
            newFilters[filterIndex].value = newValue;
        }
        return newFilters;
    });
    setAiSummary(null); 
  };
  
  const handleAddSecondFilter = () => {
    setShowSecondGlobalFilter(true);
  };

  const handleRemoveSecondFilter = () => {
    setShowSecondGlobalFilter(false);
    setGlobalFilters(prev => [prev[0], {}]); 
    setAiSummary(null); 
  };


  const getGlobalFilterValueOptions = (filterIndex: number): string[] => {
    if (!processedData?.data) return [];
    const headerKey = globalFilters[filterIndex].header;
    if (!headerKey) return [];

    let sourceData = processedData.data;
    if (filterIndex === 1 && globalFilters[0].header && globalFilters[0].value !== undefined) {
        sourceData = sourceData.filter(row => String(row[globalFilters[0].header!]) === globalFilters[0].value);
    }
    return [...new Set(sourceData.map(row => String(row[headerKey!])).sort((a,b)=>a.localeCompare(b)))];
  };

  const generateAiSummary = async () => {
    if (!globallyFilteredData) {
      setAiSummary("Tidak ada data untuk diringkas.");
      return;
    }
    setIsAiSummaryLoading(true);
    setAiSummary(null);
    try {
      let prompt = `Anda adalah seorang analis data ahli. Berdasarkan informasi dataset berikut, berikan ringkasan tekstual singkat yang menyoroti pengamatan kunci, tren, atau poin penting.\n`;
      prompt += `Nama Dataset: ${globallyFilteredData.fileName}\n`;
      prompt += `Jumlah Baris (setelah filter saat ini): ${globallyFilteredData.data.length}\n`;
      prompt += `Kolom: ${globallyFilteredData.headers.join(', ')}\n`;
      
      const activeGlobalFilters: FilterSlot[] = [globalFilters[0]];
      if (showSecondGlobalFilter && globalFilters[1].header) {
        activeGlobalFilters.push(globalFilters[1]);
      }
      const validActiveGlobalFilters = activeGlobalFilters.filter(f => f.header && f.value);

      if (validActiveGlobalFilters.length > 0) {
        prompt += `Filter Global Aktif Saat Ini:\n`;
        validActiveGlobalFilters.forEach(f => {
          prompt += `- ${f.header}: ${f.value}\n`;
        });
      }
      
      prompt += `Fokus pada penyediaan narasi yang berguna untuk gambaran umum dashboard secara cepat. Buatlah singkat dan berwawasan.\nHarap berikan respon dalam format Markdown yang terstruktur dengan baik.`;

      const response = await analyzeDocumentWithGemini(prompt, undefined, 'text');
      if (response.type === 'text' && typeof response.content === 'string') {
        setAiSummary(response.content);
      } else {
        setAiSummary("Gagal menghasilkan ringkasan AI. " + (response.type === 'error' ? response.content : 'Respon tidak valid.'));
      }
    } catch (error: any) {
      setAiSummary(`Error menghasilkan ringkasan AI: ${error.message}`);
    }
    setIsAiSummaryLoading(false);
  };

  const getRenderableRowNodes = (nodes: PivotRowHeader[] | undefined): PivotRowHeader[] => {
    if (!nodes) return [];
    const renderable: PivotRowHeader[] = [];
    (nodes || []).forEach(node => {
        if (node.isGrandTotal && !pivotOptions.showRowGrandTotals) return;
        if (node.isSubtotal && !pivotOptions.showRowSubtotals) return;
        renderable.push(node);
    });
    return renderable;
  };


  const renderActualPivotTable = () => {
    if (!pivotResult || !pivotConfig || !pivotOptions) return <p className="text-center p-4 opacity-70">Tabel pivot tidak dikonfigurasi atau data hilang.</p>;
    
    const visibleRowHeaders = getRenderableRowNodes(pivotResult.rowHeadersTree);
    const maxRowDepth = pivotConfig.rows.length > 0 ? pivotConfig.rows.length : 1;
    let maxColHeaderLevel = pivotConfig.columns.length > 0 ? pivotConfig.columns.length : (pivotConfig.values.length > 0 || (pivotConfig.calculatedMeasures && pivotConfig.calculatedMeasures.length > 0) ? 1 : 0);

    const leafColNodesForData = pivotResult.allColumnKeys.map(key =>
        (pivotResult.columnHeadersTree || []).find(ch => ch.key === key) ||
        (key === DUMMY_COLUMN_KEY_FOR_VALUES_ONLY ? { key, label: 'Values', level: 0, originalValues: {} } as PivotColumnHeader : { key, label: key, level: 0, originalValues: {} } as PivotColumnHeader)
    ).filter(Boolean) as PivotColumnHeader[];

    const allMeasureCfgs: UnifiedMeasureConfigForReport[] = [
        ...(pivotConfig.values || []).map(vc => ({...vc, isCalculated: false as const})), 
        ...(pivotConfig.calculatedMeasures || []).map(cm => ({...cm, isCalculated: true as const, aggregation: 'Calculated' as const}))
      ];

    return (
      <div className="overflow-auto futuristic-scrollbar max-h-[60vh] border border-gray-700 rounded-md">
        <table className={`min-w-full text-xs ${theme.textColor} border-collapse`}>
          <thead className="sticky top-0 z-10">
            {Array.from({ length: maxColHeaderLevel || 0 }).map((_, levelIndex) => (
              <tr key={`col-header-level-${levelIndex}`}>
                {levelIndex === 0 && <th colSpan={maxRowDepth || 1} rowSpan={maxColHeaderLevel || 1} className={`p-1.5 border ${theme.borderColor} bg-${theme.mediumGray}/50`}></th>}
                {(pivotResult.columnHeadersTree || []).filter(ch => ch.level === levelIndex).map(colHeader => (
                  <th key={colHeader.key} colSpan={colHeader.children && colHeader.children.length > 0 ? colHeader.children.length * Math.max(1, allMeasureCfgs.length) : Math.max(1, allMeasureCfgs.length)} className={`p-1.5 border ${theme.borderColor} bg-${theme.mediumGray}/50 whitespace-nowrap`}>{colHeader.label}</th>
                ))}
                {pivotConfig.columns.length === 0 && levelIndex === 0 && allMeasureCfgs.length > 0 && allMeasureCfgs.map(mc => {
                    let keyForTh: string;
                    let displayValueForTh: string;
                    if (mc.isCalculated) {
                        keyForTh = mc.name;
                        displayValueForTh = mc.name;
                    } else {
                        const pivotValueConf = mc as PivotValueFieldConfig;
                        keyForTh = pivotValueConf.field;
                        displayValueForTh = `${pivotValueConf.field} (${pivotValueConf.aggregation})`;
                    }
                    return (<th key={keyForTh} className={`p-1.5 border ${theme.borderColor} bg-${theme.mediumGray}/50 whitespace-nowrap`}>{displayValueForTh}</th>);
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {visibleRowHeaders.map(rowHeader => (
              <tr key={rowHeader.key}>
                <th colSpan={maxRowDepth || 1} className={`p-1.5 border ${theme.borderColor} bg-${theme.mediumGray}/30 text-left whitespace-nowrap`} style={{paddingLeft: `${(rowHeader.level * 1 + 0.5)}rem`}}>{rowHeader.label}</th>
                {leafColNodesForData.map(colHeader => {
                  const cellData = pivotResult.dataMatrix.get(rowHeader.key)?.get(colHeader.key);
                  return allMeasureCfgs.map(mc => {
                    let measureKeyForCellAccess: string;
                    let cellKeyPartForUniqueReactKey: string;

                    if (mc.isCalculated) {
                        measureKeyForCellAccess = mc.name;
                        cellKeyPartForUniqueReactKey = mc.name;
                    } else {
                        const pivotValueConf = mc as PivotValueFieldConfig;
                        measureKeyForCellAccess = `${pivotValueConf.field} (${pivotValueConf.aggregation})`;
                        cellKeyPartForUniqueReactKey = pivotValueConf.field;
                    }
                    const val = cellData?.[measureKeyForCellAccess];
                    return (<td key={`${rowHeader.key}-${colHeader.key}-${cellKeyPartForUniqueReactKey}-${mc.isCalculated ? 'calc' : 'agg'}`} className={`p-1.5 border ${theme.borderColor} text-right whitespace-nowrap`}>{val !== null && val !== undefined ? Number(val).toLocaleString(undefined, {minimumFractionDigits:0, maximumFractionDigits:2}) : '-'}</td>);
                  });
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderSingleChart = (config: ChartConfig, index: number) => {
    if (!globallyFilteredData || !config.xAxisKey || !config.yAxisKey) return <p className="text-xs opacity-50 text-center p-4">Grafik tidak dikonfigurasi sepenuhnya.</p>;
    
    let currentData = [...globallyFilteredData.data];
    // Apply chart-specific filters
    if (config.filter1Header && config.filter1Value) {
      currentData = currentData.filter(row => String(row[config.filter1Header!]) === config.filter1Value);
      if (config.filter1SubHeader && config.filter1SubValue) {
        currentData = currentData.filter(row => String(row[config.filter1SubHeader!]) === config.filter1SubValue);
      }
    }
    if (config.filter2Header && config.filter2Value) {
      currentData = currentData.filter(row => String(row[config.filter2Header!]) === config.filter2Value);
      if (config.filter2SubHeader && config.filter2SubValue) {
        currentData = currentData.filter(row => String(row[config.filter2SubHeader!]) === config.filter2SubValue);
      }
    }

    const primaryAggregatedData = aggregateData(currentData, config.xAxisKey, config.yAxisKey, config.yAxisAggregation);
    let secondaryAggregatedData: { name: string; value: number }[] = [];
    if (config.secondaryYAxisKey && config.secondaryYAxisAggregation) {
      secondaryAggregatedData = aggregateData(currentData, config.xAxisKey, config.secondaryYAxisKey, config.secondaryYAxisAggregation);
    }

    const mergedChartData = primaryAggregatedData.map(pItem => {
      const sItem = secondaryAggregatedData.find(s => s.name === pItem.name);
      return {
        name: pItem.name,
        primaryValue: pItem.value,
        secondaryValue: sItem ? sItem.value : null,
      };
    });

    if (mergedChartData.length === 0 && config.chartType !== 'scatter') { 
        return <p className="text-xs opacity-50 text-center p-4">Tidak ada data untuk grafik setelah filter/agregasi.</p>;
    }

    const chartHeight = 250;
    const tickFill = RAW_COLOR_VALUES[theme.textColor.replace('text-', '')] || '#E0E0E0';
    const gridStroke = RAW_COLOR_VALUES[theme.mediumGray] || '#333F58';
    
    const primaryChartColor = config.color || GLOBAL_CHART_COLOR_PALETTE[index % GLOBAL_CHART_COLOR_PALETTE.length];
    const secondaryChartColor = config.secondaryYAxisColor || GLOBAL_CHART_COLOR_PALETTE[(index + 2) % GLOBAL_CHART_COLOR_PALETTE.length];


    if (config.chartType === 'pie' || config.chartType === 'donut') {
        return (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <PieChart>
              <Tooltip content={<CustomChartTooltip config={config} theme={theme}/>} />
              <Pie data={primaryAggregatedData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={config.chartType === 'donut' ? 40:0} fill={primaryChartColor} labelLine={false} label={({ percent }) => `${(percent * 100).toFixed(0)}%`}>
                {primaryAggregatedData.map((entry, idx) => <Cell key={`cell-${idx}`} fill={GLOBAL_CHART_COLOR_PALETTE[idx % GLOBAL_CHART_COLOR_PALETTE.length]} />)}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        );
    }
    
    if (config.chartType === 'scatter') {
        const scatterPlotData = currentData.map(row => ({
            name: String(row[config.xAxisKey]), 
            primaryValue: parseFloat(String(row[config.yAxisKey])), 
        })).filter(p => !isNaN(p.primaryValue));

        if (scatterPlotData.length === 0) {
            return <p className="text-xs opacity-50 text-center p-4">Tidak ada data numerik yang valid untuk scatter plot.</p>
        }
        return (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <ScatterChart margin={{ top: 5, right: 5, left: -20, bottom: 35 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                <XAxis type="category" dataKey="name" tick={{ fontSize: 9, fill: tickFill }} angle={-25} textAnchor="end" height={50} interval={0} />
                <YAxis type="number" dataKey="primaryValue" name={config.yAxisKey} tick={{ fontSize: 9, fill: tickFill }}/>
                <Tooltip content={<CustomChartTooltip config={config} theme={theme}/>} cursor={{ strokeDasharray: '3 3' }} />
                <Scatter name={config.yAxisKey} data={scatterPlotData} fill={primaryChartColor} />
            </ScatterChart>
          </ResponsiveContainer>
        );
    }


    return (
      <ResponsiveContainer width="100%" height={chartHeight}>
        <ComposedChart data={mergedChartData} margin={{ top: 5, right: 5, left: -20, bottom: 35 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
          <XAxis dataKey="name" tick={{ fontSize: 9, fill: tickFill }} angle={-25} textAnchor="end" height={50} interval={0} />
          <YAxis yAxisId="left" tick={{ fontSize: 9, fill: tickFill }} />
          {config.secondaryYAxisKey && <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 9, fill: tickFill }} />}
          <Tooltip content={<CustomChartTooltip config={config} theme={theme}/>} />
          <Legend wrapperStyle={{fontSize: '10px'}}/>
          
          {config.chartType === 'bar' && <Bar yAxisId="left" dataKey="primaryValue" name={config.yAxisKey} fill={primaryChartColor} barSize={20} />}
          {config.chartType === 'line' && <Line yAxisId="left" type="monotone" dataKey="primaryValue" name={config.yAxisKey} stroke={primaryChartColor} strokeWidth={2} dot={{r:3}} />}
          {config.chartType === 'area' && <Area yAxisId="left" type="monotone" dataKey="primaryValue" name={config.yAxisKey} stroke={primaryChartColor} fill={primaryChartColor} fillOpacity={0.3} />}

          {config.secondaryYAxisKey && config.secondaryYAxisChartType === 'bar' && <Bar yAxisId="right" dataKey="secondaryValue" name={config.secondaryYAxisKey} fill={secondaryChartColor} barSize={15} />}
          {config.secondaryYAxisKey && config.secondaryYAxisChartType === 'line' && <Line yAxisId="right" type="monotone" dataKey="secondaryValue" name={config.secondaryYAxisKey} stroke={secondaryChartColor} strokeWidth={2} dot={{r:3}} />}
          {config.secondaryYAxisKey && config.secondaryYAxisChartType === 'area' && <Area yAxisId="right" type="monotone" dataKey="secondaryValue" name={config.secondaryYAxisKey} stroke={secondaryChartColor} fill={secondaryChartColor} fillOpacity={0.3} />}

        </ComposedChart>
      </ResponsiveContainer>
    );
  };
  
  const selectStyles = getSharedSelectBaseStyles(theme, 'text-xs');

  if (!processedData) {
    return (
      <div className={`p-8 ${theme.textColor} flex flex-col items-center justify-center h-full`}>
        <FuturisticBackground theme={theme} reduceMotion={reduceMotion} />
        <div className="relative z-10 text-center">
            <AlertTriangle size={48} className={`text-${theme.accent4} mb-4`} />
            <h2 className="text-2xl font-semibold">Tidak Ada Data yang Dimuat</h2>
            <p className="opacity-70">Silakan impor data untuk melihat laporan dashboard.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`p-4 md:p-6 ${theme.textColor} futuristic-scrollbar overflow-y-auto h-full`}>
      <FuturisticBackground theme={theme} reduceMotion={reduceMotion} />
      <div className="relative z-10">
        <div className="flex justify-between items-center mb-6">
          <h1 className={`text-3xl md:text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-${theme.accent1} to-${theme.accent2}`}>Laporan Dashboard Interaktif</h1>
          <p className="text-xs opacity-70">Update Terakhir: {lastUpdated}</p>
        </div>

        {/* Global Filters Section */}
        <div className={`${theme.cardBg} p-4 rounded-lg shadow-lg border ${theme.borderColor} mb-6`}>
          <div className="flex items-center mb-3">
            <FilterIcon size={20} className={`mr-2 text-${theme.accent3}`} />
            <h2 className={`text-lg font-semibold text-${theme.accent3}`}>Filter Global</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 items-end">
            {/* First Filter Pair */}
            <div>
              <label htmlFor="globalFilterHeader0" className={`block text-[10px] font-medium ${theme.textColor} opacity-70 mb-0.5`}>Header Filter 1</label>
              <select
                id="globalFilterHeader0"
                value={globalFilters[0].header || ''}
                onChange={(e) => handleGlobalFilterChange(0, 'header', e.target.value)}
                className={`${selectStyles.baseClassName} w-full !py-1`} style={selectStyles.style}
              >
                <option value="" style={selectStyles.optionStyle}>-- Pilih Header --</option>
                {allHeaders.map(h => <option key={`gf0-${h}`} value={h} style={selectStyles.optionStyle}>{h}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="globalFilterValue0" className={`block text-[10px] font-medium ${theme.textColor} opacity-70 mb-0.5`}>Value Filter 1</label>
              <select
                id="globalFilterValue0"
                value={globalFilters[0].value || ''}
                onChange={(e) => handleGlobalFilterChange(0, 'value', e.target.value)}
                disabled={!globalFilters[0].header}
                className={`${selectStyles.baseClassName} w-full !py-1`} style={selectStyles.style}
              >
                <option value="" style={selectStyles.optionStyle}>-- Pilih Value --</option>
                {getGlobalFilterValueOptions(0).map(val => <option key={`gf0v-${val}`} value={val} style={selectStyles.optionStyle}>{val}</option>)}
              </select>
            </div>

            {/* Add/Remove Buttons and Second Filter Pair */}
            <div className="md:col-span-1 flex items-end">
              {!showSecondGlobalFilter ? (
                <Button onClick={handleAddSecondFilter} variant="secondary" size="sm" leftIcon={<PlusCircle size={14} />} className="w-full md:w-auto">
                  Tambah Filter
                </Button>
              ) : (
                <div className="w-full grid grid-cols-1 sm:grid-cols-2 md:grid-cols-1 gap-3 items-end"> 
                  {/* Div to hold the second filter pair if needed by styling, or direct grid items */}
                </div>
              )}
            </div>
            {showSecondGlobalFilter && (
                <>
                  <div>
                    <label htmlFor="globalFilterHeader1" className={`block text-[10px] font-medium ${theme.textColor} opacity-70 mb-0.5`}>Header Filter 2</label>
                    <select
                      id="globalFilterHeader1"
                      value={globalFilters[1].header || ''}
                      onChange={(e) => handleGlobalFilterChange(1, 'header', e.target.value)}
                      className={`${selectStyles.baseClassName} w-full !py-1`} style={selectStyles.style}
                      disabled={!globalFilters[0].header || !globalFilters[0].value}
                    >
                      <option value="" style={selectStyles.optionStyle}>-- Pilih Header --</option>
                      {allHeaders.filter(h => h !== globalFilters[0].header).map(h => <option key={`gf1-${h}`} value={h} style={selectStyles.optionStyle}>{h}</option>)}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="globalFilterValue1" className={`block text-[10px] font-medium ${theme.textColor} opacity-70 mb-0.5`}>Value Filter 2</label>
                    <select
                      id="globalFilterValue1"
                      value={globalFilters[1].value || ''}
                      onChange={(e) => handleGlobalFilterChange(1, 'value', e.target.value)}
                      disabled={!globalFilters[1].header || !globalFilters[0].header || !globalFilters[0].value}
                      className={`${selectStyles.baseClassName} w-full !py-1`} style={selectStyles.style}
                    >
                      <option value="" style={selectStyles.optionStyle}>-- Pilih Value --</option>
                      {getGlobalFilterValueOptions(1).map(val => <option key={`gf1v-${val}`} value={val} style={selectStyles.optionStyle}>{val}</option>)}
                    </select>
                  </div>
                   <div className="md:col-start-3 flex items-end"> {/* Aligns with the Add Filter button's column */}
                     <Button onClick={handleRemoveSecondFilter} variant="danger" size="sm" leftIcon={<Trash2 size={14} />} className="w-full md:w-auto">
                        Hapus Filter Kedua
                     </Button>
                   </div>
                </>
            )}
          </div>
        </div>


        {/* KPI Section */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {keyMetrics.map(metric => (
            <div key={metric.label} className={`${theme.cardBg} p-4 rounded-lg shadow-lg border ${theme.borderColor} flex items-center space-x-3`}>
              <div className={`p-2 rounded-full bg-${metric.color}/20 text-${metric.color}`}>
                <metric.icon size={24} />
              </div>
              <div>
                <p className="text-sm opacity-80">{metric.label}</p>
                <p className="text-xl font-bold">{metric.value}</p>
              </div>
            </div>
          ))}
        </div>
        
        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column: AI Summary & Data Quality */}
          <div className="space-y-6">
            <div className={`${theme.cardBg} p-4 rounded-lg shadow-xl border ${theme.borderColor}`}>
              <div className="flex justify-between items-center mb-3">
                <div className="flex items-center">
                  <MessageCircle size={20} className={`mr-2 text-${theme.accent4}`} />
                  <h2 className={`text-xl font-semibold text-${theme.accent4}`}>Ringkasan Naratif AI</h2>
                </div>
                <Button onClick={generateAiSummary} size="sm" variant="secondary" isLoading={isAiSummaryLoading} disabled={isAiSummaryLoading} leftIcon={<Send size={14}/>}>
                  {isAiSummaryLoading ? "Menghasilkan..." : (aiSummary ? "Segarkan" : "Hasilkan")}
                </Button>
              </div>
              {isAiSummaryLoading && <div className="flex justify-center py-4"><LoadingSpinner text="AI sedang menganalisis..."/></div>}
              {aiSummary && !isAiSummaryLoading && (
                <div className={`text-xs opacity-90 whitespace-pre-wrap p-2 border border-${theme.mediumGray} rounded-md bg-${theme.darkGray}/50 max-h-60 overflow-y-auto futuristic-scrollbar`}
                  dangerouslySetInnerHTML={{ __html: aiSummary.replace(/```json\n([\s\S]*?)\n```/g, '<pre class="bg-gray-800 text-gray-200 p-2 rounded text-xs overflow-x-auto"><code>$1</code></pre>').replace(/```markdown\n([\s\S]*?)\n```/g, '<div class="prose prose-sm prose-invert">$1</div>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>').replace(/^- (.*$)/gm, '• $1').replace(/\n/g, '<br />') }}
                >
                </div>
              )}
              {!aiSummary && !isAiSummaryLoading && <p className="text-xs opacity-70 text-center py-4">Klik "Hasilkan" untuk mendapatkan ringkasan dari AI.</p>}
            </div>

            {dataQualityHighlights.length > 0 && (
              <div className={`${theme.cardBg} p-4 rounded-lg shadow-lg border ${theme.borderColor}`}>
                  <div className="flex items-center mb-2">
                    <Info size={18} className={`mr-2 text-${theme.accent3}`} />
                    <h2 className={`text-lg font-semibold text-${theme.accent3}`}>Sorotan Kualitas Data</h2>
                  </div>
                  <ul className="list-disc list-inside space-y-1 text-xs opacity-90">
                      {dataQualityHighlights.map((highlight, index) => <li key={index}>{highlight}</li>)}
                  </ul>
              </div>
            )}
          </div>

          {/* Right Column: Pivot Table or Placeholder */}
           <div className={`${theme.cardBg} p-4 rounded-lg shadow-xl border ${theme.borderColor}`}>
            <div className="flex justify-between items-center mb-3">
                <h2 className={`text-xl font-semibold text-${theme.accent1}`}>Ringkasan Tabel Pivot</h2>
                {pivotResult && <Sigma size={20} className={`text-${theme.accent1}`} />}
            </div>
            {renderActualPivotTable()}
          </div>
        </div>

        {/* Charts Section */}
        <div className="mt-6">
            <div className="flex justify-between items-center mb-3">
                <h2 className={`text-xl font-semibold text-${theme.accent2}`}>Grafik Visualisasi</h2>
                {chartConfigs.length > 0 && <ChartIconLucide size={20} className={`text-${theme.accent2}`} />}
            </div>
            {chartConfigs.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {chartConfigs.map((chartConfig, index) => (
                      <div key={`dashboard-chart-${index}`} className={`${theme.cardBg} p-4 rounded-lg shadow-xl border ${theme.borderColor}`}>
                        <h3 className={`text-md font-semibold mb-2 text-${theme.accent2}`}>{chartConfig.yAxisKey} berdasarkan {chartConfig.xAxisKey} ({chartConfig.chartType})</h3>
                        {renderSingleChart(chartConfig, index)}
                      </div>
                    ))}
                </div>
            ) : (
              <div className={`${theme.cardBg} p-6 rounded-lg shadow-xl border ${theme.borderColor} text-center`}>
                <EyeOff size={32} className={`mx-auto mb-2 text-${theme.accent4} opacity-70`} />
                <p className="opacity-70">Tidak ada grafik yang dikonfigurasi.</p>
                <p className="text-xs opacity-50">Buka halaman "Visualisasi" untuk mengatur grafik.</p>
              </div>
            )}
        </div>
        
        {/* Column Summaries Section */}
        <div className="mt-6">
            <div className="flex justify-between items-center mb-3">
                <h2 className={`text-xl font-semibold text-${theme.accent3}`}>Ringkasan Kolom</h2>
                {columnSummaries.length > 4 && (
                    <Button variant="ghost" size="sm" onClick={() => setShowAllColumnSummaries(!showAllColumnSummaries)} className={`text-xs text-${theme.accent1}`}>
                        {showAllColumnSummaries ? "Tampilkan Lebih Sedikit" : "Tampilkan Semua"} ({columnSummaries.length})
                    </Button>
                )}
            </div>
             {displayedColumnSummaries.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {displayedColumnSummaries.map(summary => (
                        <div key={summary.name} className={`${theme.cardBg} p-3 rounded-lg shadow-md border ${theme.borderColor}`}>
                            <h4 className={`text-sm font-bold text-${theme.accent4} truncate mb-1`} title={summary.name}>{summary.name}</h4>
                            <p className="text-xs opacity-80">Tipe: {summary.type}</p>
                            <p className="text-xs opacity-80">Hilang: {summary.missingPercentage}%</p>
                            <p className="text-xs opacity-80">Unik: {summary.uniqueCount}</p>
                            {summary.type === 'numeric' && summary.mean !== undefined && <p className="text-xs opacity-80">Rata-rata: {summary.mean.toLocaleString(undefined, {maximumFractionDigits:1})}</p>}
                            {summary.type !== 'numeric' && summary.mostFrequent.length > 0 && <p className="text-xs opacity-80 truncate" title={`Teratas: ${summary.mostFrequent[0].value}`}>Teratas: {summary.mostFrequent[0].value}</p>}
                        </div>
                    ))}
                </div>
             ) : (
                <p className="opacity-70 text-center py-4">Tidak ada ringkasan kolom untuk ditampilkan (mungkin karena filter global).</p>
             )}
        </div>

      </div>
    </div>
  );
};

export default DashboardReport;

// Helper for ScatterChart (not used directly in the main render but kept for consistency if CustomChartTooltip expects it)
const ScatterChart: React.FC<any> = ({ children, ...props }) => (
  <ComposedChart {...props}>{children}</ComposedChart>
);
