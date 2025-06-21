import React, { useContext, useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppContext } from '../contexts/AppContext';
import {
  AppContextType,
  DataRow,
  FilterState,
  TableThemeName,
  TableFontOption,
  TableFontSizeOption,
  Theme,
  ProcessedData,
  TableTheme,
  DataTableViewConfig,
  ExportFormat,
} from '../types';
import Button from './shared/Button';
import Modal from './shared/Modal';
import { Search, Save, AlertTriangle, Filter as FilterIconLucide, Settings2, SlidersHorizontal, CheckSquare, Square, ExternalLink, ChevronDown, ChevronUp, XCircle, Eye, EyeOff, Trash2, Edit3, Edit, Rows, Columns, MoreVertical, Calculator, Undo, Redo, View, Download, BarChart2, FileText as FileTextIcon } from 'lucide-react';
import { LUCIDE_FILTER_ICON, RAW_COLOR_VALUES, EXPORT_FORMAT_OPTIONS, CHART_COLOR_PALETTE } from '../constants';
import Input from './shared/Input';
import { exportTableToExcel, exportTableToCSV, exportTableToJson } from '../services/DataProcessingService';
import { getSharedSelectBaseStyles } from '../utils';

interface EditTableActionItem {
  label: string;
  icon: React.ElementType;
  action: () => void;
  disabled?: boolean;
}


const DataTableComponent: React.FC = () => {
  const appContext = useContext(AppContext) as AppContextType;
  const {
    theme,
    processedData: originalProcessedData, 
    saveFileToLibrary,
    tableFont, setTableFont, tableFontSize, setTableFontSize,
    tableTheme, setTableTheme, availableTableThemes,
    tableFontOptions, tableFontSizeOptions,
    reduceMotion,
    savedDataTableViews, saveDataTableView, loadDataTableView, deleteDataTableView,
    undoDataTableChange, redoDataTableChange, canUndoDataTable, canRedoDataTable,
    defaultExportFormat,
    pivotDataIdentifier,
    dataTableSearchTermFromAI,
    globalActiveFilters, setGlobalActiveFilters, 
    globallyFilteredData, 
  } = appContext;
  const navigate = useNavigate();

  const [searchTerm, setSearchTerm] = useState('');
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [isPreferencesOpen, setIsPreferencesOpen] = useState(false);

  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({});
  const [isColumnVisibilityModalOpen, setIsColumnVisibilityModalOpen] = useState(false);

  const [isEditHeadersModalOpen, setIsEditHeadersModalOpen] = useState(false);
  const [headerEdits, setHeaderEdits] = useState<Record<string, string>>({});

  const [isAddCalculatedColumnModalOpen, setIsAddCalculatedColumnModalOpen] = useState(false);
  const [calculatedColumnName, setCalculatedColumnName] = useState('');
  const [calculatedColumnFormula, setCalculatedColumnFormula] = useState('');
  const formulaInputRef = useRef<HTMLTextAreaElement>(null);

  const [isTableMenuOpen, setIsTableMenuOpen] = useState(false);
  const tableMenuRef = useRef<HTMLDivElement>(null);

  const [isManageViewsModalOpen, setIsManageViewsModalOpen] = useState(false);
  const [newViewName, setNewViewName] = useState('');

  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportFileName, setExportFileName] = useState('');
  const [exportFormat, setExportFormat] = useState<ExportFormat>(defaultExportFormat);
  const [exportScope, setExportScope] = useState<'currentView' | 'allData'>('currentView');

  const dataTableInitializationId = useRef<string | null>(null);

  const dataForLocalOps = useMemo(() => globallyFilteredData || [], [globallyFilteredData]);
  
  const allHeaders = useMemo(() => originalProcessedData?.headers || [], [originalProcessedData?.headers]);
  const headers = useMemo(() => allHeaders.filter(header => visibleColumns[header]), [allHeaders, visibleColumns]);

  const filteredAndSearchedData = useMemo(() => {
    let filtered = dataForLocalOps; 
    
    if (searchTerm) {
      const lowerSearchTerm = searchTerm.toLowerCase();
      filtered = filtered.filter(row =>
        allHeaders.some(header => String(row[header]).toLowerCase().includes(lowerSearchTerm))
      );
    }
    return filtered;
  }, [dataForLocalOps, searchTerm, allHeaders]);

  const dynamicNonEmptyCounts = useMemo(() => {
    if (!filteredAndSearchedData || !allHeaders) return {}; // Use filteredAndSearchedData
    const counts: Record<string, number> = {};
    for (const header of allHeaders) { // Iterate over all possible headers
        let count = 0;
        for (const row of filteredAndSearchedData) { // Iterate over filteredAndSearchedData
            if (row[header] !== null && row[header] !== undefined && String(row[header]).trim() !== '') {
                count++;
            }
        }
        counts[header] = count;
    }
    return counts;
  }, [filteredAndSearchedData, allHeaders]);


  useEffect(() => {
    if (dataTableSearchTermFromAI !== null && dataTableSearchTermFromAI !== searchTerm) {
      setSearchTerm(dataTableSearchTermFromAI);
      setCurrentPage(1);
    }
  }, [dataTableSearchTermFromAI, searchTerm]);


  useEffect(() => {
    if (pivotDataIdentifier !== dataTableInitializationId.current) {
      if (originalProcessedData) {
        const currentHeaders = originalProcessedData.headers || [];

        const initialVisibility: Record<string, boolean> = {};
        currentHeaders.forEach(header => { initialVisibility[header] = true; });
        setVisibleColumns(initialVisibility);

        setHeaderEdits(currentHeaders.reduce((acc, h) => ({...acc, [h]:h}), {}));
        setExportFileName(originalProcessedData.fileName.replace(/\.[^/.]+$/, "") || 'exported_data');

        setCurrentPage(1);
        setSearchTerm('');
        setGlobalActiveFilters({}); 
        setIsTableMenuOpen(false);

      } else {
        setVisibleColumns({});
        setHeaderEdits({});
        setExportFileName('');
        setCurrentPage(1); setSearchTerm(''); setGlobalActiveFilters({});
        setIsTableMenuOpen(false);
      }
      dataTableInitializationId.current = pivotDataIdentifier;
    }
  }, [pivotDataIdentifier, originalProcessedData, setGlobalActiveFilters]);

  const uniqueFilterValues = useMemo(() => {
    if (!originalProcessedData?.data) return {};

    return allHeaders.reduce((acc, header) => {
        let dataForThisHeaderUniqueValues = originalProcessedData.data;
        if (Object.keys(globalActiveFilters).length > 0) {
            dataForThisHeaderUniqueValues = dataForThisHeaderUniqueValues.filter(row =>
                Object.entries(globalActiveFilters).every(([filterKey, selectedValues]) => {
                    if (filterKey === header) return true; 
                    return selectedValues.length === 0 || selectedValues.includes(String(row[filterKey]));
                })
            );
        }
        const values = [...new Set(dataForThisHeaderUniqueValues.map(row => String(row[header])))].sort();
        acc[header] = values;
        return acc;
    }, {} as Record<string, string[]>);
  }, [originalProcessedData, globalActiveFilters, allHeaders]);

  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredAndSearchedData.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredAndSearchedData, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredAndSearchedData.length / itemsPerPage);

  const handleFilterChange = (header: string, value: string) => {
    setGlobalActiveFilters(prev => { 
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

  const handleSelectAllFilterValues = (header: string) => {
    const allValuesForHeader = uniqueFilterValues[header] || [];
    if (allValuesForHeader.length > 0) {
      setGlobalActiveFilters(prev => ({ 
        ...prev,
        [header]: [...allValuesForHeader]
      }));
    } else {
      setGlobalActiveFilters(prev => { 
        const { [header]: _, ...rest } = prev;
        return rest;
      });
    }
    setCurrentPage(1);
  };

  const handleUnselectAllFilterValues = (header: string) => {
    setGlobalActiveFilters(prev => { 
      const { [header]: _, ...rest } = prev;
      return rest;
    });
    setCurrentPage(1);
  };

  const toggleDropdown = (header: string) => {
    setOpenDropdown(openDropdown === header ? null : header);
  };

  const handleSaveToLibraryAction = () => {
    if (originalProcessedData) {
      saveFileToLibrary(originalProcessedData);
      alert(`${originalProcessedData.fileName} saved to library!`);
    }
    setIsTableMenuOpen(false);
  };

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
      const filterDropdowns = document.querySelectorAll('[data-filter-dropdown]');
      let clickInsideDropdown = false;
      filterDropdowns.forEach(dropdown => {
        if (dropdown.contains(event.target as Node)) {
          clickInsideDropdown = true;
        }
      });
      if (!clickInsideDropdown && !(event.target as HTMLElement).closest('button[data-filter-button]')) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleEditHeaders = () => {
    const currentPData = originalProcessedData;
    if (!currentPData) return;
    const currentAllHeaders = currentPData.headers || [];
    const newHeaders = currentAllHeaders.map(oldH => headerEdits[oldH] || oldH);
    if (new Set(newHeaders).size !== newHeaders.length) { alert("New header names must be unique."); return; }

    const currentDataRows = currentPData.data || [];
    const updatedData = currentDataRows.map(row => {
        const newRow: DataRow = { __ROW_ID__: row.__ROW_ID__ };
        currentAllHeaders.forEach(oldHeader => {
            const newHeader = headerEdits[oldHeader] || oldHeader;
            newRow[newHeader] = row[oldHeader];
        });
        return newRow;
    });
    const newGlobalFiltersState: FilterState = {}; 
    Object.entries(globalActiveFilters).forEach(([oldH, values]) => {
        const newH = headerEdits[oldH] || oldH;
        newGlobalFiltersState[newH] = values;
    });
    setGlobalActiveFilters(newGlobalFiltersState); 

    appContext.setProcessedData({ ...currentPData, headers: newHeaders, data: updatedData }, { isUserAction: true });
    setIsEditHeadersModalOpen(false);
  };

  const evaluateFormulaForRow = (formula: string, row: DataRow, currentAllHeadersEval: string[]): number | string | null => {
    let formulaToEvaluate = formula;
    currentAllHeadersEval.forEach(header => {
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
    const currentPData = originalProcessedData;
    if (!currentPData || !calculatedColumnName.trim()) { alert("Calculated column name cannot be empty."); return; }
    const trimmedName = calculatedColumnName.trim();
    const currentAllHeaders = currentPData.headers || [];
    if (currentAllHeaders.includes(trimmedName)) { alert("Column name already exists."); return; }
    if (!calculatedColumnFormula.trim()) { alert("Formula cannot be empty."); return; }
    let openParen = 0;
    for (const char of calculatedColumnFormula) {
        if (char === '(') openParen++; else if (char === ')') openParen--;
        if (openParen < 0) { alert("Formula has unbalanced parentheses."); return; }
    }
    if (openParen !== 0) { alert("Formula has unbalanced parentheses."); return; }
    const updatedHeaders = [...currentAllHeaders, trimmedName];
    const currentDataRows = currentPData.data || [];
    const updatedData = currentDataRows.map(row => ({ ...row, [trimmedName]: evaluateFormulaForRow(calculatedColumnFormula, row, currentAllHeaders) }));

    appContext.setProcessedData({ ...currentPData, headers: updatedHeaders, data: updatedData }, { isUserAction: true });
    setVisibleColumns(prev => ({ ...prev, [trimmedName]: true }));
    setCalculatedColumnName(''); setCalculatedColumnFormula(''); setIsAddCalculatedColumnModalOpen(false);
  };

  const insertFieldIntoFormula = (fieldName: string) => {
    if (formulaInputRef.current) {
        const start = formulaInputRef.current.selectionStart; const end = formulaInputRef.current.selectionEnd;
        const currentFormula = calculatedColumnFormula; const textToInsert = `[${fieldName}]`;
        setCalculatedColumnFormula(currentFormula.substring(0, start || 0) + textToInsert + currentFormula.substring(end || 0));
        setTimeout(() => {
            formulaInputRef.current?.focus();
            formulaInputRef.current?.setSelectionRange((start || 0) + textToInsert.length, (start || 0) + textToInsert.length);
        }, 0);
    }
  };

  const handleSaveCurrentView = () => {
    if (!originalProcessedData || !newViewName.trim()) {
        alert("Please enter a name for this view.");
        return;
    }
    const currentViewConfig: Omit<DataTableViewConfig, 'id' | 'createdAt'> = {
        name: newViewName,
        associatedDataIdentifier: pivotDataIdentifier || '',
        searchTerm,
        itemsPerPage,
        visibleColumns,
        tableFont,
        tableFontSize,
        tableThemeName: tableTheme.name,
    };
    saveDataTableView(currentViewConfig);
    setNewViewName('');
  };

  const handleLoadView = (viewId: string) => {
    const viewToLoad = loadDataTableView(viewId);
    if (viewToLoad && viewToLoad.associatedDataIdentifier === pivotDataIdentifier) {
        setSearchTerm(viewToLoad.searchTerm);
        // Global filters are not part of DataTableViewConfig and are managed by AppSession
        // If you need to reset/adjust global filters when loading a table view, do it explicitly here.
        // e.g., setGlobalActiveFilters({});
        setItemsPerPage(viewToLoad.itemsPerPage);
        setVisibleColumns(viewToLoad.visibleColumns);
        setTableFont(viewToLoad.tableFont);
        setTableFontSize(viewToLoad.tableFontSize);
        setTableTheme(viewToLoad.tableThemeName);
        setCurrentPage(1);
        setIsManageViewsModalOpen(false);
    } else if (viewToLoad) {
        alert("This view configuration is for a different dataset and cannot be applied.");
    } else {
        alert("View not found.");
    }
  };

  const relevantSavedViews = useMemo(() => {
    return savedDataTableViews.filter(view => view.associatedDataIdentifier === pivotDataIdentifier);
  }, [savedDataTableViews, pivotDataIdentifier]);

  const handlePrepareExport = () => {
    if (!originalProcessedData) return;
    setExportFileName(originalProcessedData.fileName.replace(/\.[^/.]+$/, "") || 'exported_data');
    setExportFormat(defaultExportFormat);
    setExportScope('currentView');
    setIsExportModalOpen(true);
    setIsTableMenuOpen(false);
  };

  const handlePerformExport = () => {
    if (!originalProcessedData) return;

    let dataToExport: DataRow[];
    let headersForExport: string[];

    if (exportScope === 'currentView') {
      dataToExport = filteredAndSearchedData;
      headersForExport = headers; 
    } else {
      dataToExport = originalProcessedData.data; 
      headersForExport = originalProcessedData.headers; 
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

  const editTableActionItems: EditTableActionItem[] = [
    { label: "Edit Headers", icon: Edit3, action: () => setIsEditHeadersModalOpen(true) },
    { label: "Add Calculated Column", icon: Calculator, action: () => setIsAddCalculatedColumnModalOpen(true) },
  ];


  if (!originalProcessedData) {
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
  const bodyClasses = `${tableTheme.textColor} divide-y ${tableTheme.borderColor}`;
  const cellClasses = `whitespace-nowrap`;

  const commonSelectStyles = getSharedSelectBaseStyles(theme);
  const itemsPerPageSelectStyles = getSharedSelectBaseStyles(theme, 'text-xs');

  const filterDropdownTextColor = RAW_COLOR_VALUES[theme.textColor.replace('text-', '')] || '#E0E0E0';
  const filterDropdownItemHoverBg = RAW_COLOR_VALUES[theme.mediumGray] || '#333F58';


  const cellBasePadding = 'px-3 py-2';

  return (
    <div className={`p-4 md:p-6 ${theme.textColor} h-full flex flex-col`}>
      <div className="mb-4 flex flex-col md:flex-row justify-between md:items-center gap-3">
        <div>
            <h1 className={`text-2xl md:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-${theme.accent1} to-${theme.accent2}`}>
              Data Table: {originalProcessedData.fileName}
              {originalProcessedData.sheetName && <span className="text-base opacity-80"> ({originalProcessedData.sheetName})</span>}
            </h1>
            <p className="text-xs opacity-70 mt-1">
              Displaying {paginatedData.length} of {filteredAndSearchedData.length} (Total: {originalProcessedData.data.length}) records.
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
                  <Button variant="ghost" size="sm" onClick={handleSaveToLibraryAction} className={`w-full justify-start text-sm ${theme.textColor} hover:bg-${theme.mediumGray}/30 hover:text-${theme.accent1}`} leftIcon={<Save size={16} />} > Save to Library </Button>
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
      </div>

      <div className={`flex-grow overflow-auto futuristic-scrollbar border ${tableTheme.borderColor} rounded-lg shadow-2xl ${tableTheme.tableBg}`}>
        <table className={tableClasses}>
          <thead className={headerClasses}>
            <tr>
              {headers.map((header) => (
                <th key={header} scope="col" className={`${headerCellClasses} ${tableTheme.headerBg} ${cellBasePadding}`} style={header3DStyle}>
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col items-start">
                        <span className="leading-tight">{header}</span>
                        <span className={`text-[10px] font-normal opacity-70 ${tableTheme.headerColor.startsWith('text-') ? 'text-opacity-70' : ''}`} style={{color: 'inherit'}}>
                            (Rows: {dynamicNonEmptyCounts[header] !== undefined ? dynamicNonEmptyCounts[header].toLocaleString() : 'N/A'})
                        </span>
                    </div>
                    <div className="relative">
                      <button data-filter-button onClick={() => toggleDropdown(header)} className={`ml-2 p-1 rounded hover:bg-black/30 transition-colors`}>
                        <FilterIconComponent size={16} className={`${globalActiveFilters[header]?.length ? `text-${theme.accent1}`: tableTheme.filterIconColor }`} />
                      </button>
                      {openDropdown === header && (
                        <div data-filter-dropdown className={`absolute right-0 mt-2 w-56 border rounded-md shadow-2xl z-20 p-2 max-h-60 overflow-y-auto futuristic-scrollbar`} style={{ backgroundColor: RAW_COLOR_VALUES[theme.darkGray], borderColor: RAW_COLOR_VALUES[theme.mediumGray] }} >
                          <div className="flex justify-between mb-1">
                            <Button variant="ghost" size="sm" onClick={() => handleSelectAllFilterValues(header)} className={`!text-xs !px-1 !py-0.5 text-${theme.accent1}`}>Select All</Button>
                            <Button variant="ghost" size="sm" onClick={() => handleUnselectAllFilterValues(header)} className={`!text-xs !px-1 !py-0.5 text-${theme.accent1}`}>Unselect All</Button>
                          </div>
                          <hr className={`my-1 border-${theme.mediumGray}`} />
                          <p className={`text-xs px-2 py-1 opacity-70`} style={{color: filterDropdownTextColor}}>Filter by {header}:</p>
                          {uniqueFilterValues[header]?.length > 0 ? uniqueFilterValues[header].map(value => {
                            const isSelected = globalActiveFilters[header]?.includes(value);
                            const countInContext = (originalProcessedData?.data || []).filter(row => 
                                String(row[header]) === value &&
                                Object.entries(globalActiveFilters).every(([filterKey, selectedVals]) => {
                                    if (filterKey === header) return true; 
                                    return selectedVals.length === 0 || selectedVals.includes(String(row[filterKey]));
                                })
                            ).length;

                            return (
                              <label key={value} className={`flex items-center space-x-2 px-2 py-1.5 rounded cursor-pointer text-sm hover:bg-[${filterDropdownItemHoverBg}]`} style={{color: filterDropdownTextColor}}>
                                <input type="checkbox" checked={isSelected} onChange={() => handleFilterChange(header, value)} className={`form-checkbox h-4 w-4 rounded border-${theme.mediumGray} focus:ring-${theme.accent1}/50`} style={{ backgroundColor: RAW_COLOR_VALUES[theme.darkGray], color: RAW_COLOR_VALUES[theme.accent1] }} />
                                <span className="flex-grow truncate" title={value}>{value || '(empty)'}</span>
                                <span className={`text-xs opacity-60 ${isSelected ? `text-${theme.accent1}`:''}`}>({countInContext})</span>
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
              const rowId = row.__ROW_ID__;
              const isRowHighlighted = searchTerm && allHeaders.some(header => String(row[header]).toLowerCase().includes(searchTerm.toLowerCase()));
              let rowBaseBgClass = (tableTheme.rowAltBg && rowIndex % 2 !== 0) ? tableTheme.rowAltBg : tableTheme.rowBg;
              if (isRowHighlighted) rowBaseBgClass = `${tableTheme.highlightRowBg}`;
              return (
                <tr key={rowId || rowIndex} className={`${rowBaseBgClass} ${tableTheme.rowHoverBg}`}>
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

      <Modal isOpen={isColumnVisibilityModalOpen} onClose={() => setIsColumnVisibilityModalOpen(false)} title="Manage Column Visibility" size="md">
        <div className="mb-3 flex justify-between">
          <Button variant="ghost" size="sm" onClick={handleSelectAllColumns} className={`text-${theme.accent1}`}>Select All</Button>
          <Button variant="ghost" size="sm" onClick={handleUnselectAllColumns} className={`text-${theme.accent1}`}>Unselect All</Button>
        </div>
        <div className="max-h-80 overflow-y-auto futuristic-scrollbar pr-2 space-y-1">
            {allHeaders.map(header => (
                <label key={header} className={`flex items-center space-x-2 p-1.5 rounded cursor-pointer hover:bg-${theme.mediumGray}/30 transition-colors`}>
                    <input
                        type="checkbox"
                        checked={visibleColumns[header] || false}
                        onChange={() => handleToggleColumnVisibility(header)}
                        className={`form-checkbox h-4 w-4 rounded border-${theme.mediumGray} text-${theme.accent1} focus:ring-1 focus:ring-offset-0 focus:ring-${theme.accent1}`}
                        style={{ accentColor: RAW_COLOR_VALUES[theme.accent1] }}
                    />
                    <span className="text-sm truncate">{header}</span>
                </label>
            ))}
        </div>
        <div className="mt-4 flex justify-end">
          <Button variant="primary" onClick={() => setIsColumnVisibilityModalOpen(false)}>Done</Button>
        </div>
      </Modal>

      <Modal isOpen={isPreferencesOpen} onClose={() => setIsPreferencesOpen(false)} title="Table Display Preferences" size="md">
          <div className="space-y-4">
              <div>
                  <label htmlFor="tableFont" className={`block text-sm font-medium mb-1 ${theme.textColor}`}>Table Font:</label>
                  <select id="tableFont" value={tableFont} onChange={(e) => setTableFont(e.target.value)} className={`${commonSelectStyles.baseClassName} w-full`} style={commonSelectStyles.style}>
                      {tableFontOptions.map(opt => <option key={opt.name} value={opt.cssClass} style={commonSelectStyles.optionStyle}>{opt.name}</option>)}
                  </select>
              </div>
              <div>
                  <label htmlFor="tableFontSize" className={`block text-sm font-medium mb-1 ${theme.textColor}`}>Font Size:</label>
                  <select id="tableFontSize" value={tableFontSize} onChange={(e) => setTableFontSize(e.target.value)} className={`${commonSelectStyles.baseClassName} w-full`} style={commonSelectStyles.style}>
                      {tableFontSizeOptions.map(opt => <option key={opt.name} value={opt.cssClass} style={commonSelectStyles.optionStyle}>{opt.name}</option>)}
                  </select>
              </div>
              <div>
                  <label htmlFor="tableTheme" className={`block text-sm font-medium mb-1 ${theme.textColor}`}>Table Theme:</label>
                  <select id="tableTheme" value={tableTheme.name} onChange={(e) => setTableTheme(e.target.value as TableThemeName)} className={`${commonSelectStyles.baseClassName} w-full`} style={commonSelectStyles.style}>
                      {Object.values(availableTableThemes).map(t => <option key={t.name} value={t.name} style={commonSelectStyles.optionStyle}>{t.name}</option>)}
                  </select>
              </div>
              <div className="flex justify-end pt-2">
                  <Button variant="primary" onClick={() => setIsPreferencesOpen(false)}>Apply & Close</Button>
              </div>
          </div>
      </Modal>

      <Modal isOpen={isExportModalOpen} onClose={() => setIsExportModalOpen(false)} title="Export Table Data" size="md">
          <div className="space-y-4">
              <div>
                  <label htmlFor="exportFileName" className={`block text-sm font-medium mb-1 ${theme.textColor}`}>File Name:</label>
                  <Input id="exportFileName" value={exportFileName} onChange={(e) => setExportFileName(e.target.value)} className="w-full" />
              </div>
              <div>
                  <label htmlFor="exportFormat" className={`block text-sm font-medium mb-1 ${theme.textColor}`}>Format:</label>
                  <select id="exportFormat" value={exportFormat} onChange={(e) => setExportFormat(e.target.value as ExportFormat)} className={`${commonSelectStyles.baseClassName} w-full`} style={commonSelectStyles.style}>
                      {EXPORT_FORMAT_OPTIONS.map(opt => <option key={opt.value} value={opt.value} style={commonSelectStyles.optionStyle}>{opt.label}</option>)}
                  </select>
              </div>
              <div>
                <label className={`block text-sm font-medium mb-1 ${theme.textColor}`}>Data Scope:</label>
                <div className="flex gap-4">
                    <label className="flex items-center"><input type="radio" name="exportScope" value="currentView" checked={exportScope === 'currentView'} onChange={() => setExportScope('currentView')} className={`form-radio mr-1.5 text-${theme.accent1} focus:ring-${theme.accent1}`} style={{accentColor: RAW_COLOR_VALUES[theme.accent1]}}/>Current View ({filteredAndSearchedData.length} rows)</label>
                    <label className="flex items-center"><input type="radio" name="exportScope" value="allData" checked={exportScope === 'allData'} onChange={() => setExportScope('allData')} className={`form-radio mr-1.5 text-${theme.accent1} focus:ring-${theme.accent1}`} style={{accentColor: RAW_COLOR_VALUES[theme.accent1]}} />All Data ({originalProcessedData.data.length} rows)</label>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                  <Button variant="secondary" onClick={() => setIsExportModalOpen(false)}>Cancel</Button>
                  <Button variant="primary" onClick={handlePerformExport} leftIcon={<Download size={16}/>}>Export</Button>
              </div>
          </div>
      </Modal>

      <Modal isOpen={isEditHeadersModalOpen} onClose={()=>setIsEditHeadersModalOpen(false)} title="Edit Column Headers" size="lg">
        <div className="space-y-3 max-h-[70vh] overflow-y-auto futuristic-scrollbar pr-2">
          {allHeaders.map(oldHeader => (
            <div key={oldHeader} className="grid grid-cols-2 gap-2 items-center">
              <label className="text-sm truncate" title={oldHeader}>{oldHeader}:</label>
              <Input value={headerEdits[oldHeader] || oldHeader} onChange={e => setHeaderEdits(prev => ({...prev, [oldHeader]: e.target.value}))} className="w-full"/>
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-2 mt-4 pt-2 border-t ${theme.borderColor}"><Button variant="secondary" onClick={()=>setIsEditHeadersModalOpen(false)}>Cancel</Button><Button variant="primary" onClick={handleEditHeaders}>Save Changes</Button></div>
      </Modal>

      <Modal isOpen={isAddCalculatedColumnModalOpen} onClose={()=>setIsAddCalculatedColumnModalOpen(false)} title="Add Calculated Column" size="lg">
        <div className="space-y-4">
            <div><label className="text-sm">New Column Name:</label><Input value={calculatedColumnName} onChange={e => setCalculatedColumnName(e.target.value)} className="w-full mt-1"/></div>
            <div>
                <label className="text-sm">Formula (e.g., `[ColumnA] + [ColumnB]` or `([Sales] - [Cost]) / [Sales]`):</label>
                <textarea ref={formulaInputRef} value={calculatedColumnFormula} onChange={e => setCalculatedColumnFormula(e.target.value)} rows={3} className={`w-full p-2 rounded-md border focus:ring-2 focus:ring-${theme.accent1} focus:border-${theme.accent1} transition-colors futuristic-scrollbar text-sm mt-1`} style={{ backgroundColor: RAW_COLOR_VALUES[theme.darkGray], color: RAW_COLOR_VALUES[theme.textColor.replace('text-','')], borderColor: RAW_COLOR_VALUES[theme.mediumGray]}}/>
            </div>
            <div>
                <p className="text-xs opacity-80 mb-1">Click field to insert into formula:</p>
                <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto p-1 border border-${theme.mediumGray} rounded">
                    {allHeaders.map(header => (<Button key={header} variant="ghost" size="sm" onClick={() => insertFieldIntoFormula(header)} className={`!text-xs !px-1.5 !py-0.5 bg-${theme.mediumGray}/50`}>{header}</Button>))}
                </div>
            </div>
            <div className="flex justify-end gap-2"><Button variant="secondary" onClick={()=>setIsAddCalculatedColumnModalOpen(false)}>Cancel</Button><Button variant="primary" onClick={handleAddCalculatedColumn}>Add Column</Button></div>
        </div>
      </Modal>

    </div>
  );
};

export default DataTableComponent;