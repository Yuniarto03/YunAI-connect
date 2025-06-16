
import { Home, UploadCloud, Table, BarChart2, BrainCircuit, Library, Settings as SettingsIcon, Filter, ListChecks, LayoutGrid, HelpCircle, Flag, LayoutDashboard } from 'lucide-react'; // Added LayoutDashboard, Flag
import { NavItem, Theme, ThemeName, TableTheme, TableThemeName, TableFontOption, TableFontSizeOption, PivotConfig, AggregationType, ExportFormat, ExportFormatOption } from './types';

export const APP_NAME = "MasYunAI Data Connectivity";

// Raw hex values for colors defined in tailwind.config and used in themes
// This allows direct use in JavaScript for components like Recharts
export const RAW_COLOR_VALUES: Record<string, string> = {
  'neon-blue': '#00D4FF',
  'cyber-purple': '#8B5CF6',
  'matrix-green': '#00FF88',
  'tech-orange': '#FF6B35',
  'dark-bg': '#0A0F1E',
  'light-text': '#E0E0E0',
  'medium-gray': '#333F58',
  'dark-gray': '#1E293B',
  'glass-edge': 'rgba(255, 255, 255, 0.1)', // Not typically used directly in charts
  'glass-surface': 'rgba(255, 255, 255, 0.05)', // Not typically used directly in charts

  // Theme specific colors (ensure these match tailwind.config or standard Tailwind palette)
  'black': '#000000',
  'white': '#FFFFFF',
  'green-400': '#4ade80',
  'lime-500': '#84cc16',
  'emerald-500': '#10b981',
  'neutral-900': '#171717', // For Matrix Core content BG
  'neutral-800': '#262626',
  'neutral-700': '#404040',
  'neutral-600': '#525252',
  'neutral-400': '#a3a3a3',
  'neutral-300': '#d4d4d4',


  'slate-50': '#f8fafc',
  'slate-100': '#f1f5f9',
  'slate-200': '#e2e8f0',
  'slate-300': '#cbd5e1',
  'slate-400': '#94a3b8',
  'slate-500': '#64748b',
  'slate-600': '#475569',
  'slate-700': '#334155',
  'slate-800': '#1e293b',
  'slate-900': '#0f172a',
  'slate-950': '#020617',

  'amber-500': '#f59e0b',
  'amber-400': '#fbbf24', // For Pure Dark theme
  'amber-700': '#b45309',
  'amber-100': '#fef3c7',
  'yellow-200': '#fef08a',
  'yellow-300': '#fde047',
  'yellow-400': '#facc15',


  'red-500': '#ef4444',
  'red-700': '#b91c1c',
  'red-800': '#991b1b',
  'red-900': '#7f1d1d',
  'red-950': '#450a0a',


  'orange-200': '#fed7aa',
  'orange-600': '#ea580c',
  'orange-800': '#9a3412',
  'orange-900': '#7c2d12',


  'indigo-900': '#312e81',
  'indigo-100': '#e0e7ff',
  'indigo-700': '#4338ca',

  'violet-500': '#8b5cf6',
  'violet-400': '#a78bfa', // For Pure Dark theme
  'violet-200': '#ddd6fe',
  'violet-700': '#6d28d9',
  'violet-800': '#5b21b6',

  'purple-800': '#6b21a8',
  'purple-900': '#581c87',
  'purple-950': '#3b0764',


  'pink-500': '#ec4899',
  'pink-300': '#f9a8d4',
  'pink-400': '#f472b6',


  'sky-400': '#38bdf8', // For Pure Dark theme
  'sky-500': '#0ea5e9',
  'sky-600': '#0284c7',
  'sky-900': '#0c4a6e',
  'blue-950': '#172554',
  'cyan-400': '#22d3ee',
  'teal-400': '#2dd4bf',
  'sky-100': '#e0f2fe',
  'sky-200': '#bae6fd',
  'sky-300': '#7dd3fc',
  'sky-700': '#0369a1',
  'sky-800': '#075985',
  'emerald-400': '#34d399', // For Pure Dark theme
};


export const THEME_COLORS = { // These are the *names* or *parts* of Tailwind classes
  neonBlue: 'neon-blue',
  cyberPurple: 'cyber-purple',
  matrixGreen: 'matrix-green',
  techOrange: 'tech-orange',
  darkBg: 'dark-bg',
  lightText: 'light-text',
  mediumGray: 'medium-gray',
  darkGray: 'dark-gray',
  glassEdge: 'glass-edge',
  glassSurface: 'glass-surface',
};

// General chart color palette - ensure these keys exist in RAW_COLOR_VALUES
export const CHART_COLOR_PALETTE_KEYS = [
  THEME_COLORS.neonBlue,
  THEME_COLORS.cyberPurple,
  THEME_COLORS.matrixGreen,
  THEME_COLORS.techOrange,
  'pink-500',
  'cyan-400',
  'amber-500',
  'lime-500',
];

export const CHART_COLOR_PALETTE = CHART_COLOR_PALETTE_KEYS.map(key => RAW_COLOR_VALUES[key]).filter(Boolean) as string[];


export const NAVIGATION_ITEMS: NavItem[] = [
  { name: 'Dashboard', icon: Home, path: '/' },
  { name: 'Import Data', icon: UploadCloud, path: '/import' },
  { name: 'Data Table', icon: Table, path: '/table' },
  { name: 'Data Profiling', icon: ListChecks, path: '/summary' },
  { name: 'Table Summary', icon: LayoutGrid, path: '/table-summary' },
  { name: 'Milestone Planner', icon: Flag, path: '/milestones'},
  { name: 'Visualization', icon: BarChart2, path: '/visualize' },
  { name: 'Dashboard Report', icon: LayoutDashboard, path: '/dashboard-report' }, // New Item
  { name: 'AI Document', icon: BrainCircuit, path: '/ai-document' },
  { name: 'File Library', icon: Library, path: '/library' },
  { name: 'Documentation', icon: HelpCircle, path: '/documentation'},
  { name: 'Settings', icon: SettingsIcon, path: '/settings' },
];

export const AVAILABLE_THEMES: Record<ThemeName, Theme> = {
  [ThemeName.CYBER_NEON]: {
    name: ThemeName.CYBER_NEON,
    sidebarBg: 'bg-dark-gray',
    contentBg: 'bg-dark-bg',
    accent1: THEME_COLORS.neonBlue,
    accent2: THEME_COLORS.cyberPurple,
    accent3: THEME_COLORS.matrixGreen,
    accent4: THEME_COLORS.techOrange,
    textColor: 'text-light-text',
    borderColor: 'border-medium-gray',
    cardBg: 'bg-dark-gray/70 backdrop-blur-md',
    mediumGray: THEME_COLORS.mediumGray,
    darkGray: THEME_COLORS.darkGray,
    darkBg: THEME_COLORS.darkBg,
  },
  [ThemeName.MATRIX_CORE]: {
    name: ThemeName.MATRIX_CORE,
    sidebarBg: 'bg-black',
    contentBg: 'bg-neutral-900',
    accent1: THEME_COLORS.matrixGreen,
    accent2: 'green-400',
    accent3: 'lime-500',
    accent4: 'emerald-500',
    textColor: `text-${THEME_COLORS.matrixGreen}`,
    borderColor: `border-${THEME_COLORS.matrixGreen}/50`,
    cardBg: 'bg-black/80 backdrop-blur-sm',
    mediumGray: THEME_COLORS.mediumGray,
    darkGray: 'black',
    darkBg: 'black',
  },
  [ThemeName.TECH_SUNSET]: {
    name: ThemeName.TECH_SUNSET,
    sidebarBg: 'bg-slate-800',
    contentBg: 'bg-slate-900',
    accent1: THEME_COLORS.techOrange,
    accent2: 'amber-500',
    accent3: THEME_COLORS.cyberPurple,
    accent4: 'red-500',
    textColor: 'text-slate-100',
    borderColor: 'border-slate-700',
    cardBg: 'bg-slate-800/70 backdrop-blur-md',
    mediumGray: 'slate-600',
    darkGray: 'slate-800',
    darkBg: 'slate-950',
  },
  [ThemeName.VOID_PULSE]: {
    name: ThemeName.VOID_PULSE,
    sidebarBg: 'bg-indigo-900',
    contentBg: 'bg-black',
    accent1: THEME_COLORS.cyberPurple,
    accent2: 'violet-500',
    accent3: THEME_COLORS.neonBlue,
    accent4: 'pink-500',
    textColor: 'text-indigo-100',
    borderColor: 'border-indigo-700',
    cardBg: 'bg-indigo-900/60 backdrop-blur-lg',
    mediumGray: 'indigo-700',
    darkGray: 'indigo-900',
    darkBg: 'black',
  },
  [ThemeName.GALACTIC_DAWN]: {
    name: ThemeName.GALACTIC_DAWN,
    sidebarBg: 'bg-sky-900',
    contentBg: 'bg-blue-950',
    accent1: THEME_COLORS.neonBlue,
    accent2: 'cyan-400',
    accent3: THEME_COLORS.techOrange,
    accent4: 'teal-400',
    textColor: 'text-sky-100',
    borderColor: 'border-sky-700',
    cardBg: 'bg-sky-900/70 backdrop-blur-md',
    mediumGray: 'sky-700',
    darkGray: 'sky-900',
    darkBg: 'blue-950',
  },
  [ThemeName.SILVER_TECH]: {
    name: ThemeName.SILVER_TECH,
    sidebarBg: 'bg-slate-200',
    contentBg: 'bg-slate-50',
    accent1: 'slate-500', // Silver
    accent2: 'sky-500',   // Light Blue
    accent3: 'slate-400', // Lighter Silver
    accent4: 'slate-600', // Darker Silver/Charcoal
    textColor: 'text-slate-800',
    borderColor: 'border-slate-400',
    cardBg: 'bg-slate-100/80 backdrop-blur-md',
    mediumGray: 'slate-400',
    darkGray: 'slate-500', // Should be darker than mediumGray
    darkBg: 'slate-200', // Used for specific dark elements if needed within this light theme
  },
  [ThemeName.PURE_LIGHT]: {
    name: ThemeName.PURE_LIGHT,
    sidebarBg: 'bg-slate-100',
    contentBg: 'bg-white',
    accent1: 'slate-700',      // Dark Gray for primary actions
    accent2: 'sky-600',        // Blue for secondary
    accent3: 'emerald-500',    // Green for positive
    accent4: 'amber-500',      // Orange for warning/highlight
    textColor: 'text-slate-900',
    borderColor: 'border-slate-300',
    cardBg: 'bg-slate-50/90 backdrop-blur-sm',
    mediumGray: 'slate-300',
    darkGray: 'slate-400',
    darkBg: 'slate-100',      // e.g. code blocks
  },
  [ThemeName.PURE_DARK]: {
    name: ThemeName.PURE_DARK,
    sidebarBg: 'bg-slate-900',
    contentBg: 'bg-slate-950',
    accent1: 'sky-400',         // Light Blue for primary
    accent2: 'violet-400',      // Violet for secondary
    accent3: 'emerald-400',     // Green for positive
    accent4: 'amber-400',       // Orange for warning/highlight
    textColor: 'text-slate-200',
    borderColor: 'border-slate-700',
    cardBg: 'bg-slate-800/80 backdrop-blur-sm',
    mediumGray: 'slate-700',
    darkGray: 'slate-800',
    darkBg: 'slate-900',       // e.g. code blocks
  },
  // SYSTEM_DEFAULT is a conceptual theme name, actual theme applied will be PURE_LIGHT or PURE_DARK
  // It doesn't need its own color definitions here as AppContext handles the logic.
  // However, to make it selectable, it needs an entry. We can point it to PURE_LIGHT as a fallback if JS fails.
  [ThemeName.SYSTEM_DEFAULT]: {
    // This theme's properties will be dynamically set by AppContext
    // based on system preference, defaulting to PURE_LIGHT if needed.
    name: ThemeName.SYSTEM_DEFAULT,
    sidebarBg: 'bg-slate-100', // Fallback to Pure Light
    contentBg: 'bg-white',
    accent1: 'slate-700',
    accent2: 'sky-600',
    accent3: 'emerald-500',
    accent4: 'amber-500',
    textColor: 'text-slate-900',
    borderColor: 'border-slate-300',
    cardBg: 'bg-slate-50/90 backdrop-blur-sm',
    mediumGray: 'slate-300',
    darkGray: 'slate-400',
    darkBg: 'slate-100',
  },
};

export const DEFAULT_THEME_NAME = ThemeName.CYBER_NEON;

export const LUCIDE_FILTER_ICON = Filter;

export const GEMINI_TEXT_MODEL = 'gemini-2.5-flash-preview-04-17';
export const GEMINI_IMAGE_MODEL = 'imagen-3.0-generate-002';

export const CHATBOT_SYSTEM_INSTRUCTION = `You are MasYunAI, a helpful assistant integrated into a data analysis platform.
Be concise and helpful. You can answer general knowledge questions and questions about data if context is provided.
If asked about data and no data context is given, politely state that you need the data to be described or provided to you.
When providing information from Google Search, always cite your sources clearly by listing the URLs and titles of the web pages used. Format citations like this:
Source: [Title of Page](URL)
`;

// Table Preferences Constants
export const TABLE_FONTS: TableFontOption[] = [
  { name: 'System Default', cssClass: 'font-sans' },
  { name: 'Monospace', cssClass: 'font-mono' },
  { name: 'Serif', cssClass: 'font-serif' },
  { name: 'Inter UI', cssClass: "font-['Inter',ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe_UI',Roboto,'Helvetica_Neue',Arial,'Noto_Sans',sans-serif,'Apple_Color_Emoji','Segoe_UI_Emoji','Segoe_UI_Symbol','Noto_Color_Emoji']" },
  { name: 'Verdana', cssClass: "font-['Verdana',sans-serif]" },
];

export const TABLE_FONT_SIZES: TableFontSizeOption[] = [
  { name: 'Tiny (10px)', cssClass: 'text-[10px] leading-tight' },
  { name: 'Extra Small (12px)', cssClass: 'text-xs' }, // 12px
  { name: 'Small (14px)', cssClass: 'text-sm' },    // 14px
  { name: 'Medium (16px)', cssClass: 'text-base' },  // 16px
  { name: 'Large (18px)', cssClass: 'text-lg' },    // 18px
];

const universalRowHoverBg = `hover:bg-gradient-to-r hover:from-neon-blue/70 hover:to-cyber-purple/70 hover:text-white`;

export const AVAILABLE_TABLE_THEMES: Record<TableThemeName, TableTheme> = {
  [TableThemeName.DEFAULT_DARK]: {
    name: TableThemeName.DEFAULT_DARK,
    tableBg: 'bg-dark-gray',
    headerBg: 'bg-medium-gray',
    headerColor: 'text-light-text',
    rowBg: 'bg-dark-gray',
    rowAltBg: 'bg-dark-gray/70',
    textColor: 'text-light-text',
    borderColor: 'border-medium-gray',
    highlightRowBg: `bg-${THEME_COLORS.matrixGreen}/20`,
    rowHoverBg: universalRowHoverBg,
    filterIconColor: `text-${THEME_COLORS.techOrange}/70 hover:text-${THEME_COLORS.techOrange}`,
    filterDropdownBg: 'bg-dark-bg',
    filterDropdownBorder: 'border-medium-gray',
    filterDropdownText: 'text-light-text',
    filterDropdownHoverBg: 'hover:bg-medium-gray'
  },
  [TableThemeName.OCEAN_BLUE]: {
    name: TableThemeName.OCEAN_BLUE,
    tableBg: 'bg-sky-900',
    headerBg: 'bg-sky-800',
    headerColor: 'text-sky-100',
    rowBg: 'bg-sky-900',
    rowAltBg: 'bg-sky-950',
    textColor: 'text-sky-200',
    borderColor: 'border-sky-700',
    highlightRowBg: 'bg-cyan-400/30',
    rowHoverBg: universalRowHoverBg,
    filterIconColor: 'text-cyan-300 hover:text-cyan-200',
    filterDropdownBg: 'bg-sky-950',
    filterDropdownBorder: 'border-sky-700',
    filterDropdownText: 'text-sky-200',
    filterDropdownHoverBg: 'hover:bg-sky-700'
  },
  [TableThemeName.MATRIX_TABLE]: {
    name: TableThemeName.MATRIX_TABLE,
    tableBg: 'bg-black',
    headerBg: 'bg-green-900/50', // Tailwind class directly
    headerColor: `text-${THEME_COLORS.matrixGreen}`,
    rowBg: 'bg-black',
    rowAltBg: 'bg-green-900/10',
    textColor: `text-${THEME_COLORS.matrixGreen}/90`,
    borderColor: `border-${THEME_COLORS.matrixGreen}/30`,
    highlightRowBg: `bg-${THEME_COLORS.matrixGreen}/40`,
    rowHoverBg: universalRowHoverBg,
    filterIconColor: `text-${THEME_COLORS.matrixGreen}/70 hover:text-${THEME_COLORS.matrixGreen}`,
    filterDropdownBg: 'bg-black',
    filterDropdownBorder: `border-${THEME_COLORS.matrixGreen}/50`,
    filterDropdownText: `text-${THEME_COLORS.matrixGreen}`,
    filterDropdownHoverBg: `hover:bg-${THEME_COLORS.matrixGreen}/20`
  },
  [TableThemeName.SUNSET_GLOW]: {
    name: TableThemeName.SUNSET_GLOW,
    tableBg: 'bg-slate-900',
    headerBg: 'bg-amber-700/80', // Tailwind class directly
    headerColor: 'text-amber-100',
    rowBg: 'bg-slate-800',
    rowAltBg: 'bg-slate-900',
    textColor: 'text-orange-200',
    borderColor: 'border-slate-700',
    highlightRowBg: `bg-${THEME_COLORS.techOrange}/30`,
    rowHoverBg: universalRowHoverBg,
    filterIconColor: `text-${THEME_COLORS.techOrange} hover:text-amber-400`,
    filterDropdownBg: 'bg-slate-900',
    filterDropdownBorder: 'border-slate-700',
    filterDropdownText: 'text-orange-200',
    filterDropdownHoverBg: 'hover:bg-slate-700'
  },
  [TableThemeName.LIGHT_MODE]: {
    name: TableThemeName.LIGHT_MODE,
    tableBg: 'bg-white',
    headerBg: 'bg-slate-200',
    headerColor: 'text-slate-800',
    rowBg: 'bg-white',
    rowAltBg: 'bg-slate-50',
    textColor: 'text-slate-700',
    borderColor: 'border-slate-300',
    highlightRowBg: 'bg-yellow-200/50',
    rowHoverBg: universalRowHoverBg,
    filterIconColor: 'text-slate-500 hover:text-slate-700',
    filterDropdownBg: 'bg-white',
    filterDropdownBorder: 'border-slate-300',
    filterDropdownText: 'text-slate-700',
    filterDropdownHoverBg: 'hover:bg-slate-100'
  },
  [TableThemeName.HIGH_CONTRAST]: {
    name: TableThemeName.HIGH_CONTRAST,
    tableBg: 'bg-black',
    headerBg: 'bg-white',
    headerColor: 'text-black font-bold',
    rowBg: 'bg-black',
    rowAltBg: 'bg-black',
    textColor: 'text-white',
    borderColor: 'border-white',
    highlightRowBg: 'bg-yellow-400 text-black',
    rowHoverBg: universalRowHoverBg, // Assuming gray-700 is defined or standard
    filterIconColor: 'text-yellow-400 hover:text-yellow-300',
    filterDropdownBg: 'bg-black',
    filterDropdownBorder: 'border-white',
    filterDropdownText: 'text-white',
    filterDropdownHoverBg: 'hover:bg-gray-700'
  },
  [TableThemeName.MINIMALIST_DARK]: {
    name: TableThemeName.MINIMALIST_DARK,
    tableBg: 'bg-neutral-900',
    headerBg: 'bg-neutral-900',
    headerColor: 'text-neutral-300 font-semibold',
    rowBg: 'bg-neutral-900',
    rowAltBg: 'bg-neutral-800/50',
    textColor: 'text-neutral-400',
    borderColor: 'border-neutral-700',
    highlightRowBg: 'bg-sky-500/20',
    rowHoverBg: universalRowHoverBg,
    filterIconColor: 'text-neutral-500 hover:text-sky-500',
    filterDropdownBg: 'bg-neutral-800',
    filterDropdownBorder: 'border-neutral-700',
    filterDropdownText: 'text-neutral-300',
    filterDropdownHoverBg: 'hover:bg-neutral-600'
  },
  // New Futuristic Themes
  [TableThemeName.QUANTUM_MESH]: {
    name: TableThemeName.QUANTUM_MESH,
    tableBg: 'bg-blue-950',
    headerBg: 'bg-gradient-to-b from-sky-700 to-sky-800',
    headerColor: 'text-cyan-300',
    rowBg: 'bg-blue-950',
    rowAltBg: 'bg-sky-900/40',
    textColor: 'text-sky-200',
    borderColor: 'border-sky-700/50',
    highlightRowBg: 'bg-cyan-400/30',
    rowHoverBg: universalRowHoverBg,
    filterIconColor: 'text-cyan-400 hover:text-cyan-200',
    filterDropdownBg: 'bg-sky-950',
    filterDropdownBorder: 'border-sky-700',
    filterDropdownText: 'text-sky-200',
    filterDropdownHoverBg: 'hover:bg-sky-800'
  },
  [TableThemeName.CRYO_CORE]: {
    name: TableThemeName.CRYO_CORE,
    tableBg: 'bg-slate-800',
    headerBg: 'bg-gradient-to-b from-slate-600 to-slate-700',
    headerColor: 'text-white',
    rowBg: 'bg-slate-800',
    rowAltBg: 'bg-slate-700/50',
    textColor: 'text-slate-200',
    borderColor: 'border-slate-600',
    highlightRowBg: 'bg-sky-300/30 text-sky-700',
    rowHoverBg: universalRowHoverBg,
    filterIconColor: 'text-sky-400 hover:text-sky-200',
    filterDropdownBg: 'bg-slate-900',
    filterDropdownBorder: 'border-slate-700',
    filterDropdownText: 'text-slate-100',
    filterDropdownHoverBg: 'hover:bg-slate-700'
  },
  [TableThemeName.NOVA_GRID]: {
    name: TableThemeName.NOVA_GRID,
    tableBg: 'bg-indigo-900',
    headerBg: 'bg-gradient-to-b from-violet-700 to-purple-800',
    headerColor: 'text-pink-300',
    rowBg: 'bg-indigo-900',
    rowAltBg: 'bg-purple-900/50',
    textColor: 'text-violet-200',
    borderColor: 'border-violet-700/60',
    highlightRowBg: 'bg-pink-500/30',
    rowHoverBg: universalRowHoverBg,
    filterIconColor: 'text-pink-400 hover:text-pink-300',
    filterDropdownBg: 'bg-purple-950',
    filterDropdownBorder: 'border-violet-800',
    filterDropdownText: 'text-violet-200',
    filterDropdownHoverBg: 'hover:bg-purple-800'
  },
  [TableThemeName.CARBON_FIBER_DARK]: {
    name: TableThemeName.CARBON_FIBER_DARK,
    tableBg: 'bg-neutral-900',
    headerBg: 'bg-gradient-to-b from-neutral-700 to-neutral-800',
    headerColor: 'text-neutral-300',
    rowBg: 'bg-neutral-900',
    rowAltBg: 'bg-neutral-800/60',
    textColor: 'text-neutral-400',
    borderColor: 'border-neutral-700',
    highlightRowBg: 'bg-amber-500/20',
    rowHoverBg: universalRowHoverBg,
    filterIconColor: 'text-amber-500 hover:text-amber-400',
    filterDropdownBg: 'bg-neutral-800',
    filterDropdownBorder: 'border-neutral-600',
    filterDropdownText: 'text-neutral-300',
    filterDropdownHoverBg: 'hover:bg-neutral-600'
  },
  [TableThemeName.PLASMA_CONDUIT]: {
    name: TableThemeName.PLASMA_CONDUIT,
    tableBg: 'bg-red-950',
    headerBg: 'bg-gradient-to-b from-orange-600 to-red-700',
    headerColor: 'text-yellow-200',
    rowBg: 'bg-red-950',
    rowAltBg: 'bg-orange-900/40',
    textColor: 'text-orange-200',
    borderColor: 'border-orange-800/70',
    highlightRowBg: 'bg-yellow-400/30',
    rowHoverBg: universalRowHoverBg,
    filterIconColor: 'text-yellow-400 hover:text-yellow-300',
    filterDropdownBg: 'bg-red-900',
    filterDropdownBorder: 'border-orange-800',
    filterDropdownText: 'text-orange-200',
    filterDropdownHoverBg: 'hover:bg-red-800'
  }
};

export const DEFAULT_TABLE_FONT_CLASS: string = TABLE_FONTS[0].cssClass;
export const DEFAULT_TABLE_FONT_SIZE_CLASS: string = TABLE_FONT_SIZES[0].cssClass; // Changed from [2] to [0] for Tiny (10px)
export const DEFAULT_TABLE_THEME_NAME: TableThemeName = TableThemeName.DEFAULT_DARK;

// New Settings Constants
export const DEFAULT_ENABLE_NOTIFICATIONS = false;
export const DEFAULT_EXPORT_FORMAT: ExportFormat = 'xlsx';
export const DEFAULT_AUTO_PROFILE_ON_LOAD = false;
export const DEFAULT_REDUCE_MOTION = false;

export const EXPORT_FORMAT_OPTIONS: ExportFormatOption[] = [
  { value: 'xlsx', label: 'Excel (.xlsx)' },
  { value: 'csv', label: 'CSV (.csv)' },
  { value: 'json', label: 'JSON (.json)' },
];