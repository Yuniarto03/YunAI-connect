
import React, { createContext, useState, useEffect, ReactNode, useCallback } from 'react';
import {
  ProcessedData, SavedFileEntry, Theme, ThemeName, TableTheme, TableThemeName,
  TableFontOption, TableFontSizeOption, ChartConfig, PivotConfig, PivotOptions,
  AggregationType, ExportFormat, AppContextType, DataTableViewConfig, DataSourceOrigin,
  FileSystemFileHandle, FileWithPath, SavedPivotSummary, ActivePivotView, PivotResult
} from '../types';
import {
  AVAILABLE_THEMES, DEFAULT_THEME_NAME,
  AVAILABLE_TABLE_THEMES, DEFAULT_TABLE_THEME_NAME,
  TABLE_FONTS, DEFAULT_TABLE_FONT_CLASS,
  TABLE_FONT_SIZES, DEFAULT_TABLE_FONT_SIZE_CLASS,
  DEFAULT_ENABLE_NOTIFICATIONS, DEFAULT_EXPORT_FORMAT,
  DEFAULT_AUTO_PROFILE_ON_LOAD, DEFAULT_REDUCE_MOTION
} from '../constants';
import { exportPivotToExcel as exportPivotToExcelService } from '../services/DataProcessingService';


export const createInitialPivotConfig = (): PivotConfig => ({
  rows: [],
  columns: [],
  values: [],
  filters: [],
  calculatedMeasures: [],
});

export const createInitialPivotOptions = (): PivotOptions => ({
  showRowGrandTotals: true,
  showColumnGrandTotals: true,
  showRowSubtotals: true,
  showColumnSubtotals: true,
  defaultRowSubtotalsCollapsed: false,
  defaultColumnSubtotalsCollapsed: false,
});

const createNewActivePivotView = (config?: PivotConfig, options?: PivotOptions, name?: string, id?: string): ActivePivotView => ({
  id: id || `activepivot-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
  name: name || `Unsaved Pivot ${Math.floor(Math.random() * 1000)}`,
  pivotConfig: config ? JSON.parse(JSON.stringify(config)) : createInitialPivotConfig(),
  pivotOptions: options ? JSON.parse(JSON.stringify(options)) : createInitialPivotOptions(),
  pivotResult: null,
  pivotExpandedKeys: new Set<string>(),
});


const MAX_DATA_TABLE_HISTORY = 15;

export const AppContext = createContext<AppContextType | null>(null);

interface AppProviderProps {
  children: ReactNode;
}

export type SerializableDataSourceOrigin =
  | { type: 'local'; file: FileWithPath; isLive?: boolean } 
  | { type: 'cloud'; url: string };


export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  const [userSelectedThemeName, setUserSelectedThemeName] = useState<ThemeName>(DEFAULT_THEME_NAME);
  const [theme, setThemeState] = useState<Theme>(AVAILABLE_THEMES[DEFAULT_THEME_NAME]);

  const [processedDataState, setProcessedDataState] = useState<ProcessedData | null>(null);
  const [savedFiles, setSavedFiles] = useState<SavedFileEntry[]>([]);
  const [apiKey, setApiKey] = useState<string | null>(null);

  const [tableFont, setTableFontState] = useState<string>(DEFAULT_TABLE_FONT_CLASS);
  const [tableFontSize, setTableFontSizeState] = useState<string>(DEFAULT_TABLE_FONT_SIZE_CLASS);
  const [tableTheme, setTableThemeState] = useState<TableTheme>(AVAILABLE_TABLE_THEMES[DEFAULT_TABLE_THEME_NAME]);

  const [chartConfigs, setChartConfigs] = useState<ChartConfig[]>([]);
  
  // Pivot state changes
  const [activePivotViews, setActivePivotViews] = useState<ActivePivotView[]>(() => [createNewActivePivotView(undefined, undefined, "Initial Pivot View")]);
  const [currentEditingPivotViewId, setCurrentEditingPivotViewId] = useState<string | null>(activePivotViews[0].id);

  const [pivotAvailableFieldsFilter, setPivotAvailableFieldsFilter] = useState<string>("");
  const [pivotDataIdentifier, setPivotDataIdentifier] = useState<string | null>(null);
  const [savedPivotSummaries, setSavedPivotSummaries] = useState<SavedPivotSummary[]>([]);
  const [openFilterValueDropdown, setOpenFilterValueDropdown] = useState<{viewId: string, field: string} | null>(null);


  const [enableNotifications, setEnableNotificationsState] = useState<boolean>(DEFAULT_ENABLE_NOTIFICATIONS);
  const [defaultExportFormat, setDefaultExportFormatState] = useState<ExportFormat>(DEFAULT_EXPORT_FORMAT);
  const [autoProfileOnLoad, setAutoProfileOnLoadState] = useState<boolean>(DEFAULT_AUTO_PROFILE_ON_LOAD);
  const [reduceMotion, setReduceMotionState] = useState<boolean>(DEFAULT_REDUCE_MOTION);

  const [savedDataTableViews, setSavedDataTableViews] = useState<DataTableViewConfig[]>([]);

  const [dataTableHistory, setDataTableHistory] = useState<ProcessedData[]>([]);
  const [dataTableHistoryIndex, setDataTableHistoryIndex] = useState<number>(-1);

  const canUndoDataTable = dataTableHistoryIndex > 0;
  const canRedoDataTable = dataTableHistoryIndex < dataTableHistory.length - 1;

  const applySystemTheme = useCallback(() => {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setThemeState(prefersDark ? AVAILABLE_THEMES[ThemeName.PURE_DARK] : AVAILABLE_THEMES[ThemeName.PURE_LIGHT]);
  }, []);

  useEffect(() => {
    const storedUserThemeName = localStorage.getItem('appUserThemeName') as ThemeName | null;
    const initialUserThemeName = storedUserThemeName || DEFAULT_THEME_NAME;
    setUserSelectedThemeName(initialUserThemeName);
    if (initialUserThemeName === ThemeName.SYSTEM_DEFAULT) applySystemTheme();
    else if (AVAILABLE_THEMES[initialUserThemeName]) setThemeState(AVAILABLE_THEMES[initialUserThemeName]);
    else setThemeState(AVAILABLE_THEMES[DEFAULT_THEME_NAME]);

    const envApiKey = (window as any).process?.env?.API_KEY || null;
    if (envApiKey) setApiKey(envApiKey);
    else console.warn("API_KEY not found.");

    const storedFiles = localStorage.getItem('savedFiles');
    if (storedFiles) {
      try {
        const parsedFiles = JSON.parse(storedFiles) as SavedFileEntry[];
        setSavedFiles(parsedFiles.map(f => {
          // Ensure origin is correctly typed for serialization if it exists
          let serializableOrigin: DataSourceOrigin | undefined = undefined;
          if (f.origin) {
            if (f.origin.type === 'local') {
              // For local files, 'handle' is not serializable, so we omit it for storage
              // but keep 'file' (FileWithPath) and 'isLive'.
              // Note: FileWithPath itself might not be perfectly serializable if it contains complex non-serializable parts.
              // A more robust approach might store file metadata and re-acquire handle/file object on load if possible.
              serializableOrigin = {
                type: 'local',
                file: f.origin.file, // This FileWithPath object might not be fully serializable by JSON.stringify
                isLive: f.origin.isLive,
                // handle: undefined, // Explicitly undefined or omit
              };
            } else if (f.origin.type === 'cloud') {
              serializableOrigin = {
                type: 'cloud',
                url: f.origin.url,
              };
            }
          }
          return {
            ...f,
            savedAt: new Date(f.savedAt),
            origin: serializableOrigin, 
          };
        }));
      } catch (error) { console.error("Error parsing saved files:", error); }
    }
    const storedViews = localStorage.getItem('savedDataTableViews');
    if (storedViews) {
        try { setSavedDataTableViews(JSON.parse(storedViews)); }
        catch (e) { console.error("Error parsing saved views:", e); }
    }

    const storedPivotSummaries = localStorage.getItem('savedPivotSummaries');
    if (storedPivotSummaries) {
        try { setSavedPivotSummaries(JSON.parse(storedPivotSummaries)); }
        catch (e) { console.error("Error parsing saved pivot summaries:", e); }
    }


    const storedTableFont = localStorage.getItem('tableFont');
    if (storedTableFont && TABLE_FONTS.some(f => f.cssClass === storedTableFont)) setTableFontState(storedTableFont);
    const storedTableFontSize = localStorage.getItem('tableFontSize');
    if (storedTableFontSize && TABLE_FONT_SIZES.some(s => s.cssClass === storedTableFontSize)) setTableFontSizeState(storedTableFontSize);
    const storedTableThemeName = localStorage.getItem('tableTheme') as TableThemeName | null;
    if (storedTableThemeName && AVAILABLE_TABLE_THEMES[storedTableThemeName]) setTableThemeState(AVAILABLE_TABLE_THEMES[storedTableThemeName]);
    
    const storedEnableNotifications = localStorage.getItem('enableNotifications');
    if (storedEnableNotifications !== null) setEnableNotificationsState(JSON.parse(storedEnableNotifications));
    const storedDefaultExportFormat = localStorage.getItem('defaultExportFormat') as ExportFormat | null;
    if (storedDefaultExportFormat) setDefaultExportFormatState(storedDefaultExportFormat);
    const storedAutoProfileOnLoad = localStorage.getItem('autoProfileOnLoad');
    if (storedAutoProfileOnLoad !== null) setAutoProfileOnLoadState(JSON.parse(storedAutoProfileOnLoad));
    const storedReduceMotion = localStorage.getItem('reduceMotion');
    if (storedReduceMotion !== null) setReduceMotionState(JSON.parse(storedReduceMotion));
    
    // Initialize currentEditingPivotViewId if activePivotViews exists
    if(activePivotViews.length > 0 && !currentEditingPivotViewId) {
        setCurrentEditingPivotViewId(activePivotViews[0].id);
    }

  }, [applySystemTheme]); // Removed activePivotViews and currentEditingPivotViewId to prevent loop on init

  useEffect(() => {
    if (userSelectedThemeName !== ThemeName.SYSTEM_DEFAULT) return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => applySystemTheme();
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [userSelectedThemeName, applySystemTheme]);

  const setTheme = (selectedThemeName: ThemeName) => {
    setUserSelectedThemeName(selectedThemeName);
    localStorage.setItem('appUserThemeName', selectedThemeName);
    if (selectedThemeName === ThemeName.SYSTEM_DEFAULT) applySystemTheme();
    else if (AVAILABLE_THEMES[selectedThemeName]) setThemeState(AVAILABLE_THEMES[selectedThemeName]);
  };

  const generateDataIdentifier = (data: ProcessedData | null): string | null => {
    if (!data || !data.fileName || !Array.isArray(data.headers) || !Array.isArray(data.data)) return null;
    return `${data.fileName}-${data.sheetName || 'default'}-${data.headers.join('|')}-${data.data.length}`;
  };

  const setProcessedData = (
    data: ProcessedData | null,
    options?: {
        overridePivotConfig?: PivotConfig;
        isUserAction?: boolean; 
    }
  ) => {
    const isUserAction = options?.isUserAction ?? false;
    setProcessedDataState(data); 
    const newDataIdentifier = generateDataIdentifier(data);
    
    if (isUserAction && data) {
        const baseDataForHistory = JSON.parse(JSON.stringify(data));
        // Origin is tricky for history. For local files, FileWithPath is not fully serializable.
        // We store a simplified representation or metadata if possible.
        // For now, we'll keep the FileWithPath object but be aware it might not restore perfectly from a stringified history.
        let serializableOriginForHistory: SerializableDataSourceOrigin | undefined = undefined;
        if (data.origin?.type === 'local' && data.origin.file) {
            serializableOriginForHistory = { type: 'local', file: data.origin.file, isLive: data.origin.isLive };
        } else if (data.origin?.type === 'cloud') {
            serializableOriginForHistory = { type: 'cloud', url: data.origin.url };
        }
        const dataForHistory = { ...baseDataForHistory, origin: serializableOriginForHistory as DataSourceOrigin | undefined };


        const newHistory = dataTableHistory.slice(0, dataTableHistoryIndex + 1);
        newHistory.push(dataForHistory as ProcessedData); 
        while (newHistory.length > MAX_DATA_TABLE_HISTORY) newHistory.shift();
        setDataTableHistory(newHistory);
        setDataTableHistoryIndex(newHistory.length - 1);
    } else if (!data) {
        setDataTableHistory([]); setDataTableHistoryIndex(-1);
    } else if (!isUserAction && data) { 
        const baseInitialDataForHistory = JSON.parse(JSON.stringify(data));
        let serializableOriginForHistory: SerializableDataSourceOrigin | undefined = undefined;
        if (data.origin?.type === 'local' && data.origin.file) {
            serializableOriginForHistory = { type: 'local', file: data.origin.file, isLive: data.origin.isLive };
        } else if (data.origin?.type === 'cloud') {
            serializableOriginForHistory = { type: 'cloud', url: data.origin.url };
        }
        const initialDataForHistory = { ...baseInitialDataForHistory, origin: serializableOriginForHistory as DataSourceOrigin | undefined };

        setDataTableHistory([initialDataForHistory as ProcessedData]);
        setDataTableHistoryIndex(0);
    }

    let newDefaultView: ActivePivotView;
    if (options?.overridePivotConfig) {
        newDefaultView = createNewActivePivotView(options.overridePivotConfig, createInitialPivotOptions(), "Initial Pivot");
        setActivePivotViews([newDefaultView]);
        setCurrentEditingPivotViewId(newDefaultView.id);
    } else if (newDataIdentifier !== pivotDataIdentifier || !data) {
        newDefaultView = createNewActivePivotView(undefined, undefined, data ? "Initial Pivot" : "Blank Pivot");
        setActivePivotViews([newDefaultView]);
        setCurrentEditingPivotViewId(newDefaultView.id);
        setPivotAvailableFieldsFilter("");
    }
    // If data identifier is the same and no override, activePivotViews are preserved.
    // Their results will need to be recalculated in PivotTable.tsx effect.

    if (newDataIdentifier !== pivotDataIdentifier) {
        setPivotDataIdentifier(newDataIdentifier);
    }
  };

  const undoDataTableChange = () => {
    if (canUndoDataTable) {
        const newIndex = dataTableHistoryIndex - 1;
        const historicalDataFromHistory = dataTableHistory[newIndex];
        setProcessedDataState(historicalDataFromHistory); 
        setDataTableHistoryIndex(newIndex);
        // Pivot views will auto-update due to processedData change
    }
  };

  const redoDataTableChange = () => {
    if (canRedoDataTable) {
        const newIndex = dataTableHistoryIndex + 1;
        const historicalDataFromHistory = dataTableHistory[newIndex];
        setProcessedDataState(historicalDataFromHistory);
        setDataTableHistoryIndex(newIndex);
        // Pivot views will auto-update
    }
  };

  // --- Pivot View Management ---
  const addActivePivotView = (config?: PivotConfig, options?: PivotOptions, name?: string, id?: string): string => {
    const newView = createNewActivePivotView(config, options, name || `Pivot ${activePivotViews.length + 1}`, id);
    setActivePivotViews(prev => [...prev, newView]);
    setCurrentEditingPivotViewId(newView.id);
    return newView.id;
  };

  const removeActivePivotView = (viewId: string) => {
    setActivePivotViews(prev => {
        const newViews = prev.filter(v => v.id !== viewId);
        if (currentEditingPivotViewId === viewId) {
            setCurrentEditingPivotViewId(newViews.length > 0 ? newViews[0].id : null);
        }
        if (newViews.length === 0) { // If all views are removed, add a new blank one
            const defaultNewView = createNewActivePivotView(undefined, undefined, "Initial Pivot");
            setCurrentEditingPivotViewId(defaultNewView.id);
            return [defaultNewView];
        }
        return newViews;
    });
  };

  const updateActivePivotViewConfig = (viewId: string, newConfig: PivotConfig) => {
    setActivePivotViews(prev => prev.map(v => v.id === viewId ? { ...v, pivotConfig: newConfig, pivotResult: null } : v));
  };
  const updateActivePivotViewOptions = (viewId: string, newOptions: PivotOptions) => {
    setActivePivotViews(prev => prev.map(v => v.id === viewId ? { ...v, pivotOptions: newOptions, pivotResult: null } : v));
  };
  const updateActivePivotViewExpandedKeys = (viewId: string, newKeys: Set<string>) => {
    setActivePivotViews(prev => prev.map(v => v.id === viewId ? { ...v, pivotExpandedKeys: newKeys } : v));
  };
  const updateActivePivotViewName = (viewId: string, newName: string) => {
    setActivePivotViews(prev => prev.map(v => v.id === viewId ? { ...v, name: newName } : v));
  };
  const updateActivePivotViewResult = (viewId: string, result: PivotResult | null) => {
    setActivePivotViews(prev => prev.map(v => v.id === viewId ? { ...v, pivotResult: result } : v));
  };
  const setActiveEditingPivotViewId = (viewId: string | null) => {
    setCurrentEditingPivotViewId(viewId);
  };


  const saveFileToLibrary = (fileDataToSave: ProcessedData) => {
    // Prepare a serializable version of the origin
    let serializableOrigin: SerializableDataSourceOrigin | undefined = undefined;
    if (fileDataToSave.origin?.type === 'local' && fileDataToSave.origin.file) {
        // FileWithPath may not be fully serializable. Storing essential info like name, type, size.
        // For a truly robust solution, you might need to handle file re-selection if the path is broken.
        serializableOrigin = { 
            type: 'local', 
            file: {
                path: fileDataToSave.origin.file.path, // path might not always be available or reliable across sessions
                name: fileDataToSave.origin.file.name,
                type: fileDataToSave.origin.file.type,
                size: fileDataToSave.origin.file.size,
            } as any, // Cast to any if FileWithPath parts are problematic
            isLive: false 
        };
    } else if (fileDataToSave.origin?.type === 'cloud') {
        serializableOrigin = { type: 'cloud', url: fileDataToSave.origin.url };
    }

    const newEntry: SavedFileEntry = {
      ...fileDataToSave,
      origin: serializableOrigin as DataSourceOrigin | undefined, // Cast to the main type after serialization prep
      id: Date.now().toString(),
      savedAt: new Date(),
      fileSize: new TextEncoder().encode(JSON.stringify(fileDataToSave.data)).length,
    };
    const updatedFiles = [...savedFiles, newEntry];
    setSavedFiles(updatedFiles);
    localStorage.setItem('savedFiles', JSON.stringify(updatedFiles));
  };

  const deleteFileFromLibrary = (fileId: string) => {
    const updatedFiles = savedFiles.filter(file => file.id !== fileId);
    setSavedFiles(updatedFiles);
    localStorage.setItem('savedFiles', JSON.stringify(updatedFiles));
  };

  const loadDataFromLibrary = (fileId: string) => {
    const fileToLoad = savedFiles.find(file => file.id === fileId); 
    if (fileToLoad) {
        // Reconstruct origin; for local files, this is a simplified origin
        // as the original FileSystemFileHandle is lost.
        let originForLoadedFile: DataSourceOrigin | undefined = undefined;
        if (fileToLoad.origin?.type === 'local') {
            originForLoadedFile = {
                type: 'local',
                file: fileToLoad.origin.file, // This was simplified for storage
                isLive: false, // Loaded from library, not a live handle
                // handle will be null
            };
        } else if (fileToLoad.origin?.type === 'cloud') {
            originForLoadedFile = { type: 'cloud', url: fileToLoad.origin.url };
        }

        const dataToLoad: ProcessedData = { 
            ...fileToLoad, 
            origin: originForLoadedFile 
        };
        setProcessedData(dataToLoad, { isUserAction: false }); 
    }
  };

  const saveDataTableView = (viewConfig: Omit<DataTableViewConfig, 'id' | 'createdAt'>) => {
    const newView: DataTableViewConfig = { ...viewConfig, id: `view-${Date.now()}`, createdAt: new Date().toISOString() };
    const updatedViews = [...savedDataTableViews, newView];
    setSavedDataTableViews(updatedViews);
    localStorage.setItem('savedDataTableViews', JSON.stringify(updatedViews));
  };
  const loadDataTableView = (viewId: string): DataTableViewConfig | undefined => savedDataTableViews.find(view => view.id === viewId);
  const deleteDataTableView = (viewId: string) => {
    const updatedViews = savedDataTableViews.filter(view => view.id !== viewId);
    setSavedDataTableViews(updatedViews);
    localStorage.setItem('savedDataTableViews', JSON.stringify(updatedViews));
  };

  const savePivotSummary = (summaryToSave: Omit<SavedPivotSummary, 'id' | 'createdAt'>) => {
    const newSummary: SavedPivotSummary = { ...summaryToSave, id: `pivot-${Date.now()}`, createdAt: new Date().toISOString() };
    const updatedSummaries = [...savedPivotSummaries, newSummary];
    setSavedPivotSummaries(updatedSummaries);
    localStorage.setItem('savedPivotSummaries', JSON.stringify(updatedSummaries));
  };

  const deletePivotSummary = (summaryId: string) => {
    const updatedSummaries = savedPivotSummaries.filter(s => s.id !== summaryId);
    setSavedPivotSummaries(updatedSummaries);
    localStorage.setItem('savedPivotSummaries', JSON.stringify(updatedSummaries));
  };


  const setTableFont = (fontClass: string) => { setTableFontState(fontClass); localStorage.setItem('tableFont', fontClass); };
  const setTableFontSize = (sizeClass: string) => { setTableFontSizeState(sizeClass); localStorage.setItem('tableFontSize', sizeClass); };
  const setTableTheme = (themeName: TableThemeName) => { if (AVAILABLE_TABLE_THEMES[themeName]) { setTableThemeState(AVAILABLE_TABLE_THEMES[themeName]); localStorage.setItem('tableTheme', themeName); } };
  
  const setEnableNotifications = (value: boolean) => { setEnableNotificationsState(value); localStorage.setItem('enableNotifications', JSON.stringify(value)); };
  const setDefaultExportFormat = (value: ExportFormat) => { setDefaultExportFormatState(value); localStorage.setItem('defaultExportFormat', value); };
  const setAutoProfileOnLoad = (value: boolean) => { setAutoProfileOnLoadState(value); localStorage.setItem('autoProfileOnLoad', JSON.stringify(value)); };
  const setReduceMotion = (value: boolean) => { setReduceMotionState(value); localStorage.setItem('reduceMotion', JSON.stringify(value)); };
  
  const setIsSidebarOpenDummy = (_value: React.SetStateAction<boolean>) => { /* Do nothing */ };

  const exportPivotToExcel = (pivotResult: PivotResult, config: PivotConfig, options: PivotOptions, themeCardBg: string) => {
    exportPivotToExcelService(pivotResult, config, options, themeCardBg);
  };


  const contextValue: AppContextType = {
    theme, setTheme, availableThemes: AVAILABLE_THEMES,
    processedData: processedDataState, setProcessedData,
    savedFiles, saveFileToLibrary, deleteFileFromLibrary, loadDataFromLibrary,
    apiKey,
    tableFont, setTableFont,
    tableFontSize, setTableFontSize,
    tableTheme, setTableTheme,
    availableTableThemes: AVAILABLE_TABLE_THEMES,
    tableFontOptions: TABLE_FONTS,
    tableFontSizeOptions: TABLE_FONT_SIZES,
    chartConfigs, setChartConfigs,
    
    // Pivot State
    activePivotViews, currentEditingPivotViewId,
    addActivePivotView, removeActivePivotView,
    updateActivePivotViewConfig, updateActivePivotViewOptions,
    updateActivePivotViewExpandedKeys, updateActivePivotViewName,
    setActiveEditingPivotViewId, updateActivePivotViewResult,

    pivotAvailableFieldsFilter, setPivotAvailableFieldsFilter,
    pivotDataIdentifier,
    
    isSidebarOpen: false, 
    toggleSidebar: () => {}, 
    setIsSidebarOpen: setIsSidebarOpenDummy, 

    enableNotifications, setEnableNotifications,
    defaultExportFormat, setDefaultExportFormat,
    autoProfileOnLoad, setAutoProfileOnLoad,
    reduceMotion, setReduceMotion,
    savedDataTableViews, saveDataTableView, loadDataTableView, deleteDataTableView,
    
    savedPivotSummaries, savePivotSummary, deletePivotSummary,

    dataTableHistory, dataTableHistoryIndex, undoDataTableChange, redoDataTableChange,
    canUndoDataTable, canRedoDataTable,
    exportPivotToExcel,
    openFilterValueDropdown, setOpenFilterValueDropdown,
  };

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
};
