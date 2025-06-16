
import React, { useState, useEffect, useMemo, useContext, useCallback, useRef } from 'react';
import * as XLSX from 'xlsx';
import { AppContext } from '../contexts/AppContext';
import {
  AppContextType,
  DataRow,
  PivotConfig,
  PivotFieldConfig,
  PivotValueFieldConfig,
  PivotResult,
  PivotArea,
  DraggedPivotField,
  AggregationType,
  Theme,
  PivotOptions,
  PivotRowHeader,
  PivotColumnHeader,
  PivotDataCell,
  AppChartType,
  CalculatedMeasureConfig,
  SavedPivotSummary,
  ActivePivotView,
  MaximizedPivotViewModalProps
} from '../types';
import { generatePivotData, exportPivotToExcel as exportPivotToExcelService, DUMMY_COLUMN_KEY_FOR_VALUES_ONLY } from '../services/DataProcessingService';
import Button from './shared/Button';
import LoadingSpinner from './shared/LoadingSpinner';
import Modal from './shared/Modal';
import { AlertTriangle, Settings2, Download, LayoutGrid, Rows as RowsIcon, Columns as ColumnsIcon, Sigma as SigmaIcon, Filter as FilterIconLucide, GripVertical, X, ChevronDown, ChevronUp, CheckSquare, Square, PlusCircle, Search as SearchIcon, ChevronRight, Maximize2, Minimize2, EyeOff, Eye, BarChart2 as ChartIconLucide, ListCollapse, ListTree, SlidersHorizontal, PackagePlus, Ellipsis, Move as MoveIcon, Plus, Calculator, Edit2, Presentation, Save, PackageOpen, Trash2 as TrashIcon, Edit3 as EditNameIcon, Terminal, List } from 'lucide-react';
import { RAW_COLOR_VALUES, CHART_COLOR_PALETTE } from '../constants';
import Input from './shared/Input';
import { ResponsiveContainer, ComposedChart, Bar, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell, LabelList } from 'recharts';
import { getSharedSelectBaseStyles, isNumericDataField } from '../utils';
import { createInitialPivotConfig, createInitialPivotOptions } from '../contexts/AppContext'; // Import fallbacks

const AGGREGATION_OPTIONS = Object.values(AggregationType);
const AVAILABLE_CHART_TYPES: AppChartType[] = ['bar', 'line', 'area'];
const MAX_INITIAL_AVAILABLE_FIELDS = 5;
const MAX_PIVOT_CHART_POINTS_FOR_HORIZONTAL_LABELS = 12;

type UnifiedMeasureConfigForPivot = 
  | (PivotValueFieldConfig & { isCalculated: false })
  | (CalculatedMeasureConfig & { isCalculated: true; aggregation: 'Calculated' });


export const PivotTable: React.FC = () => { 
  const appContext = useContext(AppContext) as AppContextType;
  const {
    theme,
    processedData,
    activePivotViews, currentEditingPivotViewId,
    addActivePivotView, removeActivePivotView,
    updateActivePivotViewConfig, updateActivePivotViewOptions,
    updateActivePivotViewExpandedKeys, updateActivePivotViewName,
    setActiveEditingPivotViewId, updateActivePivotViewResult,
    pivotAvailableFieldsFilter, setPivotAvailableFieldsFilter,
    reduceMotion,
    setIsSidebarOpen, 
    pivotDataIdentifier,
    savedPivotSummaries, savePivotSummary, deletePivotSummary,
    exportPivotToExcel, 
    openFilterValueDropdown, setOpenFilterValueDropdown // Added from context
  } = appContext;

  const [allAvailableFields, setAllAvailableFields] = useState<string[]>([]);
  const [isLoadingGlobal, setIsLoadingGlobal] = useState(false); // For global operations like initial load
  const [loadingViewIds, setLoadingViewIds] = useState<Set<string>>(new Set()); // For individual view calcs

  const [draggedField, setDraggedField] = useState<DraggedPivotField | null>(null);
  
  // Modals associated with the currentEditingPivotViewId or global actions
  const [showDisplayOptionsModalForViewId, setShowDisplayOptionsModalForViewId] = useState<string | null>(null);
  const [showManageSummariesModal, setShowManageSummariesModal] = useState(false);
  const [newSummaryNameState, setNewSummaryNameState] = useState(''); // Renamed to avoid conflict
  const [isAddCalculatedMeasureModalOpen, setIsAddCalculatedMeasureModalOpen] = useState(false);
  const [newCalcMeasureNameState, setNewCalcMeasureNameState] = useState(''); // Renamed
  const [newCalcMeasureFormulaState, setNewCalcMeasureFormulaState] = useState(''); // Renamed
  const calcMeasureFormulaInputRef = useRef<HTMLTextAreaElement>(null);

  const [editingViewNameId, setEditingViewNameId] = useState<string | null>(null);
  const [tempViewName, setTempViewName] = useState('');
  
  const [maximizedViewId, setMaximizedViewId] = useState<string | null>(null);
  const [maximizedViewPosition, setMaximizedViewPosition] = useState({ x: 50, y: 50 });
  const [isMaximizedViewDragging, setIsMaximizedViewDragging] = useState(false);
  const [maximizedViewDragStartOffset, setMaximizedViewDragStartOffset] = useState({ x: 0, y: 0 });
  const maximizedViewRef = useRef<HTMLDivElement>(null);
  
  const [chartModalViewId, setChartModalViewId] = useState<string|null>(null);
  const [chartModalType, setChartModalType] = useState<AppChartType>('bar');

  const [fieldToAddAsFilter, setFieldToAddAsFilter] = useState<string>('');
  // openFilterValueDropdown and setOpenFilterValueDropdown now come from context.

  const [showAllAvailableFields, setShowAllAvailableFields] = useState<boolean>(false);
  const availableFieldsDetailsRef = useRef<HTMLDetailsElement>(null);
  const preSummaryFiltersDetailsRef = useRef<HTMLDetailsElement>(null);
  const pivotStructureDetailsRef = useRef<HTMLDetailsElement>(null);
  const [isPivotPresentationViewActive, setIsPivotPresentationViewActive] = useState(false);
  const [presentationChartType, setPresentationChartType] = useState<AppChartType>('bar');
  const [currentPresentationView, setCurrentPresentationView] = useState<ActivePivotView | null>(null);

  useEffect(() => {
    if (processedData) {
      setAllAvailableFields(Array.isArray(processedData.headers) ? processedData.headers : []);
      setShowAllAvailableFields(false);
    } else {
      setAllAvailableFields([]);
    }
    setShowDisplayOptionsModalForViewId(null);
    setShowManageSummariesModal(false);
    setNewSummaryNameState('');
    setChartModalViewId(null);
    setFieldToAddAsFilter(''); 
    setOpenFilterValueDropdown(null);
    setIsPivotPresentationViewActive(false);
    setMaximizedViewId(null);
    if (availableFieldsDetailsRef.current) availableFieldsDetailsRef.current.open = true;
    if (preSummaryFiltersDetailsRef.current) preSummaryFiltersDetailsRef.current.open = true;
    if (pivotStructureDetailsRef.current) pivotStructureDetailsRef.current.open = true;
  }, [processedData, pivotDataIdentifier, setOpenFilterValueDropdown]);

  const filteredAvailableFields = useMemo(() => {
    if (!pivotAvailableFieldsFilter) return allAvailableFields;
    return (allAvailableFields || []).filter(field => field.toLowerCase().includes(pivotAvailableFieldsFilter.toLowerCase()));
  }, [allAvailableFields, pivotAvailableFieldsFilter]);

  const displayableAvailableFields = useMemo(() => {
    return showAllAvailableFields ? filteredAvailableFields : filteredAvailableFields.slice(0, MAX_INITIAL_AVAILABLE_FIELDS);
  }, [filteredAvailableFields, showAllAvailableFields]);
  
  const calculatePivotForView = useCallback(async (viewToCalculate: ActivePivotView | undefined) => {
    if (!processedData || !viewToCalculate) {
      if (viewToCalculate) updateActivePivotViewResult(viewToCalculate.id, null);
      return;
    }
    
    const { pivotConfig } = viewToCalculate;
    // Adjusted condition: an empty config (no rows, cols, values, OR calc measures) means no pivot result.
    if (!pivotConfig.rows.length && !pivotConfig.columns.length && !pivotConfig.values.length && (!pivotConfig.calculatedMeasures || pivotConfig.calculatedMeasures.length === 0)) {
      updateActivePivotViewResult(viewToCalculate.id, null);
      return;
    }

    setLoadingViewIds(prev => new Set(prev).add(viewToCalculate.id));
    await new Promise(resolve => setTimeout(resolve, 10)); 
    try {
      const result = generatePivotData(processedData.data, viewToCalculate.pivotConfig, viewToCalculate.pivotOptions);
      updateActivePivotViewResult(viewToCalculate.id, result);
    } catch (error) { 
      console.error("Error generating pivot data for view:", viewToCalculate.id, error); 
      updateActivePivotViewResult(viewToCalculate.id, null);
      alert(`An error occurred while generating the table summary for "${viewToCalculate.name}". Check console.`);
    } finally {
      setLoadingViewIds(prev => { 
        const newSet = new Set(prev); 
        newSet.delete(viewToCalculate.id); 
        return newSet; 
      });
    }
  }, [processedData, updateActivePivotViewResult]);

  useEffect(() => {
    if (processedData) {
      setIsLoadingGlobal(true);
      const viewsToRecalculate = [...activePivotViews]; // Snapshot of views at the time processedData changed
      Promise.all(viewsToRecalculate.map(view => calculatePivotForView(view)))
        .finally(() => setIsLoadingGlobal(false));
    }
  }, [processedData, calculatePivotForView]); // Removed activePivotViews, as calculatePivotForView updates it.

  const currentEditingView = useMemo(() => {
    return activePivotViews.find(v => v.id === currentEditingPivotViewId);
  }, [activePivotViews, currentEditingPivotViewId]);
  
  // Refined useEffect for currentEditingView to prevent loops
  useEffect(() => {
    const viewToProcess = activePivotViews.find(v => v.id === currentEditingPivotViewId);
    if (viewToProcess && !loadingViewIds.has(viewToProcess.id)) {
      calculatePivotForView(viewToProcess);
    }
  }, [
    currentEditingPivotViewId, // Re-run if the ID of the view being edited changes
    currentEditingView?.pivotConfig,    // Re-run if the config object of the current view changes
    currentEditingView?.pivotOptions,   // Re-run if the options object of the current view changes
    calculatePivotForView,  // Stable function, won't cause loops typically
    // activePivotViews is implicitly handled because currentEditingView depends on it.
    // The key is that currentEditingView.pivotConfig/Options provide more specific triggers than currentEditingView object ref.
  ]);


  const handleDragStart = (field: string, fromArea: PivotArea, fromIndex?: number, isCalculatedMeasure?: boolean) => {
    setDraggedField({ field, fromArea, fromIndex, isCalculatedMeasure });
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; };

  const handleDrop = (toArea: PivotArea) => {
    if (!draggedField || !currentEditingView || toArea === 'filters' || (draggedField.isCalculatedMeasure && toArea !== 'values')) return;
    
    const { field, fromArea } = draggedField;
    const currentConfig = currentEditingView.pivotConfig;
    const newConfig = JSON.parse(JSON.stringify(currentConfig));
      
    if (fromArea !== 'available') {
      if (fromArea === 'values') {
        if (draggedField.isCalculatedMeasure) {
            newConfig.calculatedMeasures = (newConfig.calculatedMeasures || []).filter((item: CalculatedMeasureConfig) => item.name !== field);
        } else {
            newConfig.values = (newConfig.values || []).filter((item: PivotValueFieldConfig) => item.field !== field);
        }
      } else if (fromArea === 'rows' || fromArea === 'columns') {
        newConfig[fromArea] = (newConfig[fromArea] || []).filter((item: PivotFieldConfig) => item.field !== field);
      }
    }

    const fieldExistsInToArea = (areaList: any[]) => areaList.some(item => item.field === field || (item.name === field && draggedField.isCalculatedMeasure));

    if (toArea === 'values') {
      if (draggedField.isCalculatedMeasure) {
          if (!(newConfig.calculatedMeasures || []).find((cm: CalculatedMeasureConfig) => cm.name === field)) {
              const originalMeasure = (currentConfig.calculatedMeasures || []).find(cm => cm.name === field) || { id: `calc_${Date.now()}`, name: field, formula: "" };
              newConfig.calculatedMeasures = [...(newConfig.calculatedMeasures || []), originalMeasure];
          }
      } else if (!fieldExistsInToArea(newConfig.values || [])) {
          const defaultAggregation = isNumericDataField(field, processedData?.data) ? AggregationType.SUM : AggregationType.COUNT_NON_EMPTY;
          newConfig.values = [...(newConfig.values || []), { field, aggregation: defaultAggregation }];
      }
    } else if (toArea === 'rows' || toArea === 'columns') {
      if (!fieldExistsInToArea(newConfig[toArea] || [])) {
        newConfig[toArea] = [...(newConfig[toArea] || []), { field }];
      }
    }
    updateActivePivotViewConfig(currentEditingView.id, newConfig);
    setDraggedField(null);
  };

  const removeFieldFromDragArea = (field: string, fromArea: PivotArea, isCalculated: boolean = false) => {
    if (!currentEditingView) return;
    const currentConfig = currentEditingView.pivotConfig;
    const newConfig = JSON.parse(JSON.stringify(currentConfig));
    if (isCalculated && fromArea === 'values') {
        newConfig.calculatedMeasures = (newConfig.calculatedMeasures || []).filter((item: CalculatedMeasureConfig) => item.name !== field);
    } else if (fromArea === 'values') {
        newConfig.values = (newConfig.values || []).filter((item: PivotValueFieldConfig) => item.field !== field);
    } else if (fromArea === 'rows' || fromArea === 'columns') {
        newConfig[fromArea] = (newConfig[fromArea] as PivotFieldConfig[]).filter(item => item.field !== field);
    }
    updateActivePivotViewConfig(currentEditingView.id, newConfig);
  };

  const addFilterFieldToConfig = () => {
    if (!currentEditingView || !fieldToAddAsFilter) return;
    const currentConfig = currentEditingView.pivotConfig;
    if (!currentConfig.filters.find(f => f.field === fieldToAddAsFilter)) {
        const newConfig = { ...currentConfig, filters: [...currentConfig.filters, { field: fieldToAddAsFilter, selectedValues: [] }] };
        updateActivePivotViewConfig(currentEditingView.id, newConfig);
        setFieldToAddAsFilter(''); 
    }
  };

  const removeFilterFieldFromConfig = (fieldName: string) => {
    if (!currentEditingView) return;
    const currentConfig = currentEditingView.pivotConfig;
    const newConfig = {...currentConfig, filters: currentConfig.filters.filter(f => f.field !== fieldName)};
    updateActivePivotViewConfig(currentEditingView.id, newConfig);
    if (openFilterValueDropdown?.field === fieldName && currentEditingView && openFilterValueDropdown.viewId === currentEditingView.id) { 
      setOpenFilterValueDropdown(null); 
    }
  };

  const handleValueAggregationChange = (valueFieldIndex: number, newAggregation: AggregationType) => {
    if (!currentEditingView) return;
    const currentConfig = currentEditingView.pivotConfig;
    const newValues = [...currentConfig.values];
    if (newValues[valueFieldIndex]) newValues[valueFieldIndex].aggregation = newAggregation;
    const newConfig = { ...currentConfig, values: newValues };
    updateActivePivotViewConfig(currentEditingView.id, newConfig);
  };

  const handleFilterValueChange = (viewId: string, filterFieldName: string, selectedValues: string[]) => {
    const viewToUpdate = activePivotViews.find(v => v.id === viewId);
    if (!viewToUpdate) return;
    const currentConfig = viewToUpdate.pivotConfig;
    const newFilters = currentConfig.filters.map(f => f.field === filterFieldName ? { ...f, selectedValues } : f);
    const newConfig = {...currentConfig, filters: newFilters};
    updateActivePivotViewConfig(viewId, newConfig);
  };
  
  const handleClearLayout = () => { 
    const newViewId = addActivePivotView(); // This creates a view with initial/empty config
    setActiveEditingPivotViewId(newViewId); // Set it as current for editing
    // The useEffect watching currentEditingViewId will trigger calculatePivotForView
    // which in turn will set pivotResult to null for an empty config.
  };

  const toggleExpand = (viewId: string, key: string) => {
    const view = activePivotViews.find(v => v.id === viewId);
    if (!view) return;
    const newKeys = new Set(view.pivotExpandedKeys);
    if (newKeys.has(key)) newKeys.delete(key); else newKeys.add(key);
    updateActivePivotViewExpandedKeys(viewId, newKeys);
  };

  const handleCollapseAll = (viewId: string) => updateActivePivotViewExpandedKeys(viewId, new Set());
  const handleExpandAll = (viewId: string) => {
    const view = activePivotViews.find(v => v.id === viewId);
    if (!view || !view.pivotResult) return;
    const allKeysToExpand = new Set<string>();
    const collectParentKeysRecursive = (nodes: Array<PivotRowHeader | PivotColumnHeader>) => {
        nodes.forEach(node => { if (node.children && node.children.length > 0 && !node.isSubtotal && !node.isGrandTotal) { allKeysToExpand.add(node.key); collectParentKeysRecursive(node.children); }});
    };
    if (view.pivotResult.rowHeadersTree) collectParentKeysRecursive(view.pivotResult.rowHeadersTree);
    if (view.pivotResult.columnHeadersTree) collectParentKeysRecursive(view.pivotResult.columnHeadersTree);
    updateActivePivotViewExpandedKeys(viewId, allKeysToExpand);
  };

  const getRenderableRowNodes = useCallback((view: ActivePivotView | undefined): PivotRowHeader[] => {
    if (!view || !view.pivotResult || !view.pivotResult.rowHeadersTree) return [];
    const renderable: PivotRowHeader[] = []; const localExpandedKeys = view.pivotExpandedKeys;
    (view.pivotResult.rowHeadersTree || []).forEach(node => {
      if (node.isGrandTotal) { if (view.pivotOptions.showRowGrandTotals) renderable.push(node); return; }
      let pathIsExpanded = true;
      if (node.level > 0) {
        const ovEntries = Object.entries(node.originalValues || {});
        const depthToCheck = node.isSubtotal ? node.level : node.level;
        for (let i = 0; i < depthToCheck; i++) {
           let conceptualAncestorKey = "";
           if (ovEntries.length > i) { conceptualAncestorKey = Object.entries(ovEntries.slice(0, i + 1).reduce((acc, [k,v]) => ({...acc, [k]:v}), {})).map(([k,v]) => `${k}:${String(v)}`).sort().join('|-|'); }
          if (!localExpandedKeys.has(conceptualAncestorKey)) { pathIsExpanded = false; break; }
        }
      }
      if (node.isSubtotal) {
        const parentGroupKey = node.key.substring(0, node.key.lastIndexOf('|-|SUBTOTAL'));
        const parentGroupIsActuallyExpanded = node.level === 0 || localExpandedKeys.has(parentGroupKey);
        if (view.pivotOptions.showRowSubtotals && pathIsExpanded && parentGroupIsActuallyExpanded) renderable.push(node);
        return;
      }
      if (pathIsExpanded) {
        if (node.level === 0) renderable.push(node);
        else {
             const parentKeyBasedOnOriginalValues = Object.entries(Object.fromEntries(Object.entries(node.originalValues || {}).slice(0, node.level))).map(([k,v]) => `${k}:${String(v)}`).sort().join('|-|');
            if (localExpandedKeys.has(parentKeyBasedOnOriginalValues)) renderable.push(node);
        }
      }
    });
    return renderable;
  }, []); 

  const getLeafColNodesForData = useCallback((view: ActivePivotView | undefined): PivotColumnHeader[] => {
    if (!view || !view.pivotResult || !view.pivotResult.allColumnKeys) return [];
    const dataColumns: PivotColumnHeader[] = [];
    (view.pivotResult.allColumnKeys || []).forEach(key => {
        if (key === DUMMY_COLUMN_KEY_FOR_VALUES_ONLY && view.pivotConfig.columns.length > 0) return;
        const headerDef = (view.pivotResult!.columnHeadersTree || []).find(ch => ch.key === key);
        if (headerDef) {
            if (headerDef.isGrandTotal && !view.pivotOptions.showColumnGrandTotals) return;
            if (headerDef.isSubtotal && !view.pivotOptions.showColumnSubtotals && !headerDef.isGrandTotal) return;
            let isUnderCollapsedParent = false;
            if (headerDef.level > 0 && !headerDef.isGrandTotal && !headerDef.isSubtotal) {
                const ovEntries = Object.entries(headerDef.originalValues || {});
                for (let l = 0; l < headerDef.level; l++) {
                    const ancestorKey = Object.entries(ovEntries.slice(0, l + 1).reduce((acc, [k,v]) => ({...acc, [k]:v}), {})).map(([k,v]) => `${k}:${String(v)}`).sort().join('|-|');
                    const ancestorNode = (view.pivotResult!.columnHeadersTree || []).find(h => h.key === ancestorKey);
                    if (ancestorNode && ancestorNode.children && ancestorNode.children.length > 0 && !view.pivotExpandedKeys.has(ancestorKey)) {
                        isUnderCollapsedParent = true; break;
                    }
                }
            }
            if (isUnderCollapsedParent) return;
            dataColumns.push(headerDef);
        } else if (key === DUMMY_COLUMN_KEY_FOR_VALUES_ONLY && view.pivotConfig.columns.length === 0) {
             dataColumns.push({ key: DUMMY_COLUMN_KEY_FOR_VALUES_ONLY, label: 'Values', level: 0, children: [], isGrandTotal: false, isSubtotal: false, originalValues:{} });
        }
    });
    return dataColumns;
  }, []); 

  const startEditViewName = (view: ActivePivotView) => { setEditingViewNameId(view.id); setTempViewName(view.name); };
  const cancelEditViewName = () => { setEditingViewNameId(null); setTempViewName(''); };
  const saveViewName = (viewId: string) => { if (tempViewName.trim()) updateActivePivotViewName(viewId, tempViewName.trim()); setEditingViewNameId(null); setTempViewName(''); };
  
  useEffect(() => {
    if (isPivotPresentationViewActive) {
        const viewToPresent = activePivotViews.find(v => v.id === currentEditingPivotViewId) || activePivotViews[0];
        setCurrentPresentationView(viewToPresent || null);
        setIsSidebarOpen(false);
        const event = new CustomEvent('presentationModeChange', { detail: { isActive: true } });
        window.dispatchEvent(event);
    } else {
        setCurrentPresentationView(null);
        const event = new CustomEvent('presentationModeChange', { detail: { isActive: false } });
        window.dispatchEvent(event);
    }
    const handleEscKey = (event: KeyboardEvent) => { if (event.key === 'Escape' && isPivotPresentationViewActive) { setIsPivotPresentationViewActive(false); setIsSidebarOpen(true);}};
    window.addEventListener('keydown', handleEscKey);
    return () => window.removeEventListener('keydown', handleEscKey);
  }, [isPivotPresentationViewActive, currentEditingPivotViewId, activePivotViews, setIsSidebarOpen]);
  
  const handleAddCalculatedMeasure = () => { if (!currentEditingView || !newCalcMeasureNameState.trim()) { alert("Calculated measure name cannot be empty."); return; } const trimmedName = newCalcMeasureNameState.trim(); if ((currentEditingView.pivotConfig.values || []).some(v => v.field === trimmedName) || (currentEditingView.pivotConfig.calculatedMeasures || []).some(cm => cm.name === trimmedName)) { alert("A field or calculated measure with this name already exists."); return; } if (!newCalcMeasureFormulaState.trim()) { alert("Formula cannot be empty."); return; } let openParen = 0; for (const char of newCalcMeasureFormulaState) { if (char === '(') openParen++; else if (char === ')') openParen--; if (openParen < 0) { alert("Formula has unbalanced parentheses."); return; }} if (openParen !== 0) { alert("Formula has unbalanced parentheses."); return; } const newMeasure: CalculatedMeasureConfig = { id: `calc_${Date.now()}_${trimmedName.replace(/\s/g, '')}`, name: trimmedName, formula: newCalcMeasureFormulaState }; const newConfig = { ...currentEditingView.pivotConfig, calculatedMeasures: [...(currentEditingView.pivotConfig.calculatedMeasures || []), newMeasure] }; updateActivePivotViewConfig(currentEditingView.id, newConfig); /* calc is triggered by useEffect */ setNewCalcMeasureNameState(''); setNewCalcMeasureFormulaState(''); setIsAddCalculatedMeasureModalOpen(false); };
  const insertAggFieldIntoCalcFormula = (aggFieldName: string) => { if (calcMeasureFormulaInputRef.current) { const start = calcMeasureFormulaInputRef.current.selectionStart ?? 0, end = calcMeasureFormulaInputRef.current.selectionEnd ?? 0; const currentFormula = newCalcMeasureFormulaState, textToInsert = `[${aggFieldName}]`; setNewCalcMeasureFormulaState(currentFormula.substring(0, start) + textToInsert + currentFormula.substring(end)); setTimeout(() => { calcMeasureFormulaInputRef.current?.focus(); calcMeasureFormulaInputRef.current?.setSelectionRange(start + textToInsert.length, start + textToInsert.length); }, 0); } };

  const handleSaveCurrentConfiguredSummary = () => {
    if (!newSummaryNameState.trim()) { alert("Please enter a name for this summary."); return; }
    if (!currentEditingView) { alert("No pivot view is currently being configured to save."); return; }
    if (!pivotDataIdentifier) { alert("Cannot save summary: current data identifier is missing."); return; }
    const summaryToSave: Omit<SavedPivotSummary, 'id' | 'createdAt'> = {
        name: newSummaryNameState.trim(),
        associatedDataIdentifier: pivotDataIdentifier,
        pivotConfig: JSON.parse(JSON.stringify(currentEditingView.pivotConfig)),
        pivotOptions: JSON.parse(JSON.stringify(currentEditingView.pivotOptions)),
    };
    savePivotSummary(summaryToSave);
    setNewSummaryNameState('');
    alert(`Pivot summary "${summaryToSave.name}" saved!`);
  };

  const handleLoadSavedSummaryAsNewView = (summaryId: string) => {
    const summaryToLoad = savedPivotSummaries.find(s => s.id === summaryId);
    if (summaryToLoad) {
      if (summaryToLoad.associatedDataIdentifier !== pivotDataIdentifier) {
        alert("Warning: This pivot summary was saved for a different dataset. It will be loaded, but some fields might not match or behave as expected. Please review the configuration carefully.");
      }
      const newViewId = addActivePivotView(summaryToLoad.pivotConfig, summaryToLoad.pivotOptions, summaryToLoad.name);
      setActiveEditingPivotViewId(newViewId); 
      setShowManageSummariesModal(false);
      alert(`Pivot summary "${summaryToLoad.name}" loaded as a new view!`);
    }
  };

  const handleDeleteSummary = (summaryId: string, summaryName: string) => { if (window.confirm(`Are you sure you want to delete the summary "${summaryName}"?`)) { deletePivotSummary(summaryId); alert(`Pivot summary "${summaryName}" deleted.`);}};
  const relevantSavedSummaries = useMemo(() => { if (!pivotDataIdentifier) return []; return savedPivotSummaries.filter(s => s.associatedDataIdentifier === pivotDataIdentifier); }, [savedPivotSummaries, pivotDataIdentifier]);
  const toggleMaximizeView = (viewId: string | null) => { setMaximizedViewId(prevId => prevId === viewId ? null : viewId); if (viewId && !maximizedViewId) { const view = activePivotViews.find(v => v.id === viewId); if (view) { const newWidth = window.innerWidth * 0.95; const newHeight = window.innerHeight * 0.90; setMaximizedViewPosition({ x: (window.innerWidth - newWidth) / 2, y: (window.innerHeight - newHeight) / 2 }); }} };
  const handleMaximizedViewDragMouseDown = (e: React.MouseEvent<HTMLDivElement>) => { if ((e.target as HTMLElement).closest('button')) return; setIsMaximizedViewDragging(true); setMaximizedViewDragStartOffset({ x: e.clientX - maximizedViewPosition.x, y: e.clientY - maximizedViewPosition.y }); document.body.style.userSelect = 'none'; e.preventDefault(); };
  useEffect(() => { const handleMouseMove = (e: MouseEvent) => { if (!isMaximizedViewDragging || !maximizedViewRef.current) return; let newX = e.clientX - maximizedViewDragStartOffset.x, newY = e.clientY - maximizedViewDragStartOffset.y; const gridWidth = maximizedViewRef.current.offsetWidth, gridHeight = maximizedViewRef.current.offsetHeight; newX = Math.max(0, Math.min(newX, window.innerWidth - gridWidth)); newY = Math.max(0, Math.min(newY, window.innerHeight - gridHeight)); setMaximizedViewPosition({ x: newX, y: newY }); }; const handleMouseUp = () => { if (isMaximizedViewDragging) { setIsMaximizedViewDragging(false); document.body.style.userSelect = ''; } }; if (isMaximizedViewDragging) { document.addEventListener('mousemove', handleMouseMove); document.addEventListener('mouseup', handleMouseUp); } return () => { document.removeEventListener('mousemove', handleMouseMove); document.removeEventListener('mouseup', handleMouseUp); if (document.body.style.userSelect === 'none') document.body.style.userSelect = ''; }; }, [isMaximizedViewDragging, maximizedViewDragStartOffset]);

  const currentConfigForPanel = currentEditingView?.pivotConfig || createInitialPivotConfig(); 

  if (!processedData) return ( <div className={`p-8 ${theme.textColor} flex flex-col items-center justify-center h-full`}><AlertTriangle size={48} className={`text-${theme.accent4} mb-4`} /><h2 className="text-2xl font-semibold">No Data Loaded</h2><p className="opacity-70">Please import a file to create a table summary.</p></div> );
  const selectStyles = getSharedSelectBaseStyles(theme, 'text-xs');
  const summaryElementStyle = `flex justify-between items-center py-2 px-1 cursor-pointer rounded hover:bg-${theme.mediumGray}/20 transition-colors list-none`;
  
  if (isPivotPresentationViewActive && currentPresentationView) {
    const { pivotResult: presPivotResult, pivotConfig: presPivotConfig, pivotOptions: presPivotOptions, pivotExpandedKeys: presPivotExpandedKeys, name: presName } = currentPresentationView;
    const presChartData = getChartDataForView(currentPresentationView, presentationChartType, getRenderableRowNodes); // Passed static version
    const tickFillColor = RAW_COLOR_VALUES[theme.textColor.replace('text-','')] || '#E0E0E0';
    const isXAxisHorizontal = presChartData.data.length <= MAX_PIVOT_CHART_POINTS_FOR_HORIZONTAL_LABELS;
    const xAxisChartProps = { dataKey: "name", angle: isXAxisHorizontal ? 0 : -35, textAnchor: isXAxisHorizontal ? "middle" : "end" as const, height: isXAxisHorizontal ? 60 : 80, interval: 0, tick: { fontSize: 10, fill: tickFillColor, dy: isXAxisHorizontal ? 5 : 0 } };

    return ( <div className={`fixed inset-0 z-[1000] ${theme.contentBg} ${theme.textColor} p-4 flex flex-col`}><div className="flex justify-between items-center mb-3 flex-shrink-0"><h2 className={`text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-${theme.accent1} to-${theme.accent2}`}>Presenting: {presName}</h2><div className="flex items-center gap-2"><label htmlFor="presentationChartType" className={`text-xs ${theme.textColor}`}>Chart Type:</label><select id="presentationChartType" value={presentationChartType} onChange={e => setPresentationChartType(e.target.value as AppChartType)} className={`${getSharedSelectBaseStyles(theme, 'text-xs').baseClassName} !w-auto !py-1`} style={getSharedSelectBaseStyles(theme, 'text-xs').style}>{AVAILABLE_CHART_TYPES.map(type => <option key={type} value={type} style={getSharedSelectBaseStyles(theme).optionStyle}>{type.charAt(0).toUpperCase() + type.slice(1)}</option>)}</select><Button onClick={() => { setIsPivotPresentationViewActive(false); setIsSidebarOpen(true);}} variant="secondary" size="sm" leftIcon={<Minimize2 size={16}/>}>Exit</Button></div></div><div className="flex-grow flex flex-col gap-4 overflow-hidden"><div className={`flex-1 min-h-0 border ${theme.borderColor} rounded-lg shadow-lg ${theme.cardBg} overflow-auto futuristic-scrollbar p-2`}>{renderActualPivotTable(currentPresentationView, true, getRenderableRowNodes, getLeafColNodesForData, toggleExpand, isPivotPresentationViewActive, theme, reduceMotion)}</div><div className={`flex-1 min-h-0 border ${theme.borderColor} rounded-lg shadow-lg ${theme.cardBg} overflow-hidden p-2 flex flex-col`}>{presChartData.data.length > 0 && presChartData.series.length > 0 ? (<ResponsiveContainer width="100%" height="100%"><ComposedChart data={presChartData.data} margin={{ top: 5, right: 20, left: 10, bottom: 80 }}><CartesianGrid strokeDasharray="3 3" stroke={RAW_COLOR_VALUES[theme.mediumGray]} /><XAxis {...xAxisChartProps} /><YAxis tick={{ fontSize: 10, fill: tickFillColor }}/><Tooltip contentStyle={{ backgroundColor: RAW_COLOR_VALUES[theme.darkGray], border: `1px solid ${RAW_COLOR_VALUES[theme.mediumGray]}`, borderRadius: '0.5rem', color: tickFillColor }} itemStyle={{ color: tickFillColor }} cursor={{ fill: `${RAW_COLOR_VALUES[theme.accent1]}33` }} /><Legend wrapperStyle={{fontSize: '11px', color: tickFillColor }} />{presChartData.series.map(series => { const commonProps = { key: series.dataKey, dataKey: series.dataKey, name: series.name }; const showValueLabels = presChartData.data.length <= 15; if (presentationChartType === 'line') return <Line {...commonProps} stroke={series.color} strokeWidth={2} dot={{r:3}} activeDot={{r:5}}>{showValueLabels && <LabelList dataKey={series.dataKey} position="top" style={{ fill: tickFillColor, fontSize: '9px' }} formatter={(value: number) => value % 1 === 0 ? value.toString() : value.toFixed(1)} />}</Line>; if (presentationChartType === 'area') return <Area {...commonProps} type="monotone" fill={series.color} stroke={series.color} fillOpacity={0.3} strokeWidth={2}>{showValueLabels && <LabelList dataKey={series.dataKey} position="top" offset={8} style={{ fill: tickFillColor, fontSize: '9px' }} formatter={(value: number) => value % 1 === 0 ? value.toString() : value.toFixed(1)} />}</Area>; return <Bar {...commonProps} fill={series.color}>{showValueLabels && <LabelList dataKey={series.dataKey} position="top" style={{ fill: tickFillColor, fontSize: '10px' }} formatter={(value: number) => value % 1 === 0 ? value.toString() : value.toFixed(1)} />}</Bar>; })}</ComposedChart></ResponsiveContainer>) : <div className="flex-grow flex items-center justify-center"><p className="p-4 text-center opacity-70">No data for chart.</p></div>}</div></div></div> );
  }

  return (
    <div className={`p-4 md:p-6 h-full flex flex-col ${theme.textColor} futuristic-scrollbar overflow-y-auto`}>
      <div className={`flex flex-col md:flex-row justify-between md:items-center mb-4 sticky top-0 z-[60] ${theme.contentBg} py-3 border-b ${theme.borderColor}`}>
        <h1 className={`text-2xl md:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-${theme.accent1} to-${theme.accent2}`}>Interactive Table Summaries</h1>
         <div className="flex items-center gap-2 mt-2 md:mt-0">
            <Button onClick={handleClearLayout} variant="primary" size="sm" leftIcon={<PlusCircle size={16}/>} className="!py-1.5">Add New Pivot View</Button>
            <Button onClick={() => setShowManageSummariesModal(true)} variant="secondary" size="sm" leftIcon={<PackageOpen size={16}/>} className="!py-1.5">Manage Saved Summaries</Button>
        </div>
      </div>
      <div className={`${theme.cardBg} p-4 rounded-lg shadow-xl border ${theme.borderColor} mb-6 sticky top-[calc(var(--header-height,60px)_+_1rem)] z-50`}>
         <h3 className={`text-lg font-semibold mb-2 text-${theme.accent4}`}>Configuring: <span className="italic">{currentEditingView?.name || "No Pivot Selected"}</span></h3>
         { !currentEditingView && <p className="text-xs text-orange-400">Select a pivot view below or add a new one to start configuring.</p>}
         <div className="space-y-3">
            <details className={`border ${theme.borderColor} rounded p-2 group`} open ref={availableFieldsDetailsRef}><summary className={summaryElementStyle}><div className="flex items-center"><PackagePlus size={16} className={`mr-2 text-${theme.accent3}`}/><h4 className={`text-sm font-semibold text-${theme.accent3}`}>Available Fields</h4></div><div className="flex items-center gap-2"><Input type="text" placeholder="Search fields..." value={pivotAvailableFieldsFilter} onChange={(e) => setPivotAvailableFieldsFilter(e.target.value)} onClick={(e) => e.stopPropagation()} className="!p-1 !text-xs !w-32"/><ChevronDown size={16} className="group-open:rotate-180 transition-transform duration-200" /></div></summary><div className="mt-2 border-t ${theme.borderColor} pt-2"><div className="flex flex-wrap items-start gap-1 p-1 min-h-[30px]">{displayableAvailableFields.map(field => renderFieldItem(field, 'available', undefined, false, currentEditingView, theme, handleDragStart, removeFieldFromDragArea, handleValueAggregationChange)) }{filteredAvailableFields.length > MAX_INITIAL_AVAILABLE_FIELDS && (<Button variant="ghost" size="sm" onClick={() => setShowAllAvailableFields(!showAllAvailableFields)} className={`text-xs text-${theme.accent1} hover:underline self-center ml-1`}>{showAllAvailableFields ? <ChevronUp size={12}/> : <ChevronDown size={12}/>}{showAllAvailableFields ? "Less" : `More (${filteredAvailableFields.length - MAX_INITIAL_AVAILABLE_FIELDS})`}</Button>)}{filteredAvailableFields.length === 0 && (<p className={`text-xs ${theme.textColor} opacity-60 italic self-center`}>No matching fields.</p>)}</div></div></details>
            <details className={`border ${theme.borderColor} rounded p-2 group`} open ref={preSummaryFiltersDetailsRef}><summary className={summaryElementStyle}><div className="flex items-center"><FilterIconLucide size={16} className={`mr-2 text-${theme.accent4}`} /><h4 className={`text-sm font-semibold text-${theme.accent4}`}>Pre-Summary Filters</h4></div><ChevronDown size={16} className="group-open:rotate-180 transition-transform duration-200" /></summary><div className="mt-2 border-t ${theme.borderColor} pt-2"><div className="flex items-end gap-2 mb-2"><div className="flex-grow"><label htmlFor="addFilterFieldSelect" className={`block text-[11px] font-medium ${theme.textColor} opacity-80 mb-0.5`}>Add Filter Field:</label><select id="addFilterFieldSelect" value={fieldToAddAsFilter} onChange={(e) => setFieldToAddAsFilter(e.target.value)} className={`${selectStyles.baseClassName} !text-[11px]`} style={selectStyles.style} disabled={!currentEditingView}><option value="">-- Select Field --</option>{allAvailableFields.filter(f => !(currentConfigForPanel.filters || []).some(pf => pf.field === f)).map(f => <option key={f} value={f} style={selectStyles.optionStyle}>{f}</option>)}</select></div><Button onClick={addFilterFieldToConfig} disabled={!fieldToAddAsFilter || !currentEditingView} size="sm" leftIcon={<Plus size={12}/>} className="flex-shrink-0 !py-1">Add</Button></div>{(currentConfigForPanel.filters || []).length > 0 && (<div className="space-y-1.5 max-h-40 overflow-y-auto futuristic-scrollbar pr-1"><h5 className={`text-[11px] font-medium ${theme.textColor} opacity-70 mb-0.5`}>Active Filters:</h5>{(currentConfigForPanel.filters || []).map((filterItem, idx) => (<div key={`filter-config-${filterItem.field}-${idx}`} className={`p-1.5 bg-${theme.mediumGray}/20 rounded border ${theme.borderColor} relative`}><div className="flex items-center justify-between mb-0.5"><span className={`text-[11px] font-semibold ${theme.textColor} truncate mr-1`} title={filterItem.field}>{filterItem.field}</span><div className="flex items-center"><Button variant="ghost" size="sm" className="!p-0.5 !mr-0.5 text-blue-400 hover:text-blue-300" title="Edit filter values" onClick={() => currentEditingView && setOpenFilterValueDropdown(openFilterValueDropdown?.field === filterItem.field && openFilterValueDropdown.viewId === currentEditingView.id ? null : {viewId: currentEditingView.id, field: filterItem.field})}><Edit2 size={10} /></Button><Button variant="ghost" size="sm" onClick={() => removeFilterFieldFromConfig(filterItem.field)} className="!p-0.5 !text-red-400 hover:!text-red-500 hover:!bg-red-500/10"><X size={10} /></Button></div></div><p className={`text-[10px] ${theme.textColor} opacity-80 truncate`}>{filterItem.selectedValues.length > 0 ? (filterItem.selectedValues.length > 2 ? `${filterItem.selectedValues.length} values selected` : filterItem.selectedValues.join(', ')) : "Any Value"}</p>{openFilterValueDropdown?.field === filterItem.field && openFilterValueDropdown.viewId === currentEditingView?.id && (<InlineFilterValueSelector view={currentEditingView!} filterItem={filterItem} filterIndex={idx} handleFilterValueChange={handleFilterValueChange} currentEditingViewId={currentEditingView!.id} />)}</div>))}</div>)}</div></details>
            <details className={`border ${theme.borderColor} rounded p-2 group`} open ref={pivotStructureDetailsRef}><summary className={summaryElementStyle}><div className="flex items-center"><LayoutGrid size={16} className={`mr-2 text-${theme.accent1}`} /><h4 className={`text-sm font-semibold text-${theme.accent1}`}>Pivot Structure</h4></div><ChevronDown size={16} className="group-open:rotate-180 transition-transform duration-200" /></summary><div className={`mt-2 border-t ${theme.borderColor} pt-2 grid grid-cols-1 md:grid-cols-3 gap-2`}>{renderDropZone("Rows", RowsIcon, 'rows', currentConfigForPanel.rows || [], currentEditingView, theme, handleDragOver, handleDrop, undefined, removeFieldFromDragArea, handleValueAggregationChange, handleDragStart)}{renderDropZone("Columns", ColumnsIcon, 'columns', currentConfigForPanel.columns || [], currentEditingView, theme, handleDragOver, handleDrop, undefined, removeFieldFromDragArea, handleValueAggregationChange, handleDragStart)}{renderDropZone("Values", SigmaIcon, 'values', currentConfigForPanel.values || [], currentEditingView, theme, handleDragOver, handleDrop, setIsAddCalculatedMeasureModalOpen, removeFieldFromDragArea, handleValueAggregationChange, handleDragStart)}</div></details>
         </div>
      </div>

       {/* Active Pivot Views Management List */}
      <div className={`${theme.cardBg} p-4 rounded-lg shadow-xl border ${theme.borderColor} mb-6`}>
        <div className="flex items-center mb-3">
            <List size={20} className={`mr-2 text-${theme.accent2}`} />
            <h3 className={`text-md font-semibold text-${theme.accent2}`}>Active Pivot Views ({activePivotViews.length})</h3>
        </div>
        {activePivotViews.length > 0 ? (
          <ul className="space-y-2 max-h-60 overflow-y-auto futuristic-scrollbar pr-1">
            {activePivotViews.map(view => (
              <li 
                key={view.id} 
                className={`p-2 border rounded-md flex justify-between items-center transition-colors duration-150
                            ${view.id === currentEditingPivotViewId ? `bg-${theme.accent4}/20 border-${theme.accent4}` : `${theme.mediumGray}/20 border-${theme.borderColor} hover:bg-${theme.mediumGray}/40`}`}
              >
                {editingViewNameId === view.id ? (
                    <div className="flex items-center gap-1 flex-grow">
                        <Input 
                            value={tempViewName} 
                            onChange={(e) => setTempViewName(e.target.value)} 
                            className="!text-xs !py-0.5 !px-1 w-full" 
                            autoFocus 
                            onBlur={() => saveViewName(view.id)} 
                            onKeyDown={(e) => e.key === 'Enter' && saveViewName(view.id)}
                        />
                        <Button variant="ghost" size="sm" onClick={() => saveViewName(view.id)} className="!p-0.5"><CheckSquare size={14} className={`text-${theme.accent3}`}/></Button>
                        <Button variant="ghost" size="sm" onClick={cancelEditViewName} className="!p-0.5"><X size={14} className={`text-${theme.accent4}`}/></Button>
                    </div>
                ) : (
                    <span 
                        className={`text-sm font-medium truncate cursor-pointer hover:text-${theme.accent1}`} 
                        title={`Configure: ${view.name}`}
                        onClick={() => setActiveEditingPivotViewId(view.id)}
                    >
                        {view.name}
                    </span>
                )}
                <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                    <Button 
                        variant="ghost" size="sm" 
                        onClick={() => setActiveEditingPivotViewId(view.id)} 
                        className={`!p-1 ${view.id === currentEditingPivotViewId ? `text-${theme.accent4}` : theme.textColor } hover:!text-${theme.accent1}`}
                        title="Configure this view"
                    >
                        <Terminal size={14}/>
                    </Button>
                    <Button 
                        variant="ghost" size="sm" 
                        onClick={() => toggleMaximizeView(view.id)} 
                        className={`!p-1 ${theme.textColor} hover:!text-${theme.accent1}`}
                        title="View grid in modal"
                    >
                        <Eye size={14}/>
                    </Button>
                    <Button 
                        variant="ghost" size="sm" 
                        onClick={() => startEditViewName(view)} 
                        className={`!p-1 ${theme.textColor} hover:!text-${theme.accent3}`}
                        title="Edit name"
                    >
                        <EditNameIcon size={14}/>
                    </Button>
                    <Button 
                        variant="ghost" size="sm" 
                        onClick={() => removeActivePivotView(view.id)} 
                        className={`!p-1 text-red-400 hover:!text-red-500`}
                        title="Delete this view"
                        disabled={activePivotViews.length <= 1}
                    >
                        <TrashIcon size={14}/>
                    </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm opacity-70 text-center py-2">No active pivot views. Click "Add New Pivot View" to start.</p>
        )}
      </div>

      {activePivotViews.find(v => v.id === showDisplayOptionsModalForViewId) && <PivotDisplayOptionsModal view={activePivotViews.find(v => v.id === showDisplayOptionsModalForViewId)!} onClose={() => setShowDisplayOptionsModalForViewId(null)} theme={theme} updateActivePivotViewOptions={updateActivePivotViewOptions} calculatePivotForView={calculatePivotForView} />}
      {maximizedViewId && activePivotViews.find(v => v.id === maximizedViewId) && <MaximizedPivotViewModal view={activePivotViews.find(v => v.id === maximizedViewId)!} onClose={() => setMaximizedViewId(null)} theme={theme} reduceMotion={reduceMotion} maximizedViewRef={maximizedViewRef} maximizedViewPosition={maximizedViewPosition} handleMaximizedViewDragMouseDown={handleMaximizedViewDragMouseDown} renderActualPivotTable={renderActualPivotTable} getRenderableRowNodes={getRenderableRowNodes} getLeafColNodesForData={getLeafColNodesForData} toggleExpand={toggleExpand} handleCollapseAll={handleCollapseAll} handleExpandAll={handleExpandAll} exportPivotToExcel={exportPivotToExcel} setChartModalViewId={setChartModalViewId} setShowDisplayOptionsModalForViewId={setShowDisplayOptionsModalForViewId} isPivotPresentationViewActive={isPivotPresentationViewActive} calculatePivotForView={calculatePivotForView} />}
      {chartModalViewId && activePivotViews.find(v => v.id === chartModalViewId) && <PivotChartModal view={activePivotViews.find(v => v.id === chartModalViewId)!} initialChartType={chartModalType} onClose={() => setChartModalViewId(null)} theme={theme} getChartDataForView={getChartDataForView} getRenderableRowNodes={getRenderableRowNodes} />}
      {currentEditingView && <CalculatedMeasureModal isOpen={isAddCalculatedMeasureModalOpen} onClose={() => setIsAddCalculatedMeasureModalOpen(false)} view={currentEditingView} theme={theme} newCalcMeasureName={newCalcMeasureNameState} setNewCalcMeasureName={setNewCalcMeasureNameState} newCalcMeasureFormula={newCalcMeasureFormulaState} setNewCalcMeasureFormula={setNewCalcMeasureFormulaState} calcMeasureFormulaInputRef={calcMeasureFormulaInputRef} handleAddCalculatedMeasure={handleAddCalculatedMeasure} insertAggFieldIntoCalcFormula={insertAggFieldIntoCalcFormula} />}
      <ManageSummariesModal isOpen={showManageSummariesModal} onClose={() => setShowManageSummariesModal(false)} theme={theme} newSummaryName={newSummaryNameState} setNewSummaryName={setNewSummaryNameState} handleSaveCurrentConfiguredSummary={handleSaveCurrentConfiguredSummary} relevantSavedSummaries={relevantSavedSummaries} handleLoadSavedSummaryAsNewView={handleLoadSavedSummaryAsNewView} handleDeleteSummary={handleDeleteSummary} pivotDataIdentifier={pivotDataIdentifier} />
    </div>
  );
};

// --- Helper Components for Modals and Rendering Logic ---
// (These are defined outside the main PivotTable component scope to be callable by it)

interface PivotDisplayOptionsModalProps { view: ActivePivotView; onClose: () => void; theme: Theme; updateActivePivotViewOptions: AppContextType['updateActivePivotViewOptions']; calculatePivotForView: (view: ActivePivotView | undefined) => void;}
const PivotDisplayOptionsModal: React.FC<PivotDisplayOptionsModalProps> = ({ view, onClose, theme, updateActivePivotViewOptions, calculatePivotForView }) => {
  const [localOptions, setLocalOptions] = useState(view.pivotOptions);
  useEffect(() => { setLocalOptions(view.pivotOptions); }, [view.pivotOptions]);
  const handleSave = () => { updateActivePivotViewOptions(view.id, localOptions); calculatePivotForView(view); onClose(); };
  return (<Modal isOpen={true} onClose={onClose} title={`Display Options for ${view.name}`} size="sm"><div className="space-y-3">{[{label: "Show Row Grand Totals", key: "showRowGrandTotals"},{label: "Show Column Grand Totals", key: "showColumnGrandTotals"},{label: "Show Row Subtotals", key: "showRowSubtotals"},{label: "Show Column Subtotals", key: "showColumnSubtotals"},{label: "Default Row Subtotals Collapsed", key: "defaultRowSubtotalsCollapsed"},{label: "Default Column Subtotals Collapsed", key: "defaultColumnSubtotalsCollapsed"}].map(opt => (<label key={opt.key} className={`flex items-center space-x-2 p-1.5 hover:bg-${theme.mediumGray}/30 rounded cursor-pointer ${theme.textColor}`}><input type="checkbox" checked={localOptions[opt.key as keyof PivotOptions]} onChange={(e) => setLocalOptions(prev => ({...prev, [opt.key]: e.target.checked}))} className={`form-checkbox h-4 w-4 rounded border-${theme.mediumGray} text-${theme.accent1} focus:ring-1 focus:ring-offset-0 focus:ring-${theme.accent1}`} style={{ accentColor: RAW_COLOR_VALUES[theme.accent1] }}/><span className="text-sm">{opt.label}</span></label>))}<div className="flex justify-end gap-2 mt-4"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button variant="primary" onClick={handleSave}>Apply</Button></div></div></Modal>);
};

const MaximizedPivotViewModalInternal: React.FC<MaximizedPivotViewModalProps> = ({ view, onClose, theme, reduceMotion, maximizedViewRef, maximizedViewPosition, handleMaximizedViewDragMouseDown, renderActualPivotTable, getRenderableRowNodes, getLeafColNodesForData, toggleExpand, handleCollapseAll, handleExpandAll, exportPivotToExcel, setChartModalViewId, setShowDisplayOptionsModalForViewId, isPivotPresentationViewActive, calculatePivotForView }) => {
  const [showOptionsInMaximized, setShowOptionsInMaximized] = useState(false);
  const localAppContext = useContext(AppContext) as AppContextType;
  return (
    <div ref={maximizedViewRef} style={{ position: 'fixed', left: `${maximizedViewPosition.x}px`, top: `${maximizedViewPosition.y}px`, width: '95vw', height: '90vh', zIndex: 1050 }} className={`${theme.cardBg} border-2 border-${theme.accent1} rounded-xl shadow-2xl flex flex-col overflow-hidden`}>
      <div className={`p-2 border-b ${theme.borderColor} flex justify-between items-center cursor-grab bg-gradient-to-r from-${theme.accent1}/80 via-${theme.accent2}/70 to-${theme.accent3}/80`} onMouseDown={handleMaximizedViewDragMouseDown}>
        <div className='flex items-center'><MoveIcon size={16} className={`mr-2 text-white/80`} /><h3 className="text-lg font-semibold text-white">Pivot: {view.name} (Maximized)</h3></div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => setShowOptionsInMaximized(true)} title="Options" className="!p-1 !text-white hover:!bg-white/20"><Settings2 size={18}/></Button>
          <Button variant="ghost" size="sm" onClick={() => view.pivotResult && exportPivotToExcel(view.pivotResult, view.pivotConfig, view.pivotOptions, theme.cardBg)} title="Export" className="!p-1 !text-white hover:!bg-white/20" disabled={!view.pivotResult}><Download size={18}/></Button>
          <Button variant="ghost" size="sm" onClick={() => view.pivotResult && setChartModalViewId(view.id)} title="Chart" className="!p-1 !text-white hover:!bg-white/20" disabled={!view.pivotResult}><ChartIconLucide size={18}/></Button>
          <div className={`h-4 w-px bg-white/50 mx-1`}></div>
          <Button variant="ghost" size="sm" onClick={() => handleCollapseAll(view.id)} title="Collapse All" className="!p-1 !text-white hover:!bg-white/20"><ListCollapse size={18}/></Button>
          <Button variant="ghost" size="sm" onClick={() => handleExpandAll(view.id)} title="Expand All" className="!p-1 !text-white hover:!bg-white/20"><ListTree size={18}/></Button>
          <Button variant="ghost" size="sm" onClick={onClose} title="Restore" className="!p-1 !text-white hover:!bg-white/20"><Minimize2 size={18}/></Button>
        </div>
      </div>
      <div className="flex-grow overflow-auto futuristic-scrollbar p-2 bg-${theme.darkBg}/50">{renderActualPivotTable(view, true, getRenderableRowNodes, getLeafColNodesForData, toggleExpand, isPivotPresentationViewActive, theme, reduceMotion)}</div>
      {showOptionsInMaximized && localAppContext && <PivotDisplayOptionsModal view={view} onClose={() => setShowOptionsInMaximized(false)} theme={theme} updateActivePivotViewOptions={localAppContext.updateActivePivotViewOptions} calculatePivotForView={() => calculatePivotForView(view)} />}
    </div>
  );
};
const MaximizedPivotViewModal = MaximizedPivotViewModalInternal;


interface PivotChartModalProps { view: ActivePivotView; initialChartType: AppChartType; onClose: () => void; theme: Theme; getChartDataForView: Function; getRenderableRowNodes: Function;}
const PivotChartModal: React.FC<PivotChartModalProps> = ({ view, initialChartType, onClose, theme, getChartDataForView, getRenderableRowNodes }) => {
    const [chartType, setChartType] = useState<AppChartType>(initialChartType);
    const chartDataResult = getChartDataForView(view, chartType, getRenderableRowNodes);
    const tickFillColor = RAW_COLOR_VALUES[theme.textColor.replace('text-','')] || '#E0E0E0';
    const isXAxisHorizontal = chartDataResult.data.length <= MAX_PIVOT_CHART_POINTS_FOR_HORIZONTAL_LABELS;
    const xAxisChartProps = { dataKey: "name", angle: isXAxisHorizontal ? 0 : -35, textAnchor: isXAxisHorizontal ? "middle" : "end" as const, height: isXAxisHorizontal ? 60 : 80, interval: 0, tick: { fontSize: 10, fill: tickFillColor, dy: isXAxisHorizontal ? 5 : 0 } };

    return (<Modal isOpen={true} onClose={onClose} title={`Chart for ${view.name}`} size="full"><div className="h-full flex flex-col"><div className="p-2 border-b ${theme.borderColor} flex items-center justify-end gap-2"><label htmlFor="pivotChartTypeModal" className={`text-xs ${theme.textColor}`}>Chart Type:</label><select id="pivotChartTypeModal" value={chartType} onChange={e => setChartType(e.target.value as AppChartType)} className={`${getSharedSelectBaseStyles(theme, 'text-xs').baseClassName} !w-auto !py-1`} style={getSharedSelectBaseStyles(theme, 'text-xs').style}>{AVAILABLE_CHART_TYPES.map(type => <option key={type} value={type} style={getSharedSelectBaseStyles(theme).optionStyle}>{type.charAt(0).toUpperCase() + type.slice(1)}</option>)}</select></div>{chartDataResult.data.length > 0 && chartDataResult.series.length > 0 ? (<div className="flex-grow p-2"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={chartDataResult.data} margin={{ top: 5, right: 20, left: 10, bottom: (isXAxisHorizontal ? 50:80)}}><CartesianGrid strokeDasharray="3 3" stroke={RAW_COLOR_VALUES[theme.mediumGray]} /><XAxis {...xAxisChartProps} /><YAxis tick={{ fontSize: 10, fill: tickFillColor }}/><Tooltip contentStyle={{ backgroundColor: RAW_COLOR_VALUES[theme.darkGray], border: `1px solid ${RAW_COLOR_VALUES[theme.mediumGray]}`, borderRadius: '0.5rem', color: tickFillColor }} itemStyle={{ color: tickFillColor }} cursor={{ fill: `${RAW_COLOR_VALUES[theme.accent1]}33` }} /><Legend wrapperStyle={{fontSize: '11px', color: tickFillColor}} />{chartDataResult.series.map((series:any) => { const commonProps = { key: series.dataKey, dataKey: series.dataKey, name: series.name }; const showValueLabels = chartDataResult.data.length <= 15; if (chartType === 'line') return <Line {...commonProps} stroke={series.color} strokeWidth={2} dot={{r:3}} activeDot={{r:5}}>{showValueLabels && <LabelList dataKey={series.dataKey} position="top" style={{ fill: tickFillColor, fontSize: '9px' }} formatter={(value: number) => value % 1 === 0 ? value.toString() : value.toFixed(1)} />}</Line>; if (chartType === 'area') return <Area {...commonProps} type="monotone" fill={series.color} stroke={series.color} fillOpacity={0.3} strokeWidth={2}>{showValueLabels && <LabelList dataKey={series.dataKey} position="top" offset={8} style={{ fill: tickFillColor, fontSize: '9px' }} formatter={(value: number) => value % 1 === 0 ? value.toString() : value.toFixed(1)} />}</Area>; return <Bar {...commonProps} fill={series.color}>{showValueLabels && <LabelList dataKey={series.dataKey} position="top" style={{ fill: tickFillColor, fontSize: '10px' }} formatter={(value: number) => value % 1 === 0 ? value.toString() : value.toFixed(1)} />}</Bar>; })}</ComposedChart></ResponsiveContainer></div>) : <p className="p-4 text-center">No data available for charting or chart configuration is pending.</p>}</div></Modal>);
};

interface CalculatedMeasureModalProps { isOpen: boolean; onClose: () => void; view: ActivePivotView; theme:Theme; newCalcMeasureName:string; setNewCalcMeasureName: React.Dispatch<React.SetStateAction<string>>; newCalcMeasureFormula: string; setNewCalcMeasureFormula: React.Dispatch<React.SetStateAction<string>>; calcMeasureFormulaInputRef: React.RefObject<HTMLTextAreaElement>; handleAddCalculatedMeasure:()=>void; insertAggFieldIntoCalcFormula:(fieldName:string)=>void;}
const CalculatedMeasureModal: React.FC<CalculatedMeasureModalProps> = ({isOpen, onClose, view, theme, newCalcMeasureName, setNewCalcMeasureName, newCalcMeasureFormula, setNewCalcMeasureFormula, calcMeasureFormulaInputRef, handleAddCalculatedMeasure, insertAggFieldIntoCalcFormula}) => {
    const { pivotConfig } = view;
    return (<Modal isOpen={isOpen} onClose={onClose} title="Add Calculated Measure" size="lg"><div className="space-y-4"><div><label htmlFor="newCalcMeasureName" className={`block text-sm font-medium mb-1 ${theme.textColor}`}>Measure Name</label><Input id="newCalcMeasureName" value={newCalcMeasureName} onChange={(e) => setNewCalcMeasureName(e.target.value)} placeholder="Unique measure name" /></div><div><label htmlFor="newCalcMeasureFormula" className={`block text-sm font-medium mb-1 ${theme.textColor}`}>Formula</label><textarea id="newCalcMeasureFormula" ref={calcMeasureFormulaInputRef} value={newCalcMeasureFormula} onChange={(e) => setNewCalcMeasureFormula(e.target.value)} placeholder="e.g., [SUM(Sales)] / [COUNT(Orders)]" rows={3} className={`w-full p-2 rounded-md border focus:ring-2 focus:ring-${theme.accent1} focus:border-${theme.accent1} transition-colors futuristic-scrollbar text-sm`} style={{ backgroundColor: RAW_COLOR_VALUES[theme.darkGray], color: RAW_COLOR_VALUES[theme.textColor.replace('text-','')], borderColor: RAW_COLOR_VALUES[theme.mediumGray]}}/></div><div><p className={`text-xs font-medium ${theme.textColor} opacity-80 mb-1`}>Available Aggregated Fields (click to insert):</p><div className={`flex flex-wrap gap-1 max-h-24 overflow-y-auto futuristic-scrollbar p-1 border border-${theme.mediumGray} rounded-md`}>{(pivotConfig.values || []).map(vf => { const aggFieldName = `${vf.aggregation.toUpperCase()}(${vf.field})`; return (<Button key={`agg-field-btn-${aggFieldName}`} variant="ghost" size="sm" onClick={() => insertAggFieldIntoCalcFormula(aggFieldName)} className={`!text-xs !px-1.5 !py-0.5 bg-${theme.mediumGray}/30 hover:bg-${theme.accent1}/30`}>{aggFieldName}</Button>)})} {(pivotConfig.values || []).length === 0 && <p className="text-xs opacity-60 italic p-1">Add fields to 'Values' area first.</p>}</div><p className={`text-xs ${theme.textColor} opacity-70 mt-1`}>Supported Operators: +, -, *, /, ()</p></div><div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button variant="primary" onClick={handleAddCalculatedMeasure}>Add Measure</Button></div></div></Modal>);
};

interface ManageSummariesModalProps { isOpen: boolean; onClose: () => void; theme: Theme; newSummaryName:string; setNewSummaryName: React.Dispatch<React.SetStateAction<string>>; handleSaveCurrentConfiguredSummary:()=>void; relevantSavedSummaries: SavedPivotSummary[]; handleLoadSavedSummaryAsNewView:(id:string)=>void; handleDeleteSummary:(id:string, name:string)=>void; pivotDataIdentifier: string | null;}
const ManageSummariesModal: React.FC<ManageSummariesModalProps> = ({ isOpen, onClose, theme, newSummaryName, setNewSummaryName, handleSaveCurrentConfiguredSummary, relevantSavedSummaries, handleLoadSavedSummaryAsNewView, handleDeleteSummary, pivotDataIdentifier }) => {
    return (<Modal isOpen={isOpen} onClose={onClose} title="Manage Pivot Summaries" size="lg"><div className="space-y-4"><div><h4 className={`text-md font-semibold mb-2 text-${theme.accent1}`}>Save Currently Configured Pivot</h4><div className="flex gap-2"><Input type="text" value={newSummaryName} onChange={(e) => setNewSummaryName(e.target.value)} placeholder="Enter summary name..." className="flex-grow"/><Button onClick={handleSaveCurrentConfiguredSummary} variant="primary" size="md" disabled={!newSummaryName.trim() || !pivotDataIdentifier} leftIcon={<Save size={16}/>}>Save</Button></div>{!pivotDataIdentifier && <p className="text-xs text-red-400 mt-1">Cannot save: No active data identifier.</p>}</div><hr className={theme.borderColor} /><div><h4 className={`text-md font-semibold mb-2 text-${theme.accent2}`}>Load Saved Summary (as new view)</h4>{relevantSavedSummaries.length > 0 ? (<ul className="space-y-2 max-h-60 overflow-y-auto futuristic-scrollbar pr-1">{relevantSavedSummaries.map(summary => (<li key={summary.id} className={`p-2 border rounded-md ${theme.borderColor} flex justify-between items-center bg-${theme.mediumGray}/20`}><div><p className="font-medium">{summary.name}</p><p className="text-xs opacity-70">Saved: {new Date(summary.createdAt).toLocaleString()}</p></div><div className="flex gap-2"><Button onClick={() => handleLoadSavedSummaryAsNewView(summary.id)} variant="secondary" size="sm">Load as New</Button><Button onClick={() => handleDeleteSummary(summary.id, summary.name)} variant="danger" size="sm"><TrashIcon size={14}/></Button></div></li>))}</ul>) : (<p className="text-sm opacity-70">No saved summaries for this specific dataset yet.</p>)}</div><div className="flex justify-end mt-4"><Button variant="secondary" onClick={onClose}>Close</Button></div></div></Modal>);
};

const getChartDataForView = (view: ActivePivotView, chartType: AppChartType, getRenderableRowNodesFn: (view: ActivePivotView) => PivotRowHeader[]): { data: any[]; series: { dataKey: string; name: string; color: string; type?: AppChartType }[] } => {
    if (!view.pivotResult) return { data: [], series: [] };
    const { dataMatrix, allColumnKeys = [], columnHeadersTree = [] } = view.pivotResult;
    const { values: valueCfgs = [], calculatedMeasures: calculatedMeasuresCfgs = [] } = view.pivotConfig;
    const newChartDataInternal: any[] = [];
    const newSeriesInternal: { dataKey: string; name: string; color: string; type?: AppChartType }[] = [];
    let colorIdx = 0;
    const allMeasureCfgsForChart: UnifiedMeasureConfigForPivot[] = [
        ...valueCfgs.map(vc => ({ ...vc, isCalculated: false as const })),
        ...calculatedMeasuresCfgs.map(cm => ({ ...cm, isCalculated: true as const, aggregation: 'Calculated' as const }))
    ];

    (allColumnKeys).forEach(colKey => {
        if (colKey === DUMMY_COLUMN_KEY_FOR_VALUES_ONLY && view.pivotConfig.columns.length > 0) return;
        const colNode = columnHeadersTree.find(ch => ch.key === colKey);
        if (colNode && colNode.isGrandTotal && !view.pivotOptions.showColumnGrandTotals) return;
        if (colNode && colNode.isSubtotal && !view.pivotOptions.showColumnSubtotals) return;
        const colLabel = colNode ? colNode.label : (colKey === DUMMY_COLUMN_KEY_FOR_VALUES_ONLY ? "" : colKey);

        (allMeasureCfgsForChart).forEach(mc => {
            let measureKeyForDataKey: string, measureKeyForName: string;
            if (mc.isCalculated) { measureKeyForDataKey = mc.name; measureKeyForName = mc.name; }
            else { const pvc = mc as PivotValueFieldConfig; measureKeyForDataKey = `${pvc.field}_${pvc.aggregation}`; measureKeyForName = `${pvc.field} (${pvc.aggregation})`; }
            const seriesDataKey = `${colKey}_${measureKeyForDataKey}`.replace(/[^a-zA-Z0-9_]/g, '_');
            const seriesName = `${colLabel}${colLabel && allMeasureCfgsForChart.length > 1 ? " - " : ""}${allMeasureCfgsForChart.length > 1 || !colLabel ? measureKeyForName : ""}`.trim() || measureKeyForName;
            newSeriesInternal.push({ dataKey: seriesDataKey, name: seriesName, color: CHART_COLOR_PALETTE[colorIdx % CHART_COLOR_PALETTE.length], type: chartType });
            colorIdx++;
        });
    });

    const visibleRows = getRenderableRowNodesFn(view); 
    visibleRows.forEach(rowNode => {
        if (rowNode.isGrandTotal && !view.pivotOptions.showRowGrandTotals) return;
        if (rowNode.isSubtotal && !view.pivotOptions.showRowSubtotals) return;
        const dataPoint: any = { name: rowNode.label };
        (allColumnKeys).forEach(colKey => {
            if (colKey === DUMMY_COLUMN_KEY_FOR_VALUES_ONLY && view.pivotConfig.columns.length > 0) return;
            const colNode = columnHeadersTree.find(ch => ch.key === colKey);
            if (colNode && colNode.isGrandTotal && !view.pivotOptions.showColumnGrandTotals) return;
            if (colNode && colNode.isSubtotal && !view.pivotOptions.showColumnSubtotals) return;
            let dataLookupKey = rowNode.key;
            if (rowNode.children && rowNode.children.length > 0 && !view.pivotExpandedKeys.has(rowNode.key) && !rowNode.isSubtotal && !rowNode.isGrandTotal) dataLookupKey = `${rowNode.key}|-|SUBTOTAL`;
            const cell = dataMatrix.get(dataLookupKey)?.get(colKey);
            if (cell) {
                (allMeasureCfgsForChart).forEach(mc => {
                    let measureKeyForDataKey: string, measureKeyForCellAccess: string;
                    if (mc.isCalculated) { measureKeyForDataKey = mc.name; measureKeyForCellAccess = mc.name; }
                    else { const pvc = mc as PivotValueFieldConfig; measureKeyForDataKey = `${pvc.field}_${pvc.aggregation}`; measureKeyForCellAccess = `${pvc.field} (${pvc.aggregation})`;}
                    const seriesDataKey = `${colKey}_${measureKeyForDataKey}`.replace(/[^a-zA-Z0-9_]/g, '_');
                    dataPoint[seriesDataKey] = cell[measureKeyForCellAccess];
                });
            }
        });
        newChartDataInternal.push(dataPoint);
    });
    return { data: newChartDataInternal, series: newSeriesInternal };
};

const ViewActionMenu: React.FC<{ view: ActivePivotView, actions: Array<{label: string, icon: React.ElementType, action: () => void, disabled?: boolean, colorClass?: string}>, theme: Theme }> = ({ view, actions, theme }) => {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    useEffect(() => { const handleClickOutside = (event: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(event.target as Node)) { setIsOpen(false); } }; document.addEventListener("mousedown", handleClickOutside); return () => document.removeEventListener("mousedown", handleClickOutside); }, []);
    return ( <div className="relative" ref={menuRef}> <Button variant="ghost" size="sm" onClick={() => setIsOpen(!isOpen)} className="!p-1"><Ellipsis size={16}/></Button> {isOpen && ( <div className={`absolute top-full right-0 mt-1 w-56 p-1 rounded-lg shadow-2xl z-50 border ${theme.cardBg} border-${theme.borderColor}`}> {actions.map(item => ( <Button key={item.label} variant="ghost" size="sm" onClick={() => { item.action(); setIsOpen(false); }} disabled={item.disabled} className={`w-full justify-start text-xs !py-1.5 ${item.colorClass || theme.textColor} hover:bg-${theme.mediumGray}/30 hover:!text-${theme.accent1}`} leftIcon={<item.icon size={14}/>}> {item.label} </Button> ))} </div> )} </div> );
};

const renderFieldItem = (field: string, area: PivotArea, index?:number, isCalculatedMeasure: boolean = false, currentEditingView?: ActivePivotView, theme?: Theme, handleDragStartFn?: Function, removeFieldFromDragAreaFn?: Function, handleValueAggregationChangeFn?: Function) => {
    if (!theme || !currentEditingView) return null;
    return ( <div key={`${area}-${field}-${index}-${isCalculatedMeasure}`} draggable={(area === 'available' || (area === 'values' && !isCalculatedMeasure))} onDragStart={() => (area === 'available' || (area === 'values' && !isCalculatedMeasure)) && handleDragStartFn && handleDragStartFn(field, area, index, isCalculatedMeasure)} className={`p-1.5 border ${theme.borderColor} rounded-md flex items-center justify-between ${(area === 'available' || (area === 'values' && !isCalculatedMeasure)) ? 'cursor-grab' : 'cursor-default'} text-xs my-0.5 mx-0.5 bg-${theme.mediumGray}/30 hover:bg-${theme.mediumGray}/60 transition-colors duration-150 ${area === 'available' ? 'inline-flex flex-shrink-0 max-w-[150px]' : 'my-1'} ${isCalculatedMeasure ? `border-${theme.accent3}/50 shadow-sm shadow-${theme.accent3}/30` : ''}`}> {area !== 'available' && <GripVertical size={12} className={`mr-1.5 ${theme.textColor} opacity-50 flex-shrink-0`}/>} <span className={`truncate flex-grow ${theme.textColor}`} title={field}>{isCalculatedMeasure && <Calculator size={10} className="inline mr-1 text-yellow-500" />}{field}</span> {(area !== 'available' ) && (<div className="flex items-center flex-shrink-0 ml-1">{area === 'values' && !isCalculatedMeasure && index !== undefined && currentEditingView.pivotConfig.values[index] && (<select value={currentEditingView.pivotConfig.values[index].aggregation} onChange={(e) => handleValueAggregationChangeFn && handleValueAggregationChangeFn(index, e.target.value as AggregationType)} onClick={(e) => e.stopPropagation()} className={`${getSharedSelectBaseStyles(theme, 'text-[10px]').baseClassName} !py-0 !px-1 !w-auto mr-0.5`} style={{...getSharedSelectBaseStyles(theme, 'text-[10px]').style, paddingRight: '1rem'}}>{AGGREGATION_OPTIONS.map(agg => <option key={String(agg)} value={String(agg)} style={getSharedSelectBaseStyles(theme).optionStyle}>{String(agg)}</option>)}</select>)}<Button variant="ghost" size="sm" onClick={() => removeFieldFromDragAreaFn && removeFieldFromDragAreaFn(field, area, isCalculatedMeasure)} className="!p-0.5 !text-red-400 hover:!text-red-500 hover:!bg-red-500/10 h-full"><X size={12} /></Button></div>)} </div> );
  };

const renderDropZone = (title: string, IconElement: React.ElementType | null, area: PivotArea, fields: PivotFieldConfig[] | PivotValueFieldConfig[], currentEditingView?: ActivePivotView, theme?:Theme, handleDragOverFn?: any, handleDropFn?: any, setIsAddCalculatedMeasureModalOpenFn?: Function, removeFieldFromDragAreaFn?:Function, handleValueAggregationChangeFn?:Function, handleDragStartFn?:Function) => {
    if (!theme || !currentEditingView) return null;
    const configForArea = currentEditingView.pivotConfig;
    return ( <div className={`p-2 border-2 border-dashed ${theme.borderColor} rounded-lg min-h-[60px] h-full flex flex-col bg-${theme.darkGray}/30 futuristic-scrollbar overflow-y-auto hover:border-${theme.accent1} transition-colors duration-150`} onDragOver={handleDragOverFn} onDrop={() => handleDropFn && handleDropFn(area)}> {IconElement && (<div className="flex items-center mb-1.5"><IconElement size={14} className={`mr-1.5 text-${theme.accent2} flex-shrink-0`}/><h4 className={`text-xs font-semibold text-${theme.accent2}`}>{title}</h4></div>)} {!IconElement && title && <h4 className={`text-xs font-semibold text-${theme.accent2} mb-1.5`}>{title}</h4> } {fields.length === 0 && area !== 'values' && <p className={`text-[11px] text-center ${theme.textColor} opacity-50 mt-1 flex-grow flex items-center justify-center`}>Drop fields here</p>} {area === 'values' && (configForArea.values.length + (configForArea.calculatedMeasures || []).length) === 0 && (<p className={`text-[11px] text-center ${theme.textColor} opacity-50 mt-1 flex-grow flex items-center justify-center`}>Drop fields here</p>)} {area === 'values' && (fields as PivotValueFieldConfig[]).map((item, idx) => renderFieldItem(item.field, area, idx, false, currentEditingView, theme, handleDragStartFn, removeFieldFromDragAreaFn, handleValueAggregationChangeFn))} {area === 'values' && (configForArea.calculatedMeasures || []).map(cm => renderFieldItem(cm.name, area, undefined, true, currentEditingView, theme, handleDragStartFn, removeFieldFromDragAreaFn, handleValueAggregationChangeFn))} {area === 'values' && setIsAddCalculatedMeasureModalOpenFn && (<Button variant="ghost" size="sm" onClick={() => setIsAddCalculatedMeasureModalOpenFn(true)} className={`w-full mt-1.5 !text-xs !py-1 text-${theme.accent3} border border-dashed border-${theme.accent3}/50 hover:bg-${theme.accent3}/10`} leftIcon={<Calculator size={12}/>}>Add Calculated Measure</Button>)} </div> );
  };

interface InlineFilterValueSelectorProps {view: ActivePivotView, filterItem: {field: string, selectedValues: string[]}, filterIndex: number, handleFilterValueChange: (viewId: string, field:string, values:string[])=>void, currentEditingViewId: string }
const InlineFilterValueSelector: React.FC<InlineFilterValueSelectorProps> = ({view, filterItem, filterIndex, handleFilterValueChange, currentEditingViewId}) => {
    const { theme, processedData, openFilterValueDropdown, setOpenFilterValueDropdown } = useContext(AppContext) as AppContextType; 
    const [searchTerm, setSearchTerm] = useState(''); const dropdownRef = useRef<HTMLDivElement>(null);
    const availableValues = useMemo(() => { if (!processedData) return []; let dataForThisFilter = processedData.data; for (let i = 0; i < filterIndex; i++) { const prevFilter = view.pivotConfig.filters[i]; if (prevFilter.selectedValues.length > 0) dataForThisFilter = dataForThisFilter.filter(row => prevFilter.selectedValues.includes(String(row[prevFilter.field]))); } return [...new Set(dataForThisFilter.map(row => String(row[filterItem.field])))].sort(); }, [processedData, filterItem.field, filterIndex, view.pivotConfig.filters]);
    const filteredValues = useMemo(() => availableValues.filter(val => String(val).toLowerCase().includes(searchTerm.toLowerCase())), [availableValues, searchTerm]);
    useEffect(() => { const handleClickOutside = (event: MouseEvent) => { if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) if (openFilterValueDropdown?.field === filterItem.field && openFilterValueDropdown.viewId === view.id) setOpenFilterValueDropdown(null); }; document.addEventListener("mousedown", handleClickOutside); return () => document.removeEventListener("mousedown", handleClickOutside); }, [openFilterValueDropdown, filterItem.field, view.id, setOpenFilterValueDropdown]);
    const toggleValueSelection = (value: string) => { const newSelectedValues = filterItem.selectedValues.includes(value) ? filterItem.selectedValues.filter(v => v !== value) : [...filterItem.selectedValues, value]; handleFilterValueChange(view.id, filterItem.field, newSelectedValues); };
    if (!openFilterValueDropdown || openFilterValueDropdown.field !== filterItem.field || openFilterValueDropdown.viewId !== view.id) return null; 
    return ( <div ref={dropdownRef} className={`absolute z-40 mt-1 w-full max-w-xs p-2 border ${theme.borderColor} ${theme.cardBg} rounded-md shadow-lg max-h-48 overflow-y-auto futuristic-scrollbar`}><Input type="text" placeholder="Search values..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="!w-full !p-1 !mb-2 !text-xs"/>{filteredValues.map(val => (<label key={val} className={`flex items-center space-x-2 p-1 hover:bg-${theme.mediumGray}/50 rounded cursor-pointer ${theme.textColor}`}><input type="checkbox" checked={filterItem.selectedValues.includes(val)} onChange={() => toggleValueSelection(val)} className={`form-checkbox h-3 w-3.5 rounded border-${theme.mediumGray} text-${theme.accent1} focus:ring-1 focus:ring-offset-0 focus:ring-${theme.accent1}`} style={{ accentColor: RAW_COLOR_VALUES[theme.accent1]}}/><span className="text-xs truncate">{val || '(empty)'}</span></label>))} {filteredValues.length === 0 && <p className="text-xs text-center opacity-70">No values found.</p>}</div> );
};

const renderActualPivotTable = (
    view: ActivePivotView, 
    isMaximizedView: boolean, 
    getRenderableRowNodesFn: Function, 
    getLeafColNodesForDataFn: Function, 
    toggleExpandFn: Function, 
    isPivotPresentationViewActiveParam: boolean,
    theme: Theme, 
    reduceMotion: boolean
) => {
    const { pivotResult, pivotConfig, pivotOptions, pivotExpandedKeys } = view;
    if (!pivotResult) return null;
    const visibleRowHeaders = getRenderableRowNodesFn(view);
    const leafColNodesForData = getLeafColNodesForDataFn(view);
    const maxRowDepth = pivotConfig.rows.length > 0 ? pivotConfig.rows.length : 1;
    let maxColHeaderLevel = pivotConfig.columns.length > 0 ? pivotConfig.columns.length : (pivotConfig.values.length > 0 || (pivotConfig.calculatedMeasures && pivotConfig.calculatedMeasures.length > 0) ? 1 : 0);
    const cornerCellContent = (<div className={`p-1 text-[10px] ${theme.textColor} opacity-80 flex flex-col items-start justify-center h-full`}>{pivotConfig.rows.length > 0 && <span className="font-semibold">Rows:</span>}{pivotConfig.rows.map(r => <span key={`rowname-${r.field}`} className="truncate block w-full text-left pl-1">{r.field}</span>)}</div>);
    const getHeaderBg = (isTotal?: boolean, isSubtotal?: boolean) => isTotal ? `bg-gradient-to-b from-${theme.accent1}/80 to-${theme.accent1}/60` : isSubtotal ? `bg-gradient-to-b from-${theme.accent2}/70 to-${theme.accent2}/50` : `bg-gradient-to-b from-${theme.mediumGray}/80 to-${theme.darkGray}/70`;
    const headerCellStyle: React.CSSProperties = { textShadow: '1px 1px 2px rgba(0,0,0,0.3)', boxShadow: 'inset 1px 1px 3px rgba(0,0,0,0.2), inset -1px -1px 3px rgba(255,255,255,0.1)', color: theme.textColor.startsWith('text-') ? RAW_COLOR_VALUES[theme.textColor.replace('text-','')] : theme.textColor };
    const dataCellStyle: React.CSSProperties = { transition: reduceMotion ? 'none' : 'transform 0.2s ease-out, box-shadow 0.2s ease-out' };
    const dataCellHoverClass = reduceMotion ? '' : `hover:transform hover:-translate-y-px hover:scale-[1.01] hover:shadow-lg hover:shadow-${theme.accent1}/30 hover:relative hover:z-[5]`;
    const cellStyle = (isRowTotal?: boolean, isRowSubtotal?: boolean, isColTotal?: boolean, isColSubtotal?: boolean) => { let bgColorClass = '', specificShadow = ''; if (isRowTotal || isColTotal) { bgColorClass = `bg-${theme.accent1}/20`; specificShadow = `shadow-md shadow-${theme.accent1}/20`; } else if (isRowSubtotal || isColSubtotal) { bgColorClass = `bg-${theme.accent2}/15`; specificShadow = `shadow-md shadow-${theme.accent2}/15`; } else { bgColorClass = `bg-${theme.darkGray}/5 backdrop-blur-sm`; } return { bgColorClass, fontWeight: (isRowTotal || isRowSubtotal || isColTotal || isColSubtotal) ? 'bold' : 'normal' as any, specificShadow }; };
    const tableFontSizeClass = isMaximizedView || isPivotPresentationViewActiveParam ? 'text-sm' : 'text-xs';
    const cellPaddingClass = isMaximizedView || isPivotPresentationViewActiveParam ? 'p-2' : 'p-1.5';
    const headerCellPaddingClass = isMaximizedView || isPivotPresentationViewActiveParam ? 'p-2' : 'p-1.5';
    const iconSize = isMaximizedView || isPivotPresentationViewActiveParam ? 16 : 14;
    const allMeasureCfgsForHeader: UnifiedMeasureConfigForPivot[] = [...(pivotConfig.values || []).map(vc => ({...vc, isCalculated: false as const})), ...(pivotConfig.calculatedMeasures || []).map(cm => ({...cm, isCalculated: true as const, aggregation: 'Calculated' as const}))];

    return (
    <table className={`min-w-full ${tableFontSizeClass} ${theme.textColor} border-collapse`}>
        <thead className="select-none">
            {Array.from({ length: maxColHeaderLevel || 0 }).map((_, levelIndex) => (
                <tr key={`col-header-level-${levelIndex}`}>
                    {levelIndex === 0 && (<th colSpan={maxRowDepth || 1} rowSpan={maxColHeaderLevel || 1} className={`${headerCellPaddingClass} border ${theme.borderColor} sticky top-0 left-0 z-[15] ${getHeaderBg()}`} style={{ ...headerCellStyle }}>{cornerCellContent}</th>)}
                    {pivotConfig.columns.length > 0 && (pivotResult.columnHeadersTree || []) ? ((pivotResult.columnHeadersTree || []).filter(ch => { if(ch.level !== levelIndex) return false; if(ch.isSubtotal && !pivotOptions.showColumnSubtotals) return false; if(ch.isGrandTotal && !pivotOptions.showColumnGrandTotals) return false; if (ch.level > 0) { const ovEntries = Object.entries(ch.originalValues || {}); for (let l = 0; l < ch.level; l++) { const ancestorKey = Object.entries(ovEntries.slice(0, l + 1).reduce((acc, [k,v]) => ({...acc, [k]:v}), {})).map(([k,v]) => `${k}:${String(v)}`).sort().join('|-|'); const ancestorNode = (pivotResult.columnHeadersTree || []).find(h => h.key === ancestorKey); if (ancestorNode && ancestorNode.children && ancestorNode.children.length > 0 && !pivotExpandedKeys.has(ancestorKey)) return false;}} return true;}).map(colHeader => { let colSpan = 1; const numValueFields = Math.max(1, allMeasureCfgsForHeader.length); if (colHeader.children && colHeader.children.length > 0 && pivotExpandedKeys.has(colHeader.key)) { const countVisibleLeavesRecursive = (nodes: PivotColumnHeader[]): number => { let count = 0; (nodes || []).forEach(n => { if (!n.children || n.children.length === 0 || !pivotExpandedKeys.has(n.key)){ if (n.isGrandTotal && !pivotOptions.showColumnGrandTotals) return; if (n.isSubtotal && !pivotOptions.showColumnSubtotals) return; count += numValueFields; } else { count += countVisibleLeavesRecursive(n.children || []); }}); return Math.max(numValueFields, count); }; colSpan = countVisibleLeavesRecursive(colHeader.children || []); } else { if (colHeader.isGrandTotal && !pivotOptions.showColumnGrandTotals) colSpan = 0; else if (colHeader.isSubtotal && !pivotOptions.showColumnSubtotals) colSpan = 0; else colSpan = numValueFields;} if (colSpan === 0) return null; return ( <th key={`${colHeader.key}-level-${levelIndex}`} colSpan={colSpan} className={`${headerCellPaddingClass} border ${theme.borderColor} sticky whitespace-nowrap z-[12] ${getHeaderBg(colHeader.isGrandTotal, colHeader.isSubtotal)}`} style={{ ...headerCellStyle, top: `${levelIndex * (isMaximizedView || isPivotPresentationViewActiveParam ? 36 : 32)}px`}}><div className="flex items-center justify-center">{colHeader.label}{colHeader.children && colHeader.children.length > 0 && !colHeader.isGrandTotal && !colHeader.isSubtotal && (<Button variant="ghost" size="sm" onClick={() => toggleExpandFn(view.id, colHeader.key)} className="!p-0.5 ml-1 hover:!bg-opacity-30">{pivotExpandedKeys.has(colHeader.key) ? <ChevronUp size={iconSize}/> : <ChevronDown size={iconSize}/>}</Button>)}</div></th>);})) : (levelIndex === 0 && allMeasureCfgsForHeader.length > 0 && <> {allMeasureCfgsForHeader.map(mc => { let keyPart: string, displayValue: string; if (mc.isCalculated) { keyPart = mc.name; displayValue = mc.name; } else { const pvc = mc as PivotValueFieldConfig; keyPart = pvc.field; displayValue = `${pvc.field} (${pvc.aggregation})`; } return ( <th key={`valhead-noval-${keyPart}-${mc.isCalculated ? 'calc' : 'agg'}`} className={`${headerCellPaddingClass} border ${theme.borderColor} sticky z-[11] text-xs font-semibold opacity-90 ${getHeaderBg()}`} style={{ ...headerCellStyle, top: `${levelIndex * (isMaximizedView || isPivotPresentationViewActiveParam ? 36 : 32)}px` }}>{displayValue}</th> );})}{pivotOptions.showColumnGrandTotals && (pivotResult.columnHeadersTree || []).find(ch => ch.key === 'GRANDTOTAL_COLS' && ch.isGrandTotal) && (<th key={`grandtotal-col-header`} className={`${headerCellPaddingClass} border ${theme.borderColor} sticky z-[11] text-xs font-semibold opacity-90 ${getHeaderBg(true, false)}`} style={{ ...headerCellStyle, top: `${levelIndex * (isMaximizedView || isPivotPresentationViewActiveParam ? 36 : 32)}px` }}>Grand Total</th>)}</> )}
                </tr>
            ))}
        </thead>
        <tbody className="select-none">
            {visibleRowHeaders.map((rowHeader:any) => { const { bgColorClass: rhBgColorClass, fontWeight: rhFontWeight, specificShadow: rhShadow } = cellStyle(rowHeader.isGrandTotal, rowHeader.isSubtotal, false, false); return (
                <tr key={rowHeader.key} className={`transition-colors duration-100 ${rhBgColorClass} ${dataCellHoverClass}`}>
                    <th colSpan={maxRowDepth || 1} className={`${headerCellPaddingClass} border ${theme.borderColor} sticky left-0 z-[10] whitespace-nowrap text-left ${getHeaderBg(rowHeader.isGrandTotal, rowHeader.isSubtotal)} ${rhShadow}`} style={{ paddingLeft: rowHeader.level > 0 ? `${rowHeader.level * (isMaximizedView || isPivotPresentationViewActiveParam ? 1.5 : 1.25) + (isMaximizedView || isPivotPresentationViewActiveParam ? 0.75 : 0.5)}rem` : (isMaximizedView || isPivotPresentationViewActiveParam ? '0.75rem' : '0.5rem'), ...headerCellStyle, fontWeight: rhFontWeight }}><div className="flex items-center">{(rowHeader.children && rowHeader.children.length > 0 && !rowHeader.isGrandTotal && !rowHeader.isSubtotal) && (<Button variant="ghost" size="sm" onClick={() => toggleExpandFn(view.id, rowHeader.key)} className={`!p-0.5 mr-1 hover:!bg-opacity-30 hover:bg-${theme.mediumGray}/30`} style={{color: theme.textColor.replace('text-','')}}>{pivotExpandedKeys.has(rowHeader.key) ? <ChevronDown size={iconSize}/> : <ChevronRight size={iconSize}/>}</Button>)}{(rowHeader.isSubtotal || rowHeader.isGrandTotal || !rowHeader.children || rowHeader.children.length === 0) && <span className="w-[18px] inline-block mr-1"></span>}{rowHeader.label}</div></th>
                    {(leafColNodesForData as any[]).map(colHeader => { let dataLookupRowKey = rowHeader.key; if (rowHeader.children && rowHeader.children.length > 0 && !pivotExpandedKeys.has(rowHeader.key) && !rowHeader.isSubtotal && !rowHeader.isGrandTotal) dataLookupRowKey = `${rowHeader.key}|-|SUBTOTAL`; const actualColKeyForData = colHeader.isGrandTotal ? 'GRANDTOTAL_COLS' : (colHeader.isSubtotal ? colHeader.key : colHeader.key); const cellData = pivotResult.dataMatrix.get(dataLookupRowKey)?.get(actualColKeyForData); return allMeasureCfgsForHeader.map(mc => { let measureKey: string, cellKeyPart: string; if (mc.isCalculated) { measureKey = mc.name; cellKeyPart = mc.name; } else { const pvc = mc as PivotValueFieldConfig; measureKey = `${pvc.field} (${pvc.aggregation})`; cellKeyPart = pvc.field;} const val = cellData?.[measureKey]; const { bgColorClass: dataBgColorClass, fontWeight: dataFontWeight, specificShadow: dataShadow } = cellStyle(rowHeader.isGrandTotal, rowHeader.isSubtotal, colHeader.isGrandTotal, colHeader.isSubtotal); return ( <td key={`${rowHeader.key}-${colHeader.key}-${cellKeyPart}-${mc.isCalculated ? 'calc' : 'agg'}`} className={`${cellPaddingClass} border ${theme.borderColor} text-right whitespace-nowrap ${dataBgColorClass} ${dataShadow} ${dataCellHoverClass}`} style={{...dataCellStyle, fontWeight: dataFontWeight}}>{val !== null && val !== undefined ? Number(val).toLocaleString(undefined, {minimumFractionDigits:0, maximumFractionDigits:2}) : '-'}</td> ); }); })}
                </tr> );
            })}
        </tbody>
    </table>);
  };

const ScatterChart: React.FC<any> = ({ children, ...props }) => (
  <ComposedChart {...props}>{children}</ComposedChart>
);
