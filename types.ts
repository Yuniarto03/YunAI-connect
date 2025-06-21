
import { FileWithPath } from 'react-dropzone';
// Re-export FileWithPath so it can be imported from this module
export type { FileWithPath };

// Import MilestoneCategoryKey from its definition file
// Assuming MilestoneNode.tsx is in ./components/
// This import path is relative to types.ts
import type { MilestoneCategoryKey as ImportedMilestoneCategoryKey } from './components/MilestoneNode';
// Re-export it for use in other files that import from types.ts
export type MilestoneCategoryKey = ImportedMilestoneCategoryKey;


// Minimal FileSystemFileHandle interface for type-checking if not globally available
// Based on https://developer.mozilla.org/en-US/docs/Web/API/FileSystemFileHandle
export interface FileSystemFileHandle {
  readonly kind: 'file' | 'directory';
  readonly name: string;
  getFile(): Promise<File>;
  createWritable(options?: FileSystemCreateWritableOptions): Promise<FileSystemWritableFileStream>;
  queryPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
  requestPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
  isSameEntry(other: FileSystemFileHandle): Promise<boolean>;
  // For brevity, not adding move, remove, resolve methods.
}

export interface FileSystemCreateWritableOptions {
  keepExistingData?: boolean;
}

// Minimal FileSystemWritableFileStream interface
export interface FileSystemWritableFileStream extends WritableStream {
  write(data: any): Promise<void>; // Simplified 'data' type
  seek(position: number): Promise<void>;
  truncate(size: number): Promise<void>;
  // close() is part of WritableStream
}

export interface FileSystemHandlePermissionDescriptor {
  mode?: 'read' | 'readwrite';
}

// Global augmentation for Window object to include showOpenFilePicker
// and other File System Access API types if not covered by @types/wicg-file-system-access
declare global {
  interface Window {
    showOpenFilePicker?(options?: OpenFilePickerOptions): Promise<FileSystemFileHandle[]>;
  }
}

export interface OpenFilePickerOptions {
  multiple?: boolean;
  excludeAcceptAllOption?: boolean;
  types?: FilePickerAcceptType[];
}

export interface FilePickerAcceptType {
  description?: string;
  accept: Record<string, string | string[]>;
}


// Define the chart types we specifically use from Recharts or custom ones
export type AppChartType = 'bar' | 'line' | 'area' | 'pie' | 'donut' | 'scatter' | 'sankey' | 'composed';

export interface NavItem {
  name: string;
  icon: React.ElementType;
  path: string;
}

export type DataRow = {
  __ROW_ID__?: string; // Unique identifier for each row
  calculatedColumnFormula?: string; // Optional: Store original formula if this row was part of a calculated column op that added this value
  [key: string]: string | number | boolean | null | undefined; // Allow __ROW_ID__ plus other string keys
};

// Serializable version of DataSourceOrigin for localStorage
export type SerializableDataSourceOrigin =
  | { type: 'local'; fileInfo: { name: string; type: string; size: number; path?: string }; isLive?: boolean; } // handle is omitted
  | { type: 'cloud'; url: string; };

export type DataSourceOrigin =
  | { type: 'local'; file: FileWithPath; handle?: FileSystemFileHandle | null; isLive?: boolean; }
  | { type: 'cloud'; url: string; };

export type ProcessedData = {
  fileName: string;
  sheetName?: string;
  data: DataRow[];
  headers: string[];
  origin?: DataSourceOrigin;
};

// Version of ProcessedData for serialization (localStorage)
export type SerializableProcessedData = Omit<ProcessedData, 'origin'> & {
  origin?: SerializableDataSourceOrigin;
};


export interface SavedFileEntry extends ProcessedData {
  id: string;
  savedAt: Date;
  fileSize: number; // in bytes
}

export interface ChatMessage {
  id:string;
  role: 'user' | 'model' | 'system';
  text: string;
  timestamp: Date;
  sources?: GroundingSource[];
}

export interface GroundingChunk {
  web?: {
    uri: string;
    title: string;
  };
  retrievedContext?: {
    uri: string;
    title: string;
  };
}

export interface GroundingSource {
  uri: string;
  title: string;
}


export interface ChartConfig {
  chartType: AppChartType;
  xAxisKey: string;
  yAxisKey: string;
  yAxisAggregation: AggregationType;
  color: string;
  isGenerated?: boolean; // To control manual chart generation

  // Secondary Y-Axis
  secondaryYAxisKey?: string;
  secondaryYAxisChartType?: AppChartType; // e.g., 'line', 'bar'
  secondaryYAxisAggregation?: AggregationType;
  secondaryYAxisColor?: string;

  // Filter Pair 1 (Local to chart, applied on top of globallyFilteredData)
  filter1Header?: string;
  filter1Value?: string;
  filter1SubHeader?: string;
  filter1SubValue?: string;

  // Filter Pair 2 (Local to chart)
  filter2Header?: string;
  filter2Value?: string;
  filter2SubHeader?: string;
  filter2SubValue?: string;
}

export enum AggregationType {
  SUM = 'sum',
  COUNT = 'count',
  AVERAGE = 'average',
  MIN = 'min',
  MAX = 'max',
  UNIQUE_COUNT = 'unique_count',
  STDEV = 'stdev',
  COUNT_NON_EMPTY = 'count_non_empty',
}

export type AiOutputTypeHint =
  | 'text'
  | 'msword'
  | 'pdf'
  | 'pptx'
  | 'json'
  | 'xlsx'
  | 'png'
  | 'combined_text_table_image';


export type PptxSlideElementType = 'title' | 'subtitle' | 'paragraph' | 'bulletList' | 'imagePlaceholder';
export type PptxLayoutType =
  | 'TITLE_SLIDE'
  | 'TITLE_AND_CONTENT'
  | 'SECTION_HEADER'
  | 'TWO_CONTENT'
  | 'COMPARISON'
  | 'TITLE_ONLY'
  | 'BLANK'
  | 'CONTENT_WITH_CAPTION'
  | 'PICTURE_WITH_CAPTION';

export interface PptxSlideElement {
  type: PptxSlideElementType;
  text?: string;
  items?: string[];
  x?: number | string;
  y?: number | string;
  w?: number | string;
  h?: number | string;
  options?: Record<string, any>;
}

export interface PptxSlideData {
  layout?: PptxLayoutType;
  title?: string;
  subtitle?: string;
  elements?: PptxSlideElement[];
  notes?: string;
  backgroundColor?: string;
}

export interface PptxThemeSuggestion {
  primaryColor?: string;
  secondaryColor?: string;
  bodyTextColor?: string;
  fontFamily?: string;
  author?: string;
  company?: string;
  title?: string;
}

export interface PptxJsonData {
  theme?: PptxThemeSuggestion;
  slides: PptxSlideData[];
}


export interface AiDocumentRequest {
  file?: FileWithPath;
  textInstruction: string;
}

export interface CombinedAiOutput {
  textPart: string | null;
  tablePart: DataRow[] | null;
  imagePart: string | null;
  imageDescription?: string;
}

export type AiServiceResponseType = 'text' | 'table' | 'image' | 'combined' | 'error';

export interface AiDocumentResponse {
  type: AiServiceResponseType;
  content: string | DataRow[] | CombinedAiOutput | null;
  fileName?: string;
  originalUserHint?: AiOutputTypeHint;
}


export enum ThemeName {
  CYBER_NEON = 'Cyber Neon',
  MATRIX_CORE = 'Matrix Core',
  TECH_SUNSET = 'Tech Sunset',
  VOID_PULSE = 'Void Pulse',
  GALACTIC_DAWN = 'Galactic Dawn',    // Fixed and added
  SILVER_TECH = 'Silver Tech',        // Added
  PURE_LIGHT = 'Pure Light',          // Added
  PURE_DARK = 'Pure Dark',            // Added
  SYSTEM_DEFAULT = 'System Default'   // Added
}

// ---- START OF ADDED/COMPLETED TYPE DEFINITIONS ----
export interface Theme {
  name: ThemeName;
  sidebarBg: string;
  contentBg: string;
  accent1: string;
  accent2: string;
  accent3: string;
  accent4: string;
  textColor: string;
  borderColor: string;
  cardBg: string;
  mediumGray: string;
  darkGray: string;
  darkBg: string;
}

export enum TableThemeName {
  DEFAULT_DARK = 'Default Dark',
  OCEAN_BLUE = 'Ocean Blue',
  MATRIX_TABLE = 'Matrix Table',
  SUNSET_GLOW = 'Sunset Glow',
  LIGHT_MODE = 'Light Mode',
  HIGH_CONTRAST = 'High Contrast',
  MINIMALIST_DARK = 'Minimalist Dark',
  QUANTUM_MESH = 'Quantum Mesh',
  CRYO_CORE = 'Cryo Core',
  NOVA_GRID = 'Nova Grid',
  CARBON_FIBER_DARK = 'Carbon Fiber Dark',
  PLASMA_CONDUIT = 'Plasma Conduit',
}

export interface TableTheme {
  name: TableThemeName;
  tableBg: string;
  headerBg: string;
  headerColor: string;
  rowBg: string;
  rowAltBg: string;
  textColor: string;
  borderColor: string;
  highlightRowBg: string;
  rowHoverBg: string;
  filterIconColor: string;
  filterDropdownBg: string;
  filterDropdownBorder: string;
  filterDropdownText: string;
  filterDropdownHoverBg: string;
}

export interface TableFontOption {
  name: string;
  cssClass: string;
}

export interface TableFontSizeOption {
  name: string;
  cssClass: string;
}

export interface PivotFieldConfig {
  field: string;
}

export interface PivotValueFieldConfig {
  field: string;
  aggregation: AggregationType;
}

export interface CalculatedMeasureConfig {
  id: string;
  name: string;
  formula: string;
}

export interface PivotFilterConfig {
  field: string;
  selectedValues: string[];
}

export interface PivotConfig {
  rows: PivotFieldConfig[];
  columns: PivotFieldConfig[];
  values: PivotValueFieldConfig[];
  filters: PivotFilterConfig[];
  calculatedMeasures?: CalculatedMeasureConfig[];
}

export interface PivotOptions {
  showRowGrandTotals: boolean;
  showColumnGrandTotals: boolean;
  showRowSubtotals: boolean;
  showColumnSubtotals: boolean;
  defaultRowSubtotalsCollapsed: boolean;
  defaultColumnSubtotalsCollapsed: boolean;
}

export type ExportFormat = 'xlsx' | 'csv' | 'json';

export interface ExportFormatOption {
  value: ExportFormat;
  label: string;
}

export type LatLngTuple = [number, number];

export interface CountryInfo {
  name: string;
  code: string;
  center: LatLngTuple;
  zoom: number;
}

export interface DataTableViewConfig {
  id: string;
  name: string;
  createdAt: string;
  associatedDataIdentifier: string; // To link view to specific processedData instance
  searchTerm: string;
  // activeFilters: FilterState; // This will be handled globally
  visibleColumns: Record<string, boolean>;
  tableFont: string;
  tableFontSize: string;
  tableThemeName: TableThemeName;
  itemsPerPage: number;
}

export type FilterState = Record<string, string[]>; // Header -> selected values

export type ColumnType = 'numeric' | 'string' | 'boolean' | 'date' | 'mixed' | 'empty';

export interface NumericStats {
  min?: number;
  max?: number;
  mean?: number;
  median?: number;
  stdDev?: number;
  sum?: number;
  histogramBins?: { name: string, value: number }[];
}

export interface CategoricalStats {
  mostFrequent: { value: string; count: number }[];
  leastFrequent: { value: string; count: number }[];
  topNCategorical?: { name: string, value: number }[];
}

export interface ColumnSummary extends NumericStats, CategoricalStats {
  name: string;
  type: ColumnType;
  totalRows: number;
  missingCount: number;
  missingPercentage: number;
  uniqueCount: number;
}

export interface SubTask {
  id: string;
  text: string;
  completed: boolean;
}

export interface Milestone {
  id: string;
  date: string; 
  title: string;
  description?: string;
  value?: string | number;
  category?: MilestoneCategoryKey;
  source: 'manual' | 'uploaded';
  durationFromPrevious?: string;
  durationFromStart?: string;
  subTasks?: SubTask[];
}

export type MilestoneOutputType = 'csv' | 'json' | 'text' | 'ai_report';


export interface AiUiPayload {
  value?: string;
  dataTableAction?: string;
  searchTerm?: string;
  path?: string;
  appActionType?: string;
  sessionName?: string;
}

export interface AiUiCommandResponse {
  actionType: 'theme' | 'tableFont' | 'tableFontSize' | 'dataTable' | 'navigation' | 'appAction' | 'error' | 'unknown';
  payload?: AiUiPayload;
  message?: string;
}


export interface PivotRowHeader {
  key: string;
  label: string;
  level: number;
  children?: PivotRowHeader[];
  isSubtotal?: boolean;
  isGrandTotal?: boolean;
  originalValues?: Record<string, any>;
}

export interface PivotColumnHeader {
  key: string;
  label: string;
  level: number;
  children?: PivotColumnHeader[];
  isSubtotal?: boolean;
  isGrandTotal?: boolean;
  originalValues?: Record<string, any>;
}

export type PivotDataCell = Record<string, number | string | null>;

export interface PivotResult {
  rowHeadersTree: PivotRowHeader[];
  columnHeadersTree: PivotColumnHeader[];
  dataMatrix: Map<string, Map<string, PivotDataCell>>;
  allRowKeys: string[];
  allColumnKeys: string[];
}

export type PivotArea = 'rows' | 'columns' | 'values' | 'filters' | 'available';

export interface DraggedPivotField {
  field: string;
  fromArea: PivotArea;
  fromIndex?: number;
  isCalculatedMeasure?: boolean;
}

export interface SavedPivotSummary {
  id: string;
  name: string;
  createdAt: string;
  associatedDataIdentifier: string;
  pivotConfig: PivotConfig;
  pivotOptions: PivotOptions;
}

export interface ActivePivotView {
  id: string;
  name: string;
  pivotConfig: PivotConfig;
  pivotOptions: PivotOptions;
  pivotResult: PivotResult | null;
  pivotExpandedKeys: Set<string>;
}

export interface AppSession {
  id: string;
  name: string;
  createdAt: string;
  currentPath: string;
  processedData: SerializableProcessedData | null;
  pivotDataIdentifier: string | null;
  userSelectedThemeName: ThemeName;
  tableFont: string;
  tableFontSize: string;
  tableThemeName: TableThemeName;
  reduceMotion: boolean;
  chartConfigs: ChartConfig[];
  activePivotViews: ActivePivotView[];
  currentEditingPivotViewId: string | null;
  pivotAvailableFieldsFilter: string;
  openFilterValueDropdown: {viewId: string, field: string} | null;
  enableNotifications: boolean;
  defaultExportFormat: ExportFormat;
  autoProfileOnLoad: boolean;
  dataTableState?: { // Preserved for potential AI specific use
    searchTerm: string | null; 
  };
  globalActiveFilters: FilterState; // Added for global filters
}

export type UnifiedMeasureConfigForExport =
  | (PivotValueFieldConfig & { isCalculated: false })
  | (CalculatedMeasureConfig & { isCalculated: true; aggregation: 'Calculated' });

export interface RouteCalculation {
  id: string;
  locationAInput: string;
  locationBInput: string;
  result: RouteResult | null;
  color: string;
  aiRouteAnalysis?: string | null;
  isAiRouteAnalysisLoading?: boolean;
}

export interface RouteResult {
  distance: string | null;
  duration: string | null;
  estimatedDurationHours?: string | null;
  error: string | null;
  calculationType: 'haversine' | 'geocoded_haversine' | 'api_directions' | null;
  status: 'pending' | 'success' | 'error_geocoding_A' | 'error_geocoding_B' | 'error_both_geocoding' | 'error_calculation' | 'error_api';
  fromLocation?: string;
  toLocation?: string;
  calculatedAt?: string;
  message?: string;
  originalInputA?: string;
  originalInputB?: string;
}

export interface BulkRouteResultItem extends RouteResult {
  id: string;
  originalInputA: string;
  originalInputB: string;
}

export interface FilterSlot { // Used for DataSummary and DashboardReport global filter UI
  header?: string;
  value?: string;
}

export interface AppContextType {
  theme: Theme;
  setTheme: (themeName: ThemeName) => void;
  availableThemes: Record<ThemeName, Theme>;
  processedData: ProcessedData | null;
  setProcessedData: (data: ProcessedData | null, options?: { overridePivotConfig?: PivotConfig; isUserAction?: boolean; isSessionLoad?: boolean; }) => void;
  savedFiles: SavedFileEntry[];
  saveFileToLibrary: (fileData: ProcessedData) => void;
  deleteFileFromLibrary: (fileId: string) => void;
  loadDataFromLibrary: (fileId: string) => void;
  apiKey: string | null;
  tableFont: string;
  setTableFont: (fontClass: string) => void;
  tableFontSize: string;
  setTableFontSize: (sizeClass: string) => void;
  tableTheme: TableTheme;
  setTableTheme: (themeName: TableThemeName) => void;
  availableTableThemes: Record<TableThemeName, TableTheme>;
  tableFontOptions: TableFontOption[];
  tableFontSizeOptions: TableFontSizeOption[];
  chartConfigs: ChartConfig[];
  setChartConfigs: React.Dispatch<React.SetStateAction<ChartConfig[]>>;
  
  activePivotViews: ActivePivotView[];
  currentEditingPivotViewId: string | null;
  addActivePivotView: (config?: PivotConfig, options?: PivotOptions, name?: string, id?: string) => string;
  removeActivePivotView: (viewId: string) => void;
  updateActivePivotViewConfig: (viewId: string, newConfig: PivotConfig) => void;
  updateActivePivotViewOptions: (viewId: string, newOptions: PivotOptions) => void;
  updateActivePivotViewExpandedKeys: (viewId: string, newKeys: Set<string>) => void;
  updateActivePivotViewName: (viewId: string, newName: string) => void;
  setActiveEditingPivotViewId: (viewId: string | null) => void;
  updateActivePivotViewResult: (viewId: string, result: PivotResult | null) => void;

  pivotAvailableFieldsFilter: string;
  setPivotAvailableFieldsFilter: React.Dispatch<React.SetStateAction<string>>;
  pivotDataIdentifier: string | null;
  
  dataTableSearchTermFromAI: string | null; // Kept for specific AI interaction
  setDataTableSearchTermFromAI: (searchTerm: string | null) => void;

  enableNotifications: boolean;
  setEnableNotifications: (value: boolean | ((prevState: boolean) => boolean)) => void;
  defaultExportFormat: ExportFormat;
  setDefaultExportFormat: (value: ExportFormat | ((prevState: ExportFormat) => ExportFormat)) => void;
  autoProfileOnLoad: boolean;
  setAutoProfileOnLoad: (value: boolean | ((prevState: boolean) => boolean)) => void;
  reduceMotion: boolean;
  setReduceMotion: (value: boolean | ((prevState: boolean) => boolean)) => void;

  savedDataTableViews: DataTableViewConfig[];
  saveDataTableView: (viewConfig: Omit<DataTableViewConfig, 'id' | 'createdAt'>) => void;
  loadDataTableView: (viewId: string) => DataTableViewConfig | undefined;
  deleteDataTableView: (viewId: string) => void;

  savedPivotSummaries: SavedPivotSummary[];
  savePivotSummary: (summary: Omit<SavedPivotSummary, 'id' | 'createdAt'>) => void;
  deletePivotSummary: (summaryId: string) => void;

  dataTableHistory: SerializableProcessedData[];
  dataTableHistoryIndex: number;
  undoDataTableChange: () => void;
  redoDataTableChange: () => void;
  canUndoDataTable: boolean;
  canRedoDataTable: boolean;
  exportPivotToExcel: (pivotResult: PivotResult, config: PivotConfig, options: PivotOptions, themeCardBg: string) => void;
  openFilterValueDropdown: {viewId: string, field: string} | null;
  setOpenFilterValueDropdown: React.Dispatch<React.SetStateAction<{viewId: string, field: string} | null>>;
  
  appSessions: AppSession[];
  currentSessionName: string | null;
  saveAppSession: (name: string, currentPath: string) => string;
  loadAppSession: (sessionId: string) => string | undefined; 
  deleteAppSession: (sessionId: string) => void;
  setCurrentSessionName: React.Dispatch<React.SetStateAction<string | null>>;

  // Global Filtering State
  globalActiveFilters: FilterState;
  setGlobalActiveFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  globallyFilteredData: DataRow[] | null;
}

// ---- END OF ADDED/COMPLETED TYPE DEFINITIONS ----
