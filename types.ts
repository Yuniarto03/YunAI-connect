
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
  // Other FS Access API interfaces might need to be declared if not available
  // type FileSystemHandleKind = 'file' | 'directory';
  // interface FileSystemHandle {
  //   kind: FileSystemHandleKind;
  //   name: string;
  //   isSameEntry(other: FileSystemHandle): Promise<boolean>;
  //   queryPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
  //   requestPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
  // }
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

export type DataSourceOrigin =
  | { type: 'local'; file: FileWithPath; handle?: FileSystemFileHandle | null; isLive?: boolean; }
  | { type: 'cloud'; url: string; };

export type ProcessedData = {
  fileName: string;
  sheetName?: string;
  data: DataRow[];
  headers: string[];
  origin?: DataSourceOrigin; // Added to track data source
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

  // Filter Pair 1
  filter1Header?: string;
  filter1Value?: string;
  filter1SubHeader?: string;
  filter1SubValue?: string;

  // Filter Pair 2
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
  COUNT_NON_EMPTY = 'count_non_empty', // New aggregation type
}

// User-facing output type hints for generation, influencing AI prompt and expected output structure
export type AiOutputTypeHint = 
  | 'text'                 // Plain text output
  | 'msword'               // AI generates content suitable for direct .docx conversion
  | 'pdf'                  // AI generates content suitable for direct .pdf conversion
  | 'pptx'                 // AI generates content suitable for direct .pptx conversion (e.g., JSON slide data)
  | 'json'                 // AI generates JSON array of objects (for table data)
  | 'xlsx'                 // AI generates JSON array of objects (for table data), client converts to XLSX
  | 'png'                  // AI generates an image
  | 'combined_text_table_image'; // AI generates a JSON object with text, table data, and image prompt


// --- Enhanced PPTX Data Structures ---
export type PptxSlideElementType = 'title' | 'subtitle' | 'paragraph' | 'bulletList' | 'imagePlaceholder';
export type PptxLayoutType = 
  | 'TITLE_SLIDE'       // Standard title slide (title and subtitle)
  | 'TITLE_AND_CONTENT' // Title and a main content body
  | 'SECTION_HEADER'    // Typically a title and a smaller subtitle, often centered or distinctively styled
  | 'TWO_CONTENT'       // Title and two content columns
  | 'COMPARISON'        // Similar to two_content, but for comparing items
  | 'TITLE_ONLY'        // Only a title placeholder
  | 'BLANK'             // Blank slide
  | 'CONTENT_WITH_CAPTION' // Content area and a caption area
  | 'PICTURE_WITH_CAPTION'; // Picture placeholder and a caption area

export interface PptxSlideElement {
  type: PptxSlideElementType;
  text?: string;             // For title, subtitle, paragraph, imagePlaceholder (prompt)
  items?: string[];          // For bulletList
  x?: number | string;       // Optional: position (inches or percentage string e.g., '50%')
  y?: number | string;
  w?: number | string;       // Optional: size
  h?: number | string;
  options?: Record<string, any>; // For PptxGenJS specific text options like fontSize, color, bold etc.
}

export interface PptxSlideData {
  layout?: PptxLayoutType; // Suggests a PptxGenJS master slide or a custom layout handling
  title?: string;          // Optional top-level title, might be handled by an element too
  subtitle?: string;       // Optional top-level subtitle
  elements?: PptxSlideElement[];
  notes?: string;          // Speaker notes
  backgroundColor?: string; // Optional slide background color (hex)
}

export interface PptxThemeSuggestion {
  primaryColor?: string;   // Hex color (e.g., '#FF0000')
  secondaryColor?: string; // Hex color
  bodyTextColor?: string;  // Hex color
  fontFamily?: string;
  author?: string;
  company?: string;
  title?: string; // Presentation title
}

export interface PptxJsonData {
  theme?: PptxThemeSuggestion;
  slides: PptxSlideData[];
}
// --- End of Enhanced PPTX Data Structures ---


export interface AiDocumentRequest {
  file?: FileWithPath;
  textInstruction: string;
  // outputTypeHint is part of the AiDocument component's state, using AiOutputTypeHint
}

export interface CombinedAiOutput {
  textPart: string | null; // Could be Markdown, plain text, or JSON string for PPTX
  tablePart: DataRow[] | null;
  imagePart: string | null; // base64 image string
  imageDescription?: string; // Description used for generating the image
}

// Internal response types from the AI service, which the UI then processes
export type AiServiceResponseType = 'text' | 'table' | 'image' | 'combined' | 'error';

export interface AiDocumentResponse {
  type: AiServiceResponseType;
  content: string | DataRow[] | CombinedAiOutput | null; // string for text/error/image (base64), DataRow[] for table, CombinedAiOutput for combined
  fileName?: string; // For table output or image output
  originalUserHint?: AiOutputTypeHint; // Store the user's original hint for download logic
}


export enum ThemeName {
  CYBER_NEON = 'Cyber Neon',
  MATRIX_CORE = 'Matrix Core',
  TECH_SUNSET = 'Tech Sunset',
  VOID_PULSE = 'Void Pulse',
  GALACTIC_DAWN = 'Galactic Dawn',
  SILVER_TECH = 'Silver Tech',
  PURE_LIGHT = 'Pure Light',
  PURE_DARK = 'Pure Dark',
  SYSTEM_DEFAULT = 'System Default',
}

export interface Theme {
  name: ThemeName;
  sidebarBg: string; // Retained for themes that might use it elsewhere, but Dock won't use it directly
  contentBg: string;
  accent1: string; // color name part, e.g., 'neon-blue'
  accent2: string; // color name part, e.g., 'cyber-purple'
  accent3: string; // color name part, e.g., 'matrix-green'
  accent4: string; // color name part, e.g., 'tech-orange'
  textColor: string; // full class, e.g., 'text-light-text'
  borderColor: string; // full class, e.g., 'border-medium-gray'
  cardBg: string; // full class, e.g., 'bg-dark-gray/70 backdrop-blur-md'
  mediumGray: string; // color name part, e.g., 'medium-gray'
  darkGray: string; // color name part, e.g., 'dark-gray'
  darkBg: string; // color name part, e.g. 'dark-bg' (used for specific dark backgrounds like code blocks)
}

export interface FilterState {
  [header: string]: string[]; // Selected values for each header
}

// Gemini specific types, ensure these are compatible with actual API responses
export interface GeminiGenerateContentResponse {
  text: string; // Simplified for now, actual response is more complex
  candidates?: [{
    groundingMetadata?: {
      groundingChunks?: GroundingChunk[];
    }
  }];
}

// Table specific preferences
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
  tableBg: string; // e.g., 'bg-gray-800'
  headerBg: string; // e.g., 'bg-gray-700'
  headerColor: string; // e.g., 'text-white'
  rowBg: string; // e.g., 'bg-gray-800'
  rowAltBg?: string; // e.g., 'bg-gray-750' for striped rows
  textColor: string; // e.g., 'text-gray-200'
  borderColor: string; // e.g., 'border-gray-600'
  highlightRowBg: string; // For search highlight
  rowHoverBg: string; // Hover background for rows
  filterIconColor: string; // Color for the filter icon in header
  filterDropdownBg: string; // Background for filter dropdown
  filterDropdownBorder: string; // Border for filter dropdown
  filterDropdownText: string; // Text color for filter dropdown items
  filterDropdownHoverBg: string; // Hover BG for filter dropdown items
}

export interface TableFontOption {
  name: string;
  cssClass: string;
}

export interface TableFontSizeOption {
  name: string;
  cssClass: string;
}

// Pivot Table Specific Types
export interface PivotFieldConfig {
  field: string;
  // Additional config for values, e.g., specific aggregation if different from default
  aggregation?: AggregationType;
}

export interface PivotValueFieldConfig extends PivotFieldConfig {
  aggregation: AggregationType;
}

export interface CalculatedMeasureConfig {
  id: string; // Unique ID for UI management
  name: string; // User-defined name for the measure
  formula: string; // The formula string
}

export interface PivotConfig {
  rows: PivotFieldConfig[];
  columns: PivotFieldConfig[];
  values: PivotValueFieldConfig[];
  filters: Array<{ field: string; selectedValues: string[] }>; // Pre-pivot filters
  calculatedMeasures?: CalculatedMeasureConfig[]; // Array of calculated measures
}

export interface PivotDataCell {
  [valueFieldNamePlusAggregationOrCalcMeasureName: string]: number | null | undefined;
}

export interface PivotRowHeader {
  key: string; // Unique key for this row header, e.g., "Country|USA"
  label: string;
  level: number;
  children?: PivotRowHeader[];
  isSubtotal?: boolean;
  isGrandTotal?: boolean;
  data?: Record<string, PivotDataCell>; // Data for this row, keyed by column keys
  originalValues?: Record<string, string|number|boolean|null>; // The values that define this row
}

export interface PivotColumnHeader {
  key: string; // Unique key, e.g., "Category|Electronics"
  label: string;
  level: number;
  children?: PivotColumnHeader[];
  isSubtotal?: boolean;
  isGrandTotal?: boolean;
  originalValues?: Record<string, string|number|boolean|null>; // The values that define this column
}

export interface PivotResult {
  rowHeadersTree: PivotRowHeader[];
  columnHeadersTree: PivotColumnHeader[];
  dataMatrix: Map<string, Map<string, PivotDataCell>>; // Map<rowKey, Map<colKey, values>>
  allRowKeys: string[]; // Flat list of all displayable row keys (for rendering order)
  allColumnKeys: string[]; // Flat list of all displayable col keys
  rowGrandTotal?: Record<string, PivotDataCell>; // For column grand totals at the bottom
}

export type PivotArea = 'rows' | 'columns' | 'values' | 'filters' | 'available';

export interface DraggedPivotField {
  field: string;
  fromArea: PivotArea;
  fromIndex?: number; // Optional, if reordering within an area
  isCalculatedMeasure?: boolean; // To distinguish calculated measures in drag/drop if needed
}

export interface PivotOptions {
  showRowGrandTotals: boolean;
  showColumnGrandTotals: boolean;
  showRowSubtotals: boolean;
  showColumnSubtotals: boolean;
  defaultRowSubtotalsCollapsed: boolean;
  defaultColumnSubtotalsCollapsed: boolean;
}

// Saved Pivot Summaries
export interface SavedPivotSummary {
  id: string;
  name: string;
  createdAt: string; // ISO string
  associatedDataIdentifier: string; // To link with specific dataset
  pivotConfig: PivotConfig;
  pivotOptions: PivotOptions;
}

// Active Pivot View (for displaying multiple pivot tables)
export interface ActivePivotView {
  id: string; // Unique ID for this active instance
  name: string; // Display name, e.g., "Sales by Region" or "Unsaved View 1"
  pivotConfig: PivotConfig;
  pivotOptions: PivotOptions;
  pivotResult: PivotResult | null;
  pivotExpandedKeys: Set<string>;
  // Optional: to show config panel for this specific view, or manage its chart, etc.
  // isEditing?: boolean; 
  // chartConfig?: PivotChartConfig; // If each pivot view can have its own chart settings
}

// MaximizedPivotViewModalProps for PivotTable.tsx
export interface MaximizedPivotViewModalProps {
  view: ActivePivotView;
  onClose: () => void;
  theme: Theme;
  reduceMotion: boolean; // Added reduceMotion
  maximizedViewRef: React.RefObject<HTMLDivElement>;
  maximizedViewPosition: { x: number; y: number };
  handleMaximizedViewDragMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void;
  renderActualPivotTable: Function; // Consider more specific type if possible
  getRenderableRowNodes: Function;
  getLeafColNodesForData: Function;
  toggleExpand: Function;
  handleCollapseAll: Function;
  handleExpandAll: Function;
  exportPivotToExcel: Function; // Consider more specific type (AppContextType['exportPivotToExcel'])
  setChartModalViewId: Function; // (viewId: string | null) => void
  setShowDisplayOptionsModalForViewId: Function; // (viewId: string | null) => void
  isPivotPresentationViewActive: boolean;
  calculatePivotForView: (view: ActivePivotView | undefined) => void; 
}


// New Settings Types
export type ExportFormat = 'xlsx' | 'csv' | 'json';

export interface ExportFormatOption {
  value: ExportFormat;
  label: string;
}

// Saved Data Table View Configuration
export interface DataTableViewConfig {
  id: string;
  name: string;
  createdAt: string; // ISO string
  associatedDataIdentifier: string; // To link view with specific dataset
  // Table state
  searchTerm: string;
  activeFilters: FilterState;
  itemsPerPage: number;
  visibleColumns: Record<string, boolean>;
  // Table appearance
  tableFont: string;
  tableFontSize: string;
  tableThemeName: TableThemeName;
  // Optional: columnOrder: string[];
}

// FilterSlot for global filters
export interface FilterSlot {
  header?: string;
  value?: string;
}


export interface AppContextType {
  theme: Theme;
  setTheme: (themeName: ThemeName) => void;
  availableThemes: Record<ThemeName, Theme>;

  processedData: ProcessedData | null;
  setProcessedData: (
    data: ProcessedData | null,
    options?: {
        overridePivotConfig?: PivotConfig; // For initializing a single pivot view if data comes with one
        isUserAction?: boolean; 
    }
  ) => void;

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

  // Multiple Active Pivot Views
  activePivotViews: ActivePivotView[];
  currentEditingPivotViewId: string | null;
  addActivePivotView: (config?: PivotConfig, options?: PivotOptions, name?: string, id?: string) => string; // Returns new viewId
  removeActivePivotView: (viewId: string) => void;
  updateActivePivotViewConfig: (viewId: string, newConfig: PivotConfig) => void;
  updateActivePivotViewOptions: (viewId: string, newOptions: PivotOptions) => void;
  updateActivePivotViewExpandedKeys: (viewId: string, newKeys: Set<string>) => void;
  updateActivePivotViewName: (viewId: string, newName: string) => void;
  setActiveEditingPivotViewId: (viewId: string | null) => void;
  updateActivePivotViewResult: (viewId: string, result: PivotResult | null) => void;

  pivotAvailableFieldsFilter: string; // This can remain global for the config panel
  setPivotAvailableFieldsFilter: React.Dispatch<React.SetStateAction<string>>;
  pivotDataIdentifier: string | null; 

  isSidebarOpen: false; 
  toggleSidebar: () => void;
  setIsSidebarOpen: (value: React.SetStateAction<boolean>) => void;


  enableNotifications: boolean;
  setEnableNotifications: React.Dispatch<React.SetStateAction<boolean>>;
  defaultExportFormat: ExportFormat;
  setDefaultExportFormat: React.Dispatch<React.SetStateAction<ExportFormat>>;
  autoProfileOnLoad: boolean;
  setAutoProfileOnLoad: React.Dispatch<React.SetStateAction<boolean>>;
  reduceMotion: boolean;
  setReduceMotion: React.Dispatch<React.SetStateAction<boolean>>;

  // Saved Data Table Views
  savedDataTableViews: DataTableViewConfig[];
  saveDataTableView: (viewConfig: Omit<DataTableViewConfig, 'id' | 'createdAt'>) => void;
  loadDataTableView: (viewId: string) => DataTableViewConfig | undefined;
  deleteDataTableView: (viewId: string) => void;

  // Saved Pivot Summaries (these are templates, distinct from activePivotViews)
  savedPivotSummaries: SavedPivotSummary[];
  savePivotSummary: (summary: Omit<SavedPivotSummary, 'id' | 'createdAt'>) => void; // To save the currently configured/editing pivot
  deletePivotSummary: (summaryId: string) => void;
  // loadPivotSummary (for loading into active config) is effectively replaced by addActivePivotView with summary's config

  // Data Table Undo/Redo
  dataTableHistory: ProcessedData[];
  dataTableHistoryIndex: number;
  undoDataTableChange: () => void;
  redoDataTableChange: () => void;
  canUndoDataTable: boolean;
  canRedoDataTable: boolean;

  // Pivot Table specific function for exporting, defined in AppContext
  exportPivotToExcel: (pivotResult: PivotResult, config: PivotConfig, options: PivotOptions, themeCardBg: string) => void;

  // State for PivotTable filter dropdowns
  openFilterValueDropdown: {viewId: string, field: string} | null;
  setOpenFilterValueDropdown: React.Dispatch<React.SetStateAction<{viewId: string, field: string} | null>>;
}

// DataSummary Types
export type ColumnType = 'numeric' | 'string' | 'boolean' | 'mixed' | 'empty';

export interface NumericStats {
  min?: number;
  max?: number;
  mean?: number;
  median?: number;
  stdDev?: number;
  sum?: number;
}

export interface CategoricalStats {
  mostFrequent: { value: string; count: number }[];
  leastFrequent: { value: string; count: number }[];
}

export interface ColumnSummary extends NumericStats, CategoricalStats {
  name: string;
  type: ColumnType;
  totalRows: number;
  missingCount: number;
  missingPercentage: number;
  uniqueCount: number;
  histogramBins?: { name: string; value: number }[]; // For numeric column mini-histograms
  topNCategorical?: { name: string; value: number }[]; // For categorical column mini-bar charts
}

// Milestone Planner Specific Types
export interface Milestone {
  id: string;
  date: string; // Stored as YYYY-MM-DD string for simplicity, can be parsed to Date object when needed
  title: string;
  description?: string;
  value?: string; // For any metric or value associated with the milestone
  source: 'manual' | 'uploaded'; // To distinguish origin
  category?: MilestoneCategoryKey; 
  durationFromPrevious?: string; 
  durationFromStart?: string; 
}

export type MilestoneOutputType = 'csv' | 'json' | 'text' | 'ai_report';
