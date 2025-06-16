import React, { useContext, useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppContext } from '../contexts/AppContext';
import { AppContextType, DataRow, FilterState, TableThemeName, TableFontOption, TableFontSizeOption, Theme, ProcessedData, PivotConfig, AggregationType, TableTheme, DataTableViewConfig, ExportFormat } from '../types';
import Button from './shared/Button';
import Modal from './shared/Modal';
import { Search, Save, AlertTriangle, Filter as FilterIconLucide, Settings2, SlidersHorizontal, CheckSquare, Square, ExternalLink, PackagePlus, ChevronDown, ChevronUp, XCircle, Eye, EyeOff, PlusCircle, Trash2, Edit3, Edit, Rows, Columns, MoreVertical, Calculator, Undo, Redo, View, Download } from 'lucide-react';
import { LUCIDE_FILTER_ICON, RAW_COLOR_VALUES, EXPORT_FORMAT_OPTIONS } from '../constants'; 
import Input from './shared/Input';
import { exportTableToExcel, exportTableToCSV, exportTableToJson } from '../services/DataProcessingService';
import { getSharedSelectBaseStyles, isNumericDataField } from '../utils'; // Import shared utilities

// Simple MultiSelectDropdown component for internal use
interface MultiSelectDropdownProps {
  label: string;
  options: string[];
  selectedOptions: string[];
  onSelectionChange: (newSelected: string[]) => void;
  theme: Theme;
}

const MultiSelectDropdown: React.FC<MultiSelectDropdownProps> = ({ label, options, selectedOptions, onSelectionChange, theme }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleOption = (option: string) => {
    const newSelected = selectedOptions.includes(option)
      ? selectedOptions.filter(o => o !== option)
      : [...selectedOptions, option];
    onSelectionChange(newSelected);
  };

  const handleSelectAll = () => onSelectionChange(options);
  const handleDeselectAll = () => onSelectionChange([]);
  
  const filteredOptions = options.filter(opt => opt.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <label className={`block text-xs font-medium mb-1 ${theme.textColor} opacity-80`}>{label}:</label>
      <Button
        variant="secondary"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full justify-between !text-xs !py-1.5" // Adjusted padding and text size
      >
        <span className="truncate">
          {selectedOptions.length > 0 ? `${selectedOptions.length} selected` : `Select field(s)...`}
        </span>
        {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </Button>
      {isOpen && (
        <div 
          className="absolute z-50 mt-1 w-full p-2 rounded-md shadow-2xl border max-h-60 overflow-y-auto futuristic-scrollbar"
          style={{
            backgroundColor: RAW_COLOR_VALUES[theme.cardBg.replace('bg-', '').split('/')[0]] || RAW_COLOR_VALUES[theme.darkGray],
            borderColor: RAW_COLOR_VALUES[theme.borderColor.replace('border-', '')] || RAW_COLOR_VALUES[theme.mediumGray],
          }}
        >
          <Input 
            type="text" 
            placeholder="Search..." 
            value={searchTerm} 
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full !p-1 !text-xs mb-1"
          />
          <div className="flex justify-between items-center my-1.5">
            <Button variant="ghost" size="sm" onClick={handleSelectAll} className="!text-xs !p-0.5">All</Button>
            <Button variant="ghost" size="sm" onClick={handleDeselectAll} className="!text-xs !p-0.5">None</Button>
          </div>
          {filteredOptions.map(option => (
            <label key={option} className={`flex items-center space-x-2 p-1 rounded cursor-pointer hover:bg-${theme.mediumGray}/30 transition-colors`}>
              <input
                type="checkbox"
                checked={selectedOptions.includes(option)}
                onChange={() => toggleOption(option)}
                className={`form-checkbox h-3.5 w-3.5 rounded border-${theme.mediumGray} text-${theme.accent1} focus:ring-1 focus:ring-offset-0 focus:ring-${theme.accent1}`}
                style={{ accentColor: RAW_COLOR_VALUES[theme.accent1] }}
              />
              <span className={`text-xs truncate ${theme.textColor}`}>{option}</span>
            </label>
          ))}
          {filteredOptions.length === 0 && <p className="text-xs text-center opacity-70 p-1">No matching fields.</p>}
        </div>
      )}
    </div>
  );
};


const DataTableComponent: React.FC = () => {
  const appContext = useContext(AppContext) as AppContextType;
  const { 
    theme, processedData, saveFileToLibrary, 
    tableFont, setTableFont, tableFontSize, setTableFontSize, 
    tableTheme, setTableTheme, availableTableThemes,
    tableFontOptions, tableFontSizeOptions,
    setProcessedData: setGlobalProcessedData,
    reduceMotion,
    savedDataTableViews, saveDataTableView, loadDataTableView, deleteDataTableView,
    undoDataTableChange, redoDataTableChange, canUndoDataTable, canRedoDataTable,
    defaultExportFormat
  } = appContext;
  const navigate = useNavigate();

  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilters, setActiveFilters] = useState<FilterState>({});
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [isPreferencesOpen, setIsPreferencesOpen] = useState(false);

  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({});
  const [isColumnVisibilityModalOpen, setIsColumnVisibilityModalOpen] = useState(false); 

  const [quickAddColumns, setQuickAddColumns] = useState<string[]>([]);
  const [quickAddRows, setQuickAddRows] = useState<string[]>([]);
  const [quickAddValues, setQuickAddValues] = useState<string[]>([]);
  const [quickAddFiltersState, setQuickAddFiltersState] = useState<string[]>([]); 
  const [isConfigureSummaryModalOpen, setIsConfigureSummaryModalOpen] = useState(false);

  const [isInsertColumnModalOpen, setIsInsertColumnModalOpen] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');
  const [newColumnDefaultValue, setNewColumnDefaultValue] = useState('');
  const [columnInsertPosition, setColumnInsertPosition] = useState<'start' | 'end' | 'before' | 'after'>('end');
  const [columnInsertTarget, setColumnInsertTarget] = useState<string>('');

  const [isDeleteColumnModalOpen, setIsDeleteColumnModalOpen] = useState(false);
  const [columnsToDelete, setColumnsToDelete] = useState<string[]>([]);

  const [isEditHeadersModalOpen, setIsEditHeadersModalOpen] = useState(false);
  const [headerEdits, setHeaderEdits] = useState<Record<string, string>>({});

  const [isInsertRowModalOpen, setIsInsertRowModalOpen] = useState(false);
  const [newRowData, setNewRowData] = useState<Partial<DataRow>>({});
  const [rowInsertPosition, setRowInsertPosition] = useState<'start' | 'end' | 'beforeSelected' | 'afterSelected'>('end');

  const [isAddCalculatedColumnModalOpen, setIsAddCalculatedColumnModalOpen] = useState(false);
  const [calculatedColumnName, setCalculatedColumnName] = useState('');
  const [calculatedColumnFormula, setCalculatedColumnFormula] = useState('');
  const formulaInputRef = useRef<HTMLTextAreaElement>(null);

  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
  
  const [isTableMenuOpen, setIsTableMenuOpen] = useState(false);
  const tableMenuRef = useRef<HTMLDivElement>(null);

  const [isManageViewsModalOpen, setIsManageViewsModalOpen] = useState(false);
  const [newViewName, setNewViewName] = useState('');

  // Export Modal State
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportFileName, setExportFileName] = useState('');
  const [exportFormat, setExportFormat] = useState<ExportFormat>(defaultExportFormat);
  const [exportScope, setExportScope] = useState<'currentView' | 'allData'>('currentView');


  const currentDataIdentifier = useMemo(() => {
    if (!processedData) return '';
    // Create a simple hash-like identifier from headers and a few rows for basic dataset matching
    const headerString = processedData.headers.join(',');
    const sampleRowCount = Math.min(5, processedData.data.length);
    let sampleRowString = '';
    for (let i = 0; i < sampleRowCount; i++) {
        sampleRowString += Object.values(processedData.data[i]).join('|');
    }
    // Very simple hash, not cryptographically secure, just for basic identification
    let hash = 0;
    const combinedString = `${processedData.fileName}-${processedData.sheetName || 'default'}-${headerString}-${sampleRowString}`;
    for (let i = 0; i < combinedString.length; i++) {
        const char = combinedString.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0; // Convert to 32bit integer
    }
    return `dataset-${hash}`;
  }, [processedData]);

  const data = processedData?.data || [];
  const allHeaders = processedData?.headers || [];

  const headersCurrentlyVisible = useMemo(() => {
    return allHeaders.filter(header => visibleColumns[header]);
  }, [allHeaders, visibleColumns]);

  useEffect(() => {
    const updateQuickAddArray = (currentQuickAdd: string[], visible: Record<string, boolean>) => 
      currentQuickAdd.filter(field => visible[field]);

    setQuickAddColumns(prev => updateQuickAddArray(prev, visibleColumns));
    setQuickAddRows(prev => updateQuickAddArray(prev, visibleColumns));
    setQuickAddValues(prev => updateQuickAddArray(prev, visibleColumns));
    setQuickAddFiltersState(prev => updateQuickAddArray(prev, visibleColumns));
    
    setColumnsToDelete(prev => prev.filter(col => allHeaders.includes(col) && visibleColumns[col]));

  }, [visibleColumns, allHeaders]);

  useEffect(() => {
    const initialVisibility: Record<string, boolean> = {};
    allHeaders.forEach(header => { initialVisibility[header] = true; });
    setVisibleColumns(initialVisibility);
    setQuickAddColumns([]);
    setQuickAddRows([]);
    setQuickAddValues([]);
    setQuickAddFiltersState([]);
    setIsConfigureSummaryModalOpen(false); 
    setHeaderEdits(allHeaders.reduce((acc, h) => ({...acc, [h]:h}), {}));
    if (allHeaders.length > 0) {
        setColumnInsertTarget(allHeaders[0]);
    } else {
        setColumnInsertTarget('');
    }
    // Set default export filename when processedData changes
    if (processedData) {
      setExportFileName(processedData.fileName.replace(/\.[^/.]+$/, "")); // Remove extension
    }
  }, [allHeaders, processedData]);


  const headers = useMemo(() => {
    return allHeaders.filter(header => visibleColumns[header]);
  }, [allHeaders, visibleColumns]);

  const uniqueFilterValues = useMemo(() => {
    if (!data || data.length === 0) return {};
    
    return allHeaders.reduce((acc, header) => { 
      const tempFilters = { ...activeFilters };
      delete tempFilters[header];

      const intermediateData = data.filter(row => 
        Object.entries(tempFilters).every(([filterHeader, selectedValues]) => 
          selectedValues.length === 0 || selectedValues.includes(String(row[filterHeader]))
        )
      );
      
      const values = [...new Set(intermediateData.map(row => String(row[header])))].sort();
      acc[header] = values;
      return acc;
    }, {} as Record<string, string[]>);
  }, [data, allHeaders, activeFilters]);

  const filteredAndSearchedData = useMemo(() => {
    let filtered = data;
    if (Object.keys(activeFilters).length > 0) {
      filtered = filtered.filter(row =>
        Object.entries(activeFilters).every(([header, selectedValues]) =>
          selectedValues.length === 0 || selectedValues.includes(String(row[header]))
        )
      );
    }
    if (searchTerm) {
      const lowerSearchTerm = searchTerm.toLowerCase();
      filtered = filtered.filter(row =>
        allHeaders.some(header => String(row[header]).toLowerCase().includes(lowerSearchTerm))
      );
    }
    return filtered;
  }, [data, searchTerm, activeFilters, allHeaders]);
  
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredAndSearchedData.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredAndSearchedData, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredAndSearchedData.length / itemsPerPage);

  const handleFilterChange = (header: string, value: string) => {
    setActiveFilters(prev => {
      const currentHeaderFilters = prev[header] || [];
      const newHeaderFilters = currentHeaderFilters.includes(value)
        ? currentHeaderFilters.filter(v => v !== value)
        : [...currentHeaderFilters, value];
      
      if (newHeaderFilters.length === 0) {
        const { [header]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [header]: newHeaderFilters };
    });
    setCurrentPage(1);
  };
  
  const toggleDropdown = (header: string) => {
    setOpenDropdown(openDropdown === header ? null : header);
  };

  const handleSaveToLibrary = () => {
    if (processedData) {
      saveFileToLibrary(processedData);
      alert(`${processedData.fileName} saved to library!`);
    }
  };
  
  useEffect(() => {
    setCurrentPage(1);
    setSearchTerm('');
    setActiveFilters({});
    setQuickAddColumns([]);
    setQuickAddRows([]);
    setQuickAddValues([]);
    setQuickAddFiltersState([]);
    setIsConfigureSummaryModalOpen(false);
    setSelectedRowIds(new Set());
    setIsTableMenuOpen(false);
  }, [processedData]);

  const handleToggleColumnVisibility = (headerName: string) => {
    setVisibleColumns(prev => ({ ...prev, [headerName]: !prev[headerName] }));
  };
  const handleSelectAllColumns = () => {
    const newVisibility: Record<string, boolean> = {};
    allHeaders.forEach(header => { newVisibility[header] = true; });
    setVisibleColumns(newVisibility);
  };
  const handleUnselectAllColumns = () => {
    const newVisibility: Record<string, boolean> = {};
    allHeaders.forEach(header => { newVisibility[header] = false; });
    setVisibleColumns(newVisibility);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tableMenuRef.current && !tableMenuRef.current.contains(event.target as Node)) {
        setIsTableMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleGenerateSummary = () => {
    if (!processedData) return;
    const filteredDataForSummary = [...filteredAndSearchedData]; 
    const newProcessedDataForSummary: ProcessedData = {
        fileName: `Filtered: ${processedData.fileName}`,
        sheetName: processedData.sheetName,
        data: filteredDataForSummary,
        headers: allHeaders, 
    };
    const newPivotConfigForSummary: PivotConfig = {
        rows: quickAddRows.map(field => ({ field })),
        columns: quickAddColumns.map(field => ({ field })),
        values: quickAddValues.map(field => {
            const aggregation = isNumericDataField(field, filteredDataForSummary) ? AggregationType.SUM : AggregationType.COUNT_NON_EMPTY;
            return { field, aggregation };
        }),
        filters: [], 
        calculatedMeasures: [], // Ensure this is initialized
    };
    const tempCombinedFilters = new Map<string, string[]>();
    Object.entries(activeFilters).forEach(([field, values]) => {
        tempCombinedFilters.set(field, values);
    });
    quickAddFiltersState.forEach(field => {
        if (!tempCombinedFilters.has(field)) tempCombinedFilters.set(field, []); 
    });
    newPivotConfigForSummary.filters = Array.from(tempCombinedFilters.entries())
        .map(([field, selectedValues]) => ({ field, selectedValues }));
    if (newPivotConfigForSummary.values.length === 0) {
        const summaryHeaders = filteredDataForSummary.length > 0 ? Object.keys(filteredDataForSummary[0]).filter(h => h !== '__ROW_ID__') : allHeaders;
        const numericColsInSummary = summaryHeaders.filter(h => isNumericDataField(h, filteredDataForSummary));
        if (numericColsInSummary.length > 0) newPivotConfigForSummary.values.push({ field: numericColsInSummary[0], aggregation: AggregationType.SUM });
        else if (summaryHeaders.length > 0) newPivotConfigForSummary.values.push({ field: summaryHeaders[0], aggregation: AggregationType.COUNT_NON_EMPTY });
    }
    if (newPivotConfigForSummary.rows.length === 0 && Object.keys(activeFilters).length > 0 && quickAddFiltersState.length === 0) { 
        newPivotConfigForSummary.rows = Object.keys(activeFilters).map(header => ({ field: header }));
    }
    setGlobalProcessedData(newProcessedDataForSummary, { overridePivotConfig: newPivotConfigForSummary });
    setQuickAddRows([]); setQuickAddColumns([]); setQuickAddValues([]); setQuickAddFiltersState([]); 
    setIsConfigureSummaryModalOpen(false);
    navigate('/table-summary');
  };

  const handleInsertColumn = () => {
    if (!processedData || !newColumnName.trim()) { alert("New column name cannot be empty."); return; }
    const trimmedNewColumnName = newColumnName.trim();
    if (allHeaders.includes(trimmedNewColumnName)) { alert("Column name already exists."); return; }
    let insertAtIndex = -1;
    switch (columnInsertPosition) {
        case 'start': insertAtIndex = 0; break;
        case 'end': insertAtIndex = allHeaders.length; break;
        case 'before': case 'after':
            if (!columnInsertTarget) { alert("Please select a target column for insertion."); return; }
            const targetIndex = allHeaders.indexOf(columnInsertTarget);
            if (targetIndex === -1) { alert("Target column not found."); return; }
            insertAtIndex = columnInsertPosition === 'before' ? targetIndex : targetIndex + 1;
            break;
    }
    const updatedHeaders = [...allHeaders];
    updatedHeaders.splice(insertAtIndex, 0, trimmedNewColumnName);
    const updatedData = data.map(row => ({ ...row, [trimmedNewColumnName]: newColumnDefaultValue }));
    setGlobalProcessedData({ ...processedData, headers: updatedHeaders, data: updatedData }, { isUserAction: true });
    setVisibleColumns(prev => ({...prev, [trimmedNewColumnName]: true}));
    setNewColumnName(''); setNewColumnDefaultValue(''); setColumnInsertPosition('end');
    setColumnInsertTarget(allHeaders.length > 0 ? allHeaders[0] : '');
    setIsInsertColumnModalOpen(false);
  };

  const handleDeleteColumns = () => {
    if (!processedData || columnsToDelete.length === 0) return;
    if (!window.confirm(`Are you sure you want to delete ${columnsToDelete.length} column(s)? This cannot be undone.`)) return;
    const updatedHeaders = allHeaders.filter(h => !columnsToDelete.includes(h));
    const updatedData = data.map(row => {
        const newRow: DataRow = { __ROW_ID__: row.__ROW_ID__ };
        updatedHeaders.forEach(header => { newRow[header] = row[header]; });
        return newRow;
    });
    const newActiveFilters = { ...activeFilters };
    columnsToDelete.forEach(col => delete newActiveFilters[col]);
    setActiveFilters(newActiveFilters);
    setQuickAddColumns(prev => prev.filter(col => !columnsToDelete.includes(col)));
    setQuickAddRows(prev => prev.filter(col => !columnsToDelete.includes(col)));
    setQuickAddValues(prev => prev.filter(col => !columnsToDelete.includes(col)));
    setQuickAddFiltersState(prev => prev.filter(col => !columnsToDelete.includes(col)));
    setGlobalProcessedData({ ...processedData, headers: updatedHeaders, data: updatedData }, { isUserAction: true });
    setColumnsToDelete([]); setIsDeleteColumnModalOpen(false);
  };

  const handleEditHeaders = () => {
    if (!processedData) return;
    const newHeaders = allHeaders.map(oldH => headerEdits[oldH] || oldH);
    if (new Set(newHeaders).size !== newHeaders.length) { alert("New header names must be unique."); return; }
    const updatedData = data.map(row => {
        const newRow: DataRow = { __ROW_ID__: row.__ROW_ID__ };
        allHeaders.forEach(oldHeader => {
            const newHeader = headerEdits[oldHeader] || oldHeader;
            newRow[newHeader] = row[oldHeader];
        });
        return newRow;
    });
    const newActiveFilters: FilterState = {};
    Object.entries(activeFilters).forEach(([oldH, values]) => {
        const newH = headerEdits[oldH] || oldH;
        newActiveFilters[newH] = values;
    });
    setActiveFilters(newActiveFilters);
    const updateHeaderList = (list: string[]) => list.map(h => headerEdits[h] || h);
    setQuickAddColumns(prev => updateHeaderList(prev));
    setQuickAddRows(prev => updateHeaderList(prev));
    setQuickAddValues(prev => updateHeaderList(prev));
    setQuickAddFiltersState(prev => updateHeaderList(prev));
    setGlobalProcessedData({ ...processedData, headers: newHeaders, data: updatedData }, { isUserAction: true });
    setIsEditHeadersModalOpen(false);
  };

  const handleInsertRow = () => {
    if (!processedData) return;
    const newRowId = `${processedData.fileName}-custom-${Date.now()}`;
    const fullNewRow: DataRow = { __ROW_ID__: newRowId };
    allHeaders.forEach(header => { fullNewRow[header] = newRowData[header] ?? null; });
    let updatedData = [...data]; let insertAtIndex = -1;
    switch (rowInsertPosition) {
        case 'start': insertAtIndex = 0; break;
        case 'end': insertAtIndex = updatedData.length; break;
        case 'beforeSelected': case 'afterSelected':
            if (selectedRowIds.size !== 1) { alert("Please select exactly one row to insert before/after."); return;}
            const targetRowId = Array.from(selectedRowIds)[0];
            const targetIndexInOriginalData = data.findIndex(row => row.__ROW_ID__ === targetRowId);
            if (targetIndexInOriginalData === -1) { alert("Selected row not found."); return; }
            insertAtIndex = rowInsertPosition === 'beforeSelected' ? targetIndexInOriginalData : targetIndexInOriginalData + 1;
            break;
    }
    updatedData.splice(insertAtIndex, 0, fullNewRow);
    setGlobalProcessedData({ ...processedData, data: updatedData }, { isUserAction: true });
    setNewRowData({}); setRowInsertPosition('end'); setIsInsertRowModalOpen(false);
  };

  const handleToggleRowSelection = (rowId: string) => {
    setSelectedRowIds(prev => {
        const newSet = new Set(prev);
        if (newSet.has(rowId)) newSet.delete(rowId); else newSet.add(rowId);
        return newSet;
    });
  };

  const handleSelectAllVisibleRows = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newSelectedRowIds = new Set(selectedRowIds);
    if (e.target.checked) paginatedData.forEach(row => row.__ROW_ID__ && newSelectedRowIds.add(row.__ROW_ID__));
    else paginatedData.forEach(row => row.__ROW_ID__ && newSelectedRowIds.delete(row.__ROW_ID__));
    setSelectedRowIds(newSelectedRowIds);
  };
  const allVisibleSelected = paginatedData.length > 0 && paginatedData.every(row => row.__ROW_ID__ && selectedRowIds.has(row.__ROW_ID__));

  const handleDeleteSelectedRows = () => {
    if (!processedData || selectedRowIds.size === 0) return;
    if (!window.confirm(`Are you sure you want to delete ${selectedRowIds.size} row(s)? This cannot be undone.`)) return;
    const updatedData = data.filter(row => !row.__ROW_ID__ || !selectedRowIds.has(row.__ROW_ID__));
    setGlobalProcessedData({ ...processedData, data: updatedData }, { isUserAction: true });
    setSelectedRowIds(new Set());
  };

  const evaluateFormulaForRow = (formula: string, row: DataRow, currentAllHeaders: string[]): number | string | null => {
    let formulaToEvaluate = formula;
    currentAllHeaders.forEach(header => {
        const regex = new RegExp(`\\[${header.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\]`, 'g');
        formulaToEvaluate = formulaToEvaluate.replace(regex, `Number(data["${header}"])`);
    });
    try {
        const func = new Function('data', `try { return ${formulaToEvaluate}; } catch(e) { return null; }`);
        const result = func(row);
        return (typeof result === 'number' && !isNaN(result)) ? result : null;
    } catch (error) { console.warn(`Error evaluating formula: ${error}`, formula, row); return null; }
  };

  const handleAddCalculatedColumn = () => {
    if (!processedData || !calculatedColumnName.trim()) { alert("Calculated column name cannot be empty."); return; }
    const trimmedName = calculatedColumnName.trim();
    if (allHeaders.includes(trimmedName)) { alert("Column name already exists."); return; }
    if (!calculatedColumnFormula.trim()) { alert("Formula cannot be empty."); return; }
    let openParen = 0;
    for (const char of calculatedColumnFormula) {
        if (char === '(') openParen++; else if (char === ')') openParen--;
        if (openParen < 0) { alert("Formula has unbalanced parentheses."); return; }
    }
    if (openParen !== 0) { alert("Formula has unbalanced parentheses."); return; }
    const updatedHeaders = [...allHeaders, trimmedName];
    const updatedData = data.map(row => ({ ...row, [trimmedName]: evaluateFormulaForRow(calculatedColumnFormula, row, allHeaders) }));
    setGlobalProcessedData({ ...processedData, headers: updatedHeaders, data: updatedData }, { isUserAction: true });
    setVisibleColumns(prev => ({ ...prev, [trimmedName]: true }));
    setCalculatedColumnName(''); setCalculatedColumnFormula(''); setIsAddCalculatedColumnModalOpen(false);
  };
  
  const insertFieldIntoFormula = (fieldName: string) => {
    if (formulaInputRef.current) {
        const start = formulaInputRef.current.selectionStart; const end = formulaInputRef.current.selectionEnd;
        const currentFormula = calculatedColumnFormula; const textToInsert = `[${fieldName}]`;
        setCalculatedColumnFormula(currentFormula.substring(0, start) + textToInsert + currentFormula.substring(end));
        setTimeout(() => {
            formulaInputRef.current?.focus();
            formulaInputRef.current?.setSelectionRange(start + textToInsert.length, start + textToInsert.length);
        }, 0);
    }
  };

  const handleSaveCurrentView = () => {
    if (!processedData || !newViewName.trim()) {
        alert("Please enter a name for this view.");
        return;
    }
    const currentViewConfig: Omit<DataTableViewConfig, 'id' | 'createdAt'> = {
        name: newViewName,
        associatedDataIdentifier: currentDataIdentifier,
        searchTerm,
        activeFilters,
        itemsPerPage,
        visibleColumns,
        tableFont,
        tableFontSize,
        tableThemeName: tableTheme.name,
    };
    saveDataTableView(currentViewConfig);
    setNewViewName(''); // Clear name for next save
    // Potentially close modal or show success message
  };

  const handleLoadView = (viewId: string) => {
    const viewToLoad = loadDataTableView(viewId);
    if (viewToLoad && viewToLoad.associatedDataIdentifier === currentDataIdentifier) {
        setSearchTerm(viewToLoad.searchTerm);
        setActiveFilters(viewToLoad.activeFilters);
        setItemsPerPage(viewToLoad.itemsPerPage);
        setVisibleColumns(viewToLoad.visibleColumns);
        setTableFont(viewToLoad.tableFont);
        setTableFontSize(viewToLoad.tableFontSize);
        setTableTheme(viewToLoad.tableThemeName);
        setCurrentPage(1); // Reset to first page
        setIsManageViewsModalOpen(false);
    } else if (viewToLoad) {
        alert("This view configuration is for a different dataset and cannot be applied.");
    } else {
        alert("View not found.");
    }
  };

  const relevantSavedViews = useMemo(() => {
    return savedDataTableViews.filter(view => view.associatedDataIdentifier === currentDataIdentifier);
  }, [savedDataTableViews, currentDataIdentifier]);

  const handlePrepareExport = () => {
    if (!processedData) return;
    setExportFileName(processedData.fileName.replace(/\.[^/.]+$/, "") || 'exported_data');
    setExportFormat(defaultExportFormat);
    setExportScope('currentView');
    setIsExportModalOpen(true);
    setIsTableMenuOpen(false); // Close table menu after opening export modal
  };

  const handlePerformExport = () => {
    if (!processedData) return;

    let dataToExport: DataRow[];
    let headersForExport: string[];

    if (exportScope === 'currentView') {
      dataToExport = filteredAndSearchedData;
      headersForExport = headersCurrentlyVisible;
    } else { // allData
      dataToExport = processedData.data;
      headersForExport = processedData.headers;
    }
    
    const finalFileName = exportFileName.trim() || 'exported_data';

    switch (exportFormat) {
      case 'xlsx':
        exportTableToExcel(dataToExport, finalFileName, headersForExport);
        break;
      case 'csv':
        exportTableToCSV(dataToExport, finalFileName, headersForExport);
        break;
      case 'json':
        exportTableToJson(dataToExport, finalFileName, headersForExport);
        break;
    }
    setIsExportModalOpen(false);
  };


  if (!processedData) {
    return (
      <div className={`p-8 ${theme.textColor} flex flex-col items-center justify-center h-full`}>
        <AlertTriangle size={48} className={`text-${theme.accent4} mb-4`} />
        <h2 className="text-2xl font-semibold">No Data Loaded</h2>
        <p className="opacity-70">Please import a file from the 'Import Data' section to view it here.</p>
      </div>
    );
  }
  
  const FilterIconComponent = LUCIDE_FILTER_ICON || FilterIconLucide;
  const header3DStyle: React.CSSProperties = { textShadow: '0px 1px 1px rgba(0,0,0,0.1)', boxShadow: 'inset 0px 1px 1px rgba(0,0,0,0.05)', color: tableTheme.headerColor.startsWith('text-') ? RAW_COLOR_VALUES[tableTheme.headerColor.replace('text-','')] || tableTheme.headerColor : tableTheme.headerColor };
  const dataCellTransitionClass = reduceMotion ? '' : 'transition-colors duration-150 ease-out';
  const tableClasses = `min-w-full divide-y ${tableTheme.borderColor} ${tableFont} ${tableFontSize}`;
  const headerClasses = `${tableTheme.headerBg} sticky top-0 z-10`; 
  const headerCellClasses = `text-left font-bold uppercase tracking-wider whitespace-nowrap`;
  const bodyClasses = `${tableTheme.textColor} divide-y ${tableTheme.borderColor}`; // Added theme.textColor
  const cellClasses = `whitespace-nowrap`;
  
  const commonSelectStyles = getSharedSelectBaseStyles(theme);
  const itemsPerPageSelectStyles = getSharedSelectBaseStyles(theme, 'text-xs');
  
  const filterDropdownTextColor = RAW_COLOR_VALUES[theme.textColor.replace('text-', '')] || '#E0E0E0';
  const filterDropdownItemHoverBg = RAW_COLOR_VALUES[theme.mediumGray] || '#333F58';

  const editTableActionItems = [
    { label: "Insert Column", icon: Columns, action: () => setIsInsertColumnModalOpen(true) },
    { label: "Delete Column(s)", icon: Trash2, action: () => setIsDeleteColumnModalOpen(true) },
    { label: "Edit Headers", icon: Edit3, action: () => setIsEditHeadersModalOpen(true) },
    { label: "Insert Row", icon: Rows, action: () => setIsInsertRowModalOpen(true) },
    { label: "Delete Selected Rows", icon: Trash2, action: handleDeleteSelectedRows, disabled: selectedRowIds.size === 0 },
    { label: "Add Calculated Column", icon: Calculator, action: () => setIsAddCalculatedColumnModalOpen(true) },
  ];

  const cellBasePadding = 'px-3 py-2';

  return (
    <div className={`p-4 md:p-6 ${theme.textColor} h-full flex flex-col`}>
      <div className="mb-4 flex flex-col md:flex-row justify-between md:items-center gap-3">
        <div>
            <h1 className={`text-2xl md:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-${theme.accent1} to-${theme.accent2}`}>
              Data Table: {processedData.fileName}
              {processedData.sheetName && <span className="text-base opacity-80"> ({processedData.sheetName})</span>}
            </h1>
            <p className="text-xs opacity-70 mt-1">
              Displaying {paginatedData.length} of {filteredAndSearchedData.length} (Total: {data.length}) records.
              {headers.length !== allHeaders.length && ` (${headers.length} of ${allHeaders.length} columns shown).`}
            </p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
            <div className="relative" ref={tableMenuRef}>
              <Button 
                onClick={() => setIsTableMenuOpen(prev => !prev)} 
                variant="secondary" 
                size="sm" 
                leftIcon={<SlidersHorizontal size={16} />} 
                rightIcon={<ChevronDown size={14} />}
              >
                Table Menu
              </Button>
              {isTableMenuOpen && (
                <div 
                  className={`absolute right-0 mt-1 w-64 p-2 rounded-lg shadow-2xl z-30 border ${theme.cardBg} border-${theme.borderColor} max-h-96 overflow-y-auto futuristic-scrollbar`}
                >
                  <Button variant="ghost" size="sm" onClick={() => { handleSaveToLibrary(); setIsTableMenuOpen(false); }} className={`w-full justify-start text-sm ${theme.textColor} hover:bg-${theme.mediumGray}/30 hover:text-${theme.accent1}`} leftIcon={<Save size={16} />} > Save to Library </Button>
                  <Button variant="ghost" size="sm" onClick={handlePrepareExport} className={`w-full justify-start text-sm ${theme.textColor} hover:bg-${theme.mediumGray}/30 hover:text-${theme.accent1}`} leftIcon={<Download size={16}/>} > Export Data </Button>
                  <hr className={`my-2 ${theme.borderColor}`} />
                  <Button variant="ghost" size="sm" onClick={() => { undoDataTableChange(); setIsTableMenuOpen(false); }} disabled={!canUndoDataTable} className={`w-full justify-start text-sm ${theme.textColor} hover:bg-${theme.mediumGray}/30 hover:text-${theme.accent1}`} leftIcon={<Undo size={16} />} > Undo </Button>
                  <Button variant="ghost" size="sm" onClick={() => { redoDataTableChange(); setIsTableMenuOpen(false); }} disabled={!canRedoDataTable} className={`w-full justify-start text-sm ${theme.textColor} hover:bg-${theme.mediumGray}/30 hover:text-${theme.accent1}`} leftIcon={<Redo size={16} />} > Redo </Button>
                  <hr className={`my-2 ${theme.borderColor}`} />
                  <p className={`text-xs font-semibold px-2 py-1 text-${theme.accent4}`}>Edit Table</p>
                  {editTableActionItems.map(item => (
                    <Button
                      key={item.label} variant="ghost" size="sm"
                      onClick={() => { item.action(); setIsTableMenuOpen(false); }}
                      disabled={item.disabled}
                      className={`w-full justify-start text-sm ${theme.textColor} hover:bg-${theme.mediumGray}/30 hover:text-${theme.accent1}`}
                      leftIcon={<item.icon size={16} />}
                    >
                      {item.label}
                    </Button>
                  ))}
                  <hr className={`my-2 ${theme.borderColor}`} />
                  <p className={`text-xs font-semibold px-2 py-1 text-${theme.accent4}`}>View Options</p>
                  <Button variant="ghost" size="sm" onClick={() => { setIsPreferencesOpen(true); setIsTableMenuOpen(false); }} className={`w-full justify-start text-sm ${theme.textColor} hover:bg-${theme.mediumGray}/30 hover:text-${theme.accent1}`} leftIcon={<Settings2 size={16}/>} > Display Preferences </Button>
                </div>
              )}
            </div>
        </div>
      </div>
      
      <div className={`mb-4 p-3 ${theme.cardBg} rounded-lg shadow-lg border ${theme.borderColor} flex flex-col md:flex-row items-center gap-3 flex-wrap`}>
        <div className="relative flex-grow w-full md:w-auto md:min-w-[200px]">
          <Search size={18} className={`absolute left-3 top-1/2 transform -translate-y-1/2 text-${theme.accent3}`} />
          <Input type="text" placeholder="Search table..." value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1);}} className={`w-full pl-10 pr-3 py-1.5 text-xs placeholder-opacity-50`} aria-label="Search data table" />
        </div>
         <Button onClick={() => setIsColumnVisibilityModalOpen(true)} variant="secondary" size="sm" leftIcon={<Eye size={16}/>} title="Column Visibility" > Show/Hide Columns ({headers.length}/{allHeaders.length}) </Button>
        <Button onClick={() => setIsManageViewsModalOpen(true)} variant="secondary" size="sm" leftIcon={<View size={16}/>} title="Manage Saved Views" > Manage Views </Button>
        <Button onClick={() => setIsConfigureSummaryModalOpen(true)} variant="secondary" size="sm" leftIcon={<PackagePlus size={16}/>} title="Configure fields for quick summary generation" > Configure Summary Fields </Button>
      </div>

      <div className={`flex-grow overflow-auto futuristic-scrollbar border ${tableTheme.borderColor} rounded-lg shadow-2xl ${tableTheme.tableBg}`}>
        <table className={tableClasses}>
          <thead className={headerClasses}>
            <tr>
              <th scope="col" className={`${headerCellClasses} ${tableTheme.headerBg} sticky left-0 z-[15]`} style={{ ...header3DStyle, width: '3.5rem', minWidth: '3.5rem', maxWidth: '3.5rem', padding: '0.5rem 0.75rem' }} >
                <input type="checkbox" className={`form-checkbox h-4 w-4 rounded border-${theme.mediumGray} text-${theme.accent1} focus:ring-1 focus:ring-offset-0 focus:ring-${theme.accent1}`} style={{ accentColor: RAW_COLOR_VALUES[theme.accent1]}} checked={allVisibleSelected} onChange={handleSelectAllVisibleRows} aria-label="Select all visible rows" />
              </th>
              {headers.map((header) => ( 
                <th key={header} scope="col" className={`${headerCellClasses} ${tableTheme.headerBg} ${cellBasePadding}`} style={header3DStyle}>
                  <div className="flex items-center justify-between">
                    <span>{header}</span>
                    <div className="relative">
                      <button onClick={() => toggleDropdown(header)} className={`ml-2 p-1 rounded hover:bg-black/30 transition-colors`}>
                        <FilterIconComponent size={16} className={`${activeFilters[header]?.length ? `text-${theme.accent1}`: tableTheme.filterIconColor }`} />
                      </button>
                      {openDropdown === header && (
                        <div className={`absolute right-0 mt-2 w-56 border rounded-md shadow-2xl z-20 p-2 max-h-60 overflow-y-auto futuristic-scrollbar`} style={{ backgroundColor: RAW_COLOR_VALUES[theme.darkGray], borderColor: RAW_COLOR_VALUES[theme.mediumGray] }} >
                          <p className={`text-xs px-2 py-1 opacity-70`} style={{color: filterDropdownTextColor}}>Filter by {header}:</p>
                          {uniqueFilterValues[header]?.length > 0 ? uniqueFilterValues[header].map(value => {
                            const isSelected = activeFilters[header]?.includes(value);
                            const tempOtherFilters = {...activeFilters}; delete tempOtherFilters[header]; 
                            const count = data.filter(row => String(row[header]) === value && Object.entries(tempOtherFilters).every(([filterH, selectedVs]) => selectedVs.length === 0 || selectedVs.includes(String(row[filterH])))).length;
                            return (
                              <label key={value} className={`flex items-center space-x-2 px-2 py-1.5 rounded cursor-pointer text-sm hover:bg-[${filterDropdownItemHoverBg}]`} style={{color: filterDropdownTextColor}}>
                                <input type="checkbox" checked={isSelected} onChange={() => handleFilterChange(header, value)} className={`form-checkbox h-4 w-4 rounded border-${theme.mediumGray} focus:ring-${theme.accent1}/50`} style={{ backgroundColor: RAW_COLOR_VALUES[theme.darkGray], color: RAW_COLOR_VALUES[theme.accent1] }} />
                                <span className="flex-grow truncate" title={value}>{value || '(empty)'}</span>
                                <span className={`text-xs opacity-60 ${isSelected ? `text-${theme.accent1}`:''}`}>({count})</span>
                              </label>
                            );
                          }) : <p className={`px-2 py-1 text-sm opacity-60`} style={{color: filterDropdownTextColor}}>No values to filter.</p>}
                        </div>
                      )}
                    </div>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className={bodyClasses}>
            {paginatedData.map((row, rowIndex) => {
              const rowId = row.__ROW_ID__; const isSelected = rowId ? selectedRowIds.has(rowId) : false;
              const isRowHighlighted = searchTerm && allHeaders.some(header => String(row[header]).toLowerCase().includes(searchTerm.toLowerCase()));
              let rowBaseBgClass = (tableTheme.rowAltBg && rowIndex % 2 !== 0) ? tableTheme.rowAltBg : tableTheme.rowBg;
              if (isRowHighlighted) rowBaseBgClass = `${tableTheme.highlightRowBg}`; 
              if (isSelected) rowBaseBgClass = `bg-${theme.accent1}/30`;
              return (
                <tr key={rowId || rowIndex} className={`${rowBaseBgClass} ${tableTheme.rowHoverBg}`}>
                  <td className={`${cellClasses} ${tableTheme.borderColor} sticky left-0 z-[5] ${rowBaseBgClass}`} style={{ width: '3.5rem', minWidth: '3.5rem', maxWidth: '3.5rem', padding: '0.5rem 0.75rem' }} >
                    {rowId && (<input type="checkbox" className={`form-checkbox h-4 w-4 rounded border-${theme.mediumGray} text-${theme.accent1} focus:ring-1 focus:ring-offset-0 focus:ring-${theme.accent1}`} style={{ accentColor: RAW_COLOR_VALUES[theme.accent1]}} checked={isSelected} onChange={() => handleToggleRowSelection(rowId)} aria-label={`Select row ${rowIndex + 1}`} />)}
                  </td>
                  {headers.map(header => (<td key={`${rowId || rowIndex}-${header}`} className={`${cellClasses} ${tableTheme.borderColor} ${dataCellTransitionClass} ${rowBaseBgClass} ${cellBasePadding}`}>{String(row[header])}</td>))}
                </tr>);
            })}
          </tbody>
        </table>
        {paginatedData.length === 0 && (<div className={`text-center py-10 ${tableTheme.textColor}`}><p className="text-lg">No data matches filters/search.</p><p className="text-sm opacity-70">Adjust criteria.</p></div>)}
      </div>
      
      {totalPages > 1 && (
        <div className={`mt-4 p-2 ${theme.cardBg} rounded-lg shadow-md border ${theme.borderColor} flex items-center justify-between text-xs`}>
          <Button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} variant="secondary" size="sm">Previous</Button>
          <div className="flex items-center gap-2">
            <span className={`${theme.textColor}`}>Page {currentPage} of {totalPages}</span>
            <span className="opacity-70">|</span>
            <label htmlFor="itemsPerPage" className="opacity-80">Rows:</label>
            <select
              id="itemsPerPage"
              value={itemsPerPage}
              onChange={(e) => {setItemsPerPage(Number(e.target.value)); setCurrentPage(1);}}
              className={`${itemsPerPageSelectStyles.baseClassName} !py-1 !px-1.5 !w-auto`}
              style={{
                ...itemsPerPageSelectStyles.style,
                paddingRight: '1.5rem', 
                backgroundPosition: 'right 0.25rem center',
              }}
              aria-label="Select number of rows per page"
            >
              {[10, 25, 50, 100].map(num => <option key={num} value={num} style={itemsPerPageSelectStyles.optionStyle}>{num}</option>)}
            </select>
          </div>
          <Button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} variant="secondary" size="sm">Next</Button>
        </div>
      )}

      <Modal isOpen={isManageViewsModalOpen} onClose={() => setIsManageViewsModalOpen(false)} title="Manage Data Table Views" size="lg">
        <div className="space-y-4">
            <div>
                <h4 className={`text-md font-semibold mb-2 text-${theme.accent1}`}>Save Current View</h4>
                <div className="flex gap-2">
                    <Input 
                        type="text" 
                        value={newViewName} 
                        onChange={(e) => setNewViewName(e.target.value)}
                        placeholder="Enter view name..."
                        className="flex-grow"
                    />
                    <Button onClick={handleSaveCurrentView} variant="primary" size="md" disabled={!newViewName.trim()}>Save View</Button>
                </div>
            </div>
            <hr className={theme.borderColor} />
            <div>
                <h4 className={`text-md font-semibold mb-2 text-${theme.accent2}`}>Load Saved View (for current data)</h4>
                {relevantSavedViews.length > 0 ? (
                    <ul className="space-y-2 max-h-60 overflow-y-auto futuristic-scrollbar pr-1">
                        {relevantSavedViews.map(view => (
                            <li key={view.id} className={`p-2 border rounded-md ${theme.borderColor} flex justify-between items-center bg-${theme.mediumGray}/20`}>
                                <div>
                                    <p className="font-medium">{view.name}</p>
                                    <p className="text-xs opacity-70">Saved: {new Date(view.createdAt).toLocaleString()}</p>
                                </div>
                                <div className="flex gap-2">
                                    <Button onClick={() => handleLoadView(view.id)} variant="secondary" size="sm">Load</Button>
                                    <Button onClick={() => {if(window.confirm(`Delete view "${view.name}"?`)) deleteDataTableView(view.id)}} variant="danger" size="sm"><Trash2 size={14}/></Button>
                                </div>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-sm opacity-70">No saved views for this specific dataset yet.</p>
                )}
            </div>
            <div className="flex justify-end mt-4">
                <Button variant="secondary" onClick={() => setIsManageViewsModalOpen(false)}>Close</Button>
            </div>
        </div>
      </Modal>

      <Modal isOpen={isConfigureSummaryModalOpen} onClose={() => setIsConfigureSummaryModalOpen(false)} title="Configure Summary Fields" size="full" >
        <div className="space-y-4">
            <h4 className={`text-sm font-semibold mb-2 text-${theme.accent4}`}>Configure Fields for Pivot Summary</h4>
            {headersCurrentlyVisible.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <MultiSelectDropdown label="Add to Columns" options={headersCurrentlyVisible} selectedOptions={quickAddColumns} onSelectionChange={setQuickAddColumns} theme={theme} />
                    <MultiSelectDropdown label="Add to Rows" options={headersCurrentlyVisible} selectedOptions={quickAddRows} onSelectionChange={setQuickAddRows} theme={theme} />
                    <MultiSelectDropdown label="Add to Values" options={headersCurrentlyVisible} selectedOptions={quickAddValues} onSelectionChange={setQuickAddValues} theme={theme} />
                    <MultiSelectDropdown label="Add to Filters (Pivot)" options={headersCurrentlyVisible} selectedOptions={quickAddFiltersState} onSelectionChange={setQuickAddFiltersState} theme={theme} />
                </div>
            ) : ( <p className={`text-xs ${theme.textColor} opacity-70`}>Make columns visible to configure fields.</p> )}
            <div className="flex justify-end gap-2 mt-6">
                <Button variant="secondary" onClick={() => setIsConfigureSummaryModalOpen(false)}>Cancel</Button>
                <Button variant="primary" onClick={handleGenerateSummary} leftIcon={<ExternalLink size={16}/>}>Generate Summary</Button>
            </div>
        </div>
      </Modal>
      <Modal isOpen={isColumnVisibilityModalOpen} onClose={() => setIsColumnVisibilityModalOpen(false)} title={`Select Columns to Display (${headers.length}/${allHeaders.length})`} size="md">
        <div className="flex justify-between items-center mb-4">
            <Button variant="secondary" size="sm" onClick={handleSelectAllColumns}>Select All</Button>
            <Button variant="secondary" size="sm" onClick={handleUnselectAllColumns}>Unselect None</Button>
        </div>
        <div className="space-y-2 max-h-96 overflow-y-auto futuristic-scrollbar pr-2">
            {allHeaders.map(headerName => (
                <label key={headerName} className={`flex items-center space-x-3 p-2 rounded-md cursor-pointer hover:bg-${theme.mediumGray}/30 transition-colors`}>
                    <input type="checkbox" checked={visibleColumns[headerName] || false} onChange={() => handleToggleColumnVisibility(headerName)} className={`form-checkbox h-4 w-4 rounded border-${theme.mediumGray} text-${theme.accent1} focus:ring-1 focus:ring-offset-0 focus:ring-${theme.accent1}`} style={{ accentColor: RAW_COLOR_VALUES[theme.accent1] }} />
                    <span className={`text-sm ${theme.textColor}`}>{headerName}</span>
                </label>
            ))}
        </div>
        <div className="mt-6 flex justify-end"><Button variant="primary" onClick={() => setIsColumnVisibilityModalOpen(false)}>Apply & Close</Button></div>
      </Modal>
      <Modal isOpen={isInsertColumnModalOpen} onClose={() => setIsInsertColumnModalOpen(false)} title="Insert New Column">
        <div className="space-y-4">
          <div><label htmlFor="newColName" className={`block text-sm font-medium mb-1 ${theme.textColor}`}>Name</label><Input id="newColName" value={newColumnName} onChange={(e) => setNewColumnName(e.target.value)} placeholder="Unique column name" /></div>
          <div><label htmlFor="newColDefVal" className={`block text-sm font-medium mb-1 ${theme.textColor}`}>Default Value</label><Input id="newColDefVal" value={newColumnDefaultValue} onChange={(e) => setNewColumnDefaultValue(e.target.value)} placeholder="(optional)" /></div>
          <div><label htmlFor="colInsPos" className={`block text-sm font-medium mb-1 ${theme.textColor}`}>Position</label><select id="colInsPos" value={columnInsertPosition} onChange={e => setColumnInsertPosition(e.target.value as any)} className={`${commonSelectStyles.baseClassName} w-full p-2`} style={commonSelectStyles.style}><option value="start" style={commonSelectStyles.optionStyle}>Start</option><option value="end" style={commonSelectStyles.optionStyle}>End</option><option value="before" style={commonSelectStyles.optionStyle}>Before Column</option><option value="after" style={commonSelectStyles.optionStyle}>After Column</option></select></div>
          {(columnInsertPosition === 'before' || columnInsertPosition === 'after') && (<div><label htmlFor="colInsTarget" className={`block text-sm font-medium mb-1 ${theme.textColor}`}>Target</label><select id="colInsTarget" value={columnInsertTarget} onChange={e => setColumnInsertTarget(e.target.value)} className={`${commonSelectStyles.baseClassName} w-full p-2`} style={commonSelectStyles.style} disabled={allHeaders.length === 0}>{allHeaders.map(h => <option key={h} value={h} style={commonSelectStyles.optionStyle}>{h}</option>)}</select></div>)}
          <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setIsInsertColumnModalOpen(false)}>Cancel</Button><Button variant="primary" onClick={handleInsertColumn}>Insert</Button></div>
        </div>
      </Modal>
      <Modal isOpen={isDeleteColumnModalOpen} onClose={() => setIsDeleteColumnModalOpen(false)} title="Delete Columns">
        <div className="space-y-3 max-h-96 overflow-y-auto futuristic-scrollbar"><p className="text-sm opacity-80">Select columns to delete:</p>{allHeaders.map(header => (<label key={header} className={`flex items-center space-x-2 p-1.5 rounded hover:bg-${theme.mediumGray}/30 cursor-pointer`}><input type="checkbox" className={`form-checkbox h-4 w-4 rounded border-${theme.mediumGray} text-${theme.accent1} focus:ring-1 focus:ring-offset-0 focus:ring-${theme.accent1}`} style={{ accentColor: RAW_COLOR_VALUES[theme.accent1]}} checked={columnsToDelete.includes(header)} onChange={() => setColumnsToDelete(prev => prev.includes(header) ? prev.filter(h => h !== header) : [...prev, header])} /><span>{header}</span></label>))}</div>
        <div className="flex justify-end gap-2 mt-4"><Button variant="secondary" onClick={() => setIsDeleteColumnModalOpen(false)}>Cancel</Button><Button variant="danger" onClick={handleDeleteColumns} disabled={columnsToDelete.length === 0}>Delete Selected</Button></div>
      </Modal>
      <Modal isOpen={isEditHeadersModalOpen} onClose={() => setIsEditHeadersModalOpen(false)} title="Edit Column Headers" size="lg">
        <div className="space-y-3 max-h-[70vh] overflow-y-auto futuristic-scrollbar pr-2">{allHeaders.map(oldHeader => (<div key={oldHeader} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2"><span className={`text-sm opacity-80 truncate text-right p-1 bg-${theme.darkGray} rounded`} title={oldHeader}>{oldHeader}</span><span className={`text-${theme.accent1}`}>➔</span><Input id={`edit-header-${oldHeader.replace(/\s+/g, '-')}`} value={headerEdits[oldHeader] || ''} onChange={(e) => setHeaderEdits(prev => ({ ...prev, [oldHeader]: e.target.value }))} placeholder="New header name" className="!text-sm !p-1" /></div>))}</div>
        <div className="flex justify-end gap-2 mt-4"><Button variant="secondary" onClick={() => setIsEditHeadersModalOpen(false)}>Cancel</Button><Button variant="primary" onClick={handleEditHeaders}>Save Changes</Button></div>
      </Modal>
      <Modal isOpen={isInsertRowModalOpen} onClose={() => setIsInsertRowModalOpen(false)} title="Insert New Row" size="lg">
        <div className="space-y-3 max-h-[60vh] overflow-y-auto futuristic-scrollbar pr-2">{headers.map(header => (<div key={`add-row-${header}`}><label htmlFor={`add-row-input-${header.replace(/\s+/g, '-')}`} className={`block text-sm font-medium mb-1 ${theme.textColor}`}>{header}</label><Input id={`add-row-input-${header.replace(/\s+/g, '-')}`} value={String(newRowData[header] ?? '')} onChange={(e) => setNewRowData(prev => ({...prev, [header]: e.target.value}))} placeholder={`Value for ${header}`} className="!text-sm" /></div>))}</div>
        <div className="mt-4"><label htmlFor="rowInsPos" className={`block text-sm font-medium mb-1 ${theme.textColor}`}>Position</label><select id="rowInsPos" value={rowInsertPosition} onChange={e => setRowInsertPosition(e.target.value as any)} className={`${commonSelectStyles.baseClassName} w-full p-2`} style={commonSelectStyles.style}><option value="start" style={commonSelectStyles.optionStyle}>Start</option><option value="end" style={commonSelectStyles.optionStyle}>End</option><option value="beforeSelected" disabled={selectedRowIds.size !== 1} style={commonSelectStyles.optionStyle}>Before Selected</option><option value="afterSelected" disabled={selectedRowIds.size !== 1} style={commonSelectStyles.optionStyle}>After Selected</option></select>{(rowInsertPosition === 'beforeSelected' || rowInsertPosition === 'afterSelected') && selectedRowIds.size !== 1 && (<p className="text-xs text-red-400 mt-1">Select one row to use this option.</p>)}</div>
        <div className="flex justify-end gap-2 mt-4"><Button variant="secondary" onClick={() => setIsInsertRowModalOpen(false)}>Cancel</Button><Button variant="primary" onClick={handleInsertRow}>Insert Row</Button></div>
      </Modal>
      <Modal isOpen={isAddCalculatedColumnModalOpen} onClose={() => setIsAddCalculatedColumnModalOpen(false)} title="Add Calculated Column" size="lg">
        <div className="space-y-4">
            <div><label htmlFor="calcColName" className={`block text-sm font-medium mb-1 ${theme.textColor}`}>Name</label><Input id="calcColName" value={calculatedColumnName} onChange={(e) => setCalculatedColumnName(e.target.value)} placeholder="Unique column name" /></div>
            <div><label htmlFor="calcColFormula" className={`block text-sm font-medium mb-1 ${theme.textColor}`}>Formula</label><textarea id="calcColFormula" ref={formulaInputRef} value={calculatedColumnFormula} onChange={(e) => setCalculatedColumnFormula(e.target.value)} placeholder="e.g., [Revenue] - [Cost]" rows={4} className={`w-full p-2 rounded-md border focus:ring-2 focus:ring-${theme.accent1} focus:border-${theme.accent1} transition-colors futuristic-scrollbar text-sm`} style={{ backgroundColor: RAW_COLOR_VALUES[theme.darkGray], color: RAW_COLOR_VALUES[theme.textColor.replace('text-','')], borderColor: RAW_COLOR_VALUES[theme.mediumGray]}}/></div>
            <div><p className={`text-xs font-medium ${theme.textColor} opacity-80 mb-1`}>Fields (click to insert):</p><div className={`flex flex-wrap gap-1 max-h-28 overflow-y-auto futuristic-scrollbar p-1 border border-${theme.mediumGray} rounded-md`}>{allHeaders.map(header => (<Button key={`field-btn-${header}`} variant="ghost" size="sm" onClick={() => insertFieldIntoFormula(header)} className={`!text-xs !px-1.5 !py-0.5 bg-${theme.mediumGray}/30 hover:bg-${theme.accent1}/30`}>{header}</Button>))}</div><p className={`text-xs ${theme.textColor} opacity-70 mt-1`}>Operators: +, -, *, /, ()</p></div>
            <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setIsAddCalculatedColumnModalOpen(false)}>Cancel</Button><Button variant="primary" onClick={handleAddCalculatedColumn}>Add Column</Button></div>
        </div>
      </Modal>
      <Modal isOpen={isPreferencesOpen} onClose={() => setIsPreferencesOpen(false)} title="Table Display Preferences" size="md">
        <div className="space-y-6">
          <div>
            <label htmlFor="tblFontFamily" className={`block text-sm font-medium mb-1 ${theme.textColor}`}>Font Family</label>
            <select 
              id="tblFontFamily" 
              value={tableFont} 
              onChange={(e) => setTableFont(e.target.value)} 
              className={`${commonSelectStyles.baseClassName} w-full p-2`} 
              style={commonSelectStyles.style} 
              aria-label="Select table font family"
            >
              {tableFontOptions.map(font => (
                <option key={font.cssClass} value={font.cssClass} className={font.cssClass} style={commonSelectStyles.optionStyle}>{font.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="tblFontSize" className={`block text-sm font-medium mb-1 ${theme.textColor}`}>Font Size</label>
            <select 
              id="tblFontSize" 
              value={tableFontSize} 
              onChange={(e) => setTableFontSize(e.target.value)} 
              className={`${commonSelectStyles.baseClassName} w-full p-2`} 
              style={commonSelectStyles.style} 
              aria-label="Select table font size"
            >
              {tableFontSizeOptions.map(size => (
                <option key={size.cssClass} value={size.cssClass} style={commonSelectStyles.optionStyle}>{size.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="tblTheme" className={`block text-sm font-medium mb-1 ${theme.textColor}`}>Table Theme</label>
            <select 
              id="tblTheme" 
              value={tableTheme.name} 
              onChange={(e) => setTableTheme(e.target.value as TableThemeName)} 
              className={`${commonSelectStyles.baseClassName} w-full p-2`} 
              style={commonSelectStyles.style} 
              aria-label="Select table theme"
            >
              {Object.values(availableTableThemes).map(th => (
                <option key={th.name} value={th.name} style={commonSelectStyles.optionStyle}>{th.name}</option>
              ))}
            </select>
          </div>
          <div className="mt-6 flex justify-end">
            <Button variant="primary" onClick={() => setIsPreferencesOpen(false)}>Done</Button>
          </div>
        </div>
      </Modal>

      {/* Export Data Modal */}
      <Modal isOpen={isExportModalOpen} onClose={() => setIsExportModalOpen(false)} title="Export Data Table" size="md">
        <div className="space-y-4">
          <div>
            <label htmlFor="exportFileName" className={`block text-sm font-medium mb-1 ${theme.textColor}`}>File Name (without extension)</label>
            <Input
              id="exportFileName"
              value={exportFileName}
              onChange={(e) => setExportFileName(e.target.value)}
              placeholder="Enter file name"
            />
          </div>
          <div>
            <label htmlFor="exportFormat" className={`block text-sm font-medium mb-1 ${theme.textColor}`}>Format</label>
            <select
              id="exportFormat"
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value as ExportFormat)}
              className={`${commonSelectStyles.baseClassName} w-full p-2`}
              style={commonSelectStyles.style}
            >
              {EXPORT_FORMAT_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value} style={commonSelectStyles.optionStyle}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={`block text-sm font-medium mb-1 ${theme.textColor}`}>Data Scope</label>
            <div className="flex space-x-4">
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  name="exportScope"
                  value="currentView"
                  checked={exportScope === 'currentView'}
                  onChange={() => setExportScope('currentView')}
                  className={`form-radio h-4 w-4 text-${theme.accent1} border-${theme.mediumGray} focus:ring-${theme.accent1}`}
                  style={{ accentColor: RAW_COLOR_VALUES[theme.accent1] }}
                />
                <span className={`ml-2 text-sm ${theme.textColor}`}>Current View (Filtered & Searched)</span>
              </label>
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  name="exportScope"
                  value="allData"
                  checked={exportScope === 'allData'}
                  onChange={() => setExportScope('allData')}
                  className={`form-radio h-4 w-4 text-${theme.accent1} border-${theme.mediumGray} focus:ring-${theme.accent1}`}
                  style={{ accentColor: RAW_COLOR_VALUES[theme.accent1] }}
                />
                <span className={`ml-2 text-sm ${theme.textColor}`}>All Original Data</span>
              </label>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <Button variant="secondary" onClick={() => setIsExportModalOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={handlePerformExport} leftIcon={<Download size={16}/>}>Export</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default DataTableComponent;
