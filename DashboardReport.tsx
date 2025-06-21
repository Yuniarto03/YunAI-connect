
import React, { useContext, useMemo, useState, useEffect } from 'react';
import { AppContext } from '../contexts/AppContext';
import { 
    AppContextType, PivotResult, ChartConfig, DataRow, ColumnSummary, 
    NumericStats, CategoricalStats, ColumnType, PivotOptions, 
    PivotValueFieldConfig, // CalculatedMeasureConfig removed
    AggregationType, 
    Theme as AppTheme, PivotConfig, FilterSlot, PivotRowHeader, PivotColumnHeader, AppChartType
} from '../types';
import { generatePivotData, DUMMY_COLUMN_KEY_FOR_VALUES_ONLY } from '../services/DataProcessingService';
import FuturisticBackground from './shared/FuturisticBackground';
import Button from './shared/Button';
import Input from './shared/Input';
import LoadingSpinner from './shared/LoadingSpinner';
import { analyzeTextWithGemini } from '../services/geminiService';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Element as HastElement } from 'hast';


import { AlertTriangle, TrendingUp, BarChartHorizontalBig, FileWarning, LayoutGrid, BarChart2 as ChartIconLucide, EyeOff, Sigma, Filter as FilterIcon, MessageCircle, Info, Send, PlusCircle, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { RAW_COLOR_VALUES, CHART_COLOR_PALETTE as GLOBAL_CHART_COLOR_PALETTE } from '../constants';
import { ResponsiveContainer, ComposedChart, Bar, PieChart, Pie, Line, Area, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell, LabelList } from 'recharts';
import { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent';
import { createInitialPivotConfig, createInitialPivotOptions } from '../contexts/AppContext';
import { getSharedSelectBaseStyles } from '../utils';

// --- Styling Helper Functions (adapted from PivotTable.tsx) ---
const getHeaderBgForReport = (theme: AppTheme, isTotal?: boolean, isSubtotal?: boolean) => isTotal ? `bg-gradient-to-b from-${theme.accent1}/80 to-${theme.accent1}/60` : isSubtotal ? `bg-gradient-to-b from-${theme.accent2}/70 to-${theme.accent2}/50` : `bg-gradient-to-b from-${theme.mediumGray}/80 to-${theme.darkGray}/70`;

const headerCellStyleForReport: (theme: AppTheme) => React.CSSProperties = (theme) => ({ 
    textShadow: '1px 1px 2px rgba(0,0,0,0.3)', 
    boxShadow: 'inset 1px 1px 3px rgba(0,0,0,0.2), inset -1px -1px 3px rgba(255,255,255,0.1)', 
    color: theme.textColor.startsWith('text-') ? RAW_COLOR_VALUES[theme.textColor.replace('text-','')] : theme.textColor 
});

const dataCellStyleForReport: (reduceMotion: boolean) => React.CSSProperties = (reduceMotion) => ({ 
    transition: reduceMotion ? 'none' : 'background-color 0.1s ease-out', // Simplified hover for report
});

const cellStyleForReport = (theme: AppTheme, isRowTotal?: boolean, isRowSubtotal?: boolean, isColTotal?: boolean, isColSubtotal?: boolean) => { 
    let bgColorClass = '', specificShadow = ''; 
    if (isRowTotal || isColTotal) { 
        bgColorClass = `bg-${theme.accent1}/20`; 
        specificShadow = `shadow-sm shadow-${theme.accent1}/10`; 
    } else if (isRowSubtotal || isColSubtotal) { 
        bgColorClass = `bg-${theme.accent2}/15`; 
        specificShadow = `shadow-sm shadow-${theme.accent2}/10`; 
    } else { 
        bgColorClass = `bg-${theme.darkGray}/5`; 
    } 
    return { 
        bgColorClass, 
        fontWeight: (isRowTotal || isRowSubtotal || isColTotal || isColSubtotal) ? 'bold' : 'normal' as any, 
        specificShadow 
    }; 
};


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

interface CustomChartTooltipProps {
  active?: boolean;
  payload?: PayloadItem[];
  label?: string | number;
  config: ChartConfig;
  theme: AppTheme;
}

const CustomChartTooltip: React.FC<CustomChartTooltipProps> = ({ active, payload, label, config, theme }) => {
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

// Markdown components for ReactMarkdown
interface CustomCodeBlockProps {
  node: HastElement;
  inline?: boolean;
  className?: string;
  children: React.ReactNode;
  [key: string]: any;
}

const MarkdownComponents = (theme: AppTheme) => ({
    p: ({node, ...props}: {node: HastElement, children: React.ReactNode}) => <p {...props} className="mb-2 last:mb-0 text-xs" />,
    h1: ({node, ...props}: {node: HastElement, children: React.ReactNode}) => <h1 {...props} className={`text-lg font-semibold mt-3 mb-1 text-${theme.accent1}`} />,
    h2: ({node, ...props}: {node: HastElement, children: React.ReactNode}) => <h2 {...props} className={`text-md font-semibold mt-2 mb-1 text-${theme.accent2}`} />,
    h3: ({node, ...props}: {node: HastElement, children: React.ReactNode}) => <h3 {...props} className={`text-sm font-semibold mt-1 mb-0.5 text-${theme.accent3}`} />,
    ul: ({node, ...props}: {node: HastElement, children: React.ReactNode}) => <ul {...props} className="list-disc list-inside pl-3 space-y-0.5 text-xs" />,
    ol: ({node, ...props}: {node: HastElement, children: React.ReactNode}) => <ol {...props} className="list-decimal list-inside pl-3 space-y-0.5 text-xs" />,
    li: ({node, ...props}: {node: HastElement, children: React.ReactNode}) => <li {...props} className="text-xs" />,
    code: ({ node, inline, className, children, ...restProps }: CustomCodeBlockProps) => {
        const match = /language-(\w+)/.exec(className || '');
        return !inline && match ? (
            <pre className={`p-2 my-1 bg-${theme.darkBg} rounded-md overflow-x-auto futuristic-scrollbar text-[11px] border border-${theme.mediumGray}`}>
                <code className={className} {...restProps}>{children}</code>
            </pre>
        ) : (
            <code className={`px-1 py-0.5 bg-${theme.mediumGray}/50 rounded text-[11px] ${className || ''}`} {...restProps}>
                {children}
            </code>
        );
    },
    a: ({node, ...props}: {node: HastElement, children: React.ReactNode, href?: string}) => <a {...props} className={`text-${theme.accent4} hover:underline`} target="_blank" rel="noopener noreferrer" />,
    blockquote: ({node, ...props}: {node: HastElement, children: React.ReactNode}) => <blockquote {...props} className={`pl-2 border-l-4 border-${theme.accent1}/50 my-1 italic text-xs bg-${theme.mediumGray}/20 p-1 rounded-r-md`} />,
});


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

// UnifiedMeasureConfigForReport type simplified as CalculatedMeasures are removed
type UnifiedMeasureConfigForReport = PivotValueFieldConfig; 


const DashboardReport: React.FC = () => {
  const {
    theme, processedData, chartConfigs, reduceMotion,
    activePivotViews, currentEditingPivotViewId, pivotDataIdentifier
  } = useContext(AppContext) as AppContextType;

  const [globalFilters, setGlobalFilters] = useState<[FilterSlot, FilterSlot]>([{}, {}]);
  const [showSecondGlobalFilter, setShowSecondGlobalFilter] = useState<boolean>(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [manualAiInstruction, setManualAiInstruction] = useState<string>('');
  const [isAiSummaryLoading, setIsAiSummaryLoading] = useState(false);
  const [showAllColumnSummaries, setShowAllColumnSummaries] = useState(false);
  const [isGlobalFilterMinimized, setIsGlobalFilterMinimized] = useState(true); // Default to minimized

  const lastUpdated = useMemo(() => new Date().toLocaleString(), [processedData, globalFilters, showSecondGlobalFilter]);
  const allHeaders = useMemo(() => processedData?.headers || [], [processedData]);
  
  const currentViewForReport = useMemo(() => 
    activePivotViews.find(v => v.id === currentEditingPivotViewId) || activePivotViews[0] || null,
  [activePivotViews, currentEditingPivotViewId]);
  
  const pivotConfig = currentViewForReport?.pivotConfig || createInitialPivotConfig();
  const pivotOptions = currentViewForReport?.pivotOptions || createInitialPivotOptions();

  useEffect(() => {
    if (currentViewForReport && currentViewForReport.pivotConfig && currentViewForReport.pivotConfig.filters) {
      const sourceFilters = currentViewForReport.pivotConfig.filters;
      const newGlobalFilters: [FilterSlot, FilterSlot] = [{}, {}];
      let newShowSecondFilter = false;

      if (sourceFilters.length > 0 && sourceFilters[0].field) {
        newGlobalFilters[0] = {
          header: sourceFilters[0].field,
          value: sourceFilters[0].selectedValues?.[0] 
        };
      }
      if (sourceFilters.length > 1 && sourceFilters[1].field) {
        newGlobalFilters[1] = {
          header: sourceFilters[1].field,
          value: sourceFilters[1].selectedValues?.[0]
        };
        newShowSecondFilter = true;
      }
      setGlobalFilters(newGlobalFilters);
      setShowSecondGlobalFilter(newShowSecondFilter);
    } else {
      setGlobalFilters([{}, {}]);
      setShowSecondGlobalFilter(false);
    }
    setAiSummary(null);
  }, [currentViewForReport?.pivotConfig?.filters, pivotDataIdentifier]);


  const globallyFilteredData = useMemo(() => {
    if (!processedData) return null;
    let dataToFilter = [...processedData.data];
    
    if (globalFilters[0].header && globalFilters[0].value !== undefined) {
      dataToFilter = dataToFilter.filter(row => String(row[globalFilters[0].header!]) === globalFilters[0].value);
    }
    if (showSecondGlobalFilter && globalFilters[1].header && globalFilters[1].value !== undefined) {
      dataToFilter = dataToFilter.filter(row => String(row[globalFilters[1].header!]) === globalFilters[1].value);
    }
    return { ...processedData, data: dataToFilter };
  }, [processedData, globalFilters, showSecondGlobalFilter]);


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
    const highMissingThreshold = 30; 
    const highCardinalityRatio = 0.5;

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
    return highlights.slice(0, 3); 
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
    return [...new Set<string>(sourceData.map(row => String(row[headerKey!])))].sort((a,b)=>a.localeCompare(b));
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

      if (manualAiInstruction.trim()) {
        prompt += `\nInstruksi Tambahan dari Pengguna untuk Ringkasan:\n${manualAiInstruction.trim()}\n`;
      }
      
      prompt += `\nFokus pada penyediaan narasi yang berguna untuk gambaran umum dashboard secara cepat. Buatlah singkat dan berwawasan.\nHarap berikan respon dalam format Markdown yang terstruktur dengan baik.`;

      const response = await analyzeTextWithGemini(prompt, undefined, 'text');
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
  
  const renderActualPivotTable = () => {
    if (!pivotResult || !pivotConfig || !pivotOptions) return <p className="text-center p-4 opacity-70">Tabel pivot tidak dikonfigurasi atau data hilang.</p>;

    const maxRowDepth = pivotConfig.rows.length > 0 ? pivotConfig.rows.length : 1;
    let maxColHeaderLevel = pivotConfig.columns.length > 0 ? pivotConfig.columns.length : (pivotConfig.values.length > 0 ? 1 : 0); // Simplified calculatedMeasures check
    if (maxColHeaderLevel === 0 && pivotResult.allColumnKeys.length > 0 && pivotResult.allColumnKeys.includes(DUMMY_COLUMN_KEY_FOR_VALUES_ONLY)) {
        maxColHeaderLevel = 1; 
    }

    // Simplified: All measures are value fields now
    const allMeasureCfgs: UnifiedMeasureConfigForReport[] = [
        ...(pivotConfig.values || []).map(vc => ({...vc })), 
    ];
    
    const _headerCellStyle = headerCellStyleForReport(theme);
    const _dataCellStyle = dataCellStyleForReport(reduceMotion);

    return (
      <div className="overflow-auto futuristic-scrollbar max-h-[60vh] border border-gray-700 rounded-md">
        <table className={`min-w-full text-xs ${theme.textColor} border-collapse`}>
          <thead className="sticky top-0 z-10 select-none">
            {Array.from({ length: maxColHeaderLevel || 0 }).map((_, levelIndex) => (
              <tr key={`col-header-level-${levelIndex}`}>
                {levelIndex === 0 && (
                  <th
                    colSpan={maxRowDepth || 1}
                    rowSpan={maxColHeaderLevel || 1}
                    className={`p-1.5 border ${theme.borderColor} sticky top-0 left-0 z-[15] ${getHeaderBgForReport(theme)}`}
                    style={{ ..._headerCellStyle }}
                  >
                    {pivotConfig.rows.length > 0 ? pivotConfig.rows.map(r => r.field).join(' / ') : ''}
                  </th>
                )}
                {(pivotResult.columnHeadersTree || [])
                  .filter(ch =>
                    ch.level === levelIndex &&
                    (!ch.isGrandTotal || pivotOptions.showColumnGrandTotals) &&
                    (!ch.isSubtotal || pivotOptions.showColumnSubtotals)
                  )
                  .map(colHeader => {
                    let colSpan = 1;
                    const numMeasures = Math.max(1, allMeasureCfgs.length);
                    if ((colHeader.level === (pivotConfig.columns.length -1) && !colHeader.children?.length) || colHeader.isGrandTotal || colHeader.isSubtotal || pivotConfig.columns.length === 0) {
                        colSpan = numMeasures;
                    } else if (colHeader.children?.length) {
                        const countVisibleLeavesRecursive = (nodes: PivotColumnHeader[]): number => {
                          let count = 0;
                          (nodes || []).forEach(n => {
                            if (!n.children || n.children.length === 0) {
                                if (n.isGrandTotal && !pivotOptions.showColumnGrandTotals) return;
                                if (n.isSubtotal && !pivotOptions.showColumnSubtotals && !n.isGrandTotal) return;
                                count += numMeasures;
                            } else {
                                count += countVisibleLeavesRecursive(n.children);
                            }
                          });
                          return Math.max(numMeasures, count);
                        };
                        colSpan = countVisibleLeavesRecursive(colHeader.children);
                    }

                    return (
                      <th
                        key={`${colHeader.key}-level-${levelIndex}`}
                        colSpan={colSpan}
                        className={`p-1.5 border ${theme.borderColor} sticky z-[12] whitespace-nowrap ${getHeaderBgForReport(theme, colHeader.isGrandTotal, colHeader.isSubtotal)}`}
                        style={{ ..._headerCellStyle, top: `${levelIndex * 30}px` }}
                      >
                        {colHeader.label}
                      </th>
                    );
                })}
                {pivotConfig.columns.length === 0 && levelIndex === 0 && allMeasureCfgs.length > 0 && (
                  allMeasureCfgs.map(mc => {
                    const pvc = mc as PivotValueFieldConfig; // Now only PivotValueFieldConfig
                    const displayValue = `${pvc.field} (${pvc.aggregation})`;
                    return (
                      <th key={`measure-header-${displayValue}`} className={`p-1.5 border ${theme.borderColor} sticky z-[11] whitespace-nowrap ${getHeaderBgForReport(theme)}`} style={{..._headerCellStyle, top: `${levelIndex * 30}px` }}>
                        {displayValue}
                      </th>
                    );
                  })
                )}
                 {pivotConfig.columns.length === 0 && levelIndex === 0 && allMeasureCfgs.length === 0 && pivotResult.allColumnKeys.includes(DUMMY_COLUMN_KEY_FOR_VALUES_ONLY) && (
                     <th className={`p-1.5 border ${theme.borderColor} sticky z-[11] whitespace-nowrap ${getHeaderBgForReport(theme)}`} style={{..._headerCellStyle, top: `${levelIndex * 30}px` }}>
                        Values
                     </th>
                 )}
              </tr>
            ))}
          </thead>
          <tbody>
            {(pivotResult.rowHeadersTree || [])
              .filter(rh => 
                  (!rh.isGrandTotal || pivotOptions.showRowGrandTotals) &&
                  (!rh.isSubtotal || pivotOptions.showRowSubtotals || rh.isGrandTotal ) 
              )
              .map(rowHeader => {
              const { bgColorClass: rhBgColorClass, fontWeight: rhFontWeight, specificShadow: rhShadow } = cellStyleForReport(theme, rowHeader.isGrandTotal, rowHeader.isSubtotal, false, false);
              return (
                <tr key={rowHeader.key} className={`${rhBgColorClass}`}>
                  <th
                    colSpan={maxRowDepth || 1}
                    className={`p-1.5 border ${theme.borderColor} sticky left-0 z-[10] whitespace-nowrap text-left ${getHeaderBgForReport(theme, rowHeader.isGrandTotal, rowHeader.isSubtotal)} ${rhShadow}`}
                    style={{
                      paddingLeft: `${(rowHeader.level * 1) + 0.5}rem`,
                      ..._headerCellStyle,
                      fontWeight: rhFontWeight,
                    }}
                  >
                    {rowHeader.label}
                  </th>
                  {(pivotResult.allColumnKeys || [])
                      .filter(ck => {
                          const colNode = (pivotResult.columnHeadersTree || []).find(ch => ch.key === ck);
                          if (ck === DUMMY_COLUMN_KEY_FOR_VALUES_ONLY && pivotConfig.columns.length > 0) return false;
                          if (colNode) {
                              return (!colNode.isGrandTotal || pivotOptions.showColumnGrandTotals) &&
                                     (!colNode.isSubtotal || pivotOptions.showColumnSubtotals || colNode.isGrandTotal);
                          }
                          return ck === DUMMY_COLUMN_KEY_FOR_VALUES_ONLY && pivotConfig.columns.length === 0;
                      })
                      .map(colKey => {
                      const cellData = pivotResult.dataMatrix.get(rowHeader.key)?.get(colKey);
                      const colNodeForStyle = (pivotResult.columnHeadersTree || []).find(ch => ch.key === colKey);

                      return allMeasureCfgs.length > 0 ? allMeasureCfgs.map(mc => {
                        const pvc = mc as PivotValueFieldConfig; // Only PivotValueFieldConfig now
                        const measureKey = `${pvc.field} (${pvc.aggregation})`;
                        const val = cellData?.[measureKey];
                        const { bgColorClass: dataBgColorClass, fontWeight: dataFontWeight, specificShadow: dataShadow } = cellStyleForReport(
                          theme, rowHeader.isGrandTotal, rowHeader.isSubtotal,
                          colNodeForStyle?.isGrandTotal, colNodeForStyle?.isSubtotal
                        );
                        return (
                          <td
                            key={`${rowHeader.key}-${colKey}-${measureKey}`}
                            className={`p-1.5 border ${theme.borderColor} text-right whitespace-nowrap ${dataBgColorClass} ${dataShadow}`}
                            style={{ ..._dataCellStyle, fontWeight: dataFontWeight }}
                          >
                            {val !== null && val !== undefined ? Number(val).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : '-'}
                          </td>
                        );
                      }) : (
                        <td key={`${rowHeader.key}-${colKey}-empty`}
                            className={`p-1.5 border ${theme.borderColor} text-right whitespace-nowrap ${cellStyleForReport(theme).bgColorClass}`}
                            style={{ ..._dataCellStyle }}>
                            -
                        </td>
                      );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  const renderSingleChart = (config: ChartConfig, index: number) => {
    if (!globallyFilteredData || !config.xAxisKey || !config.yAxisKey) return <p className="text-xs opacity-50 text-center p-4">Grafik tidak dikonfigurasi sepenuhnya.</p>;
    
    let currentData = [...globallyFilteredData.data];
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
    const isZoomed = false; 

    const themeTextColorHex = RAW_COLOR_VALUES[theme.textColor.replace('text-', '')] || '#E0E0E0';
    const themeMediumGrayHex = RAW_COLOR_VALUES[theme.mediumGray] || '#333F58';
    const themeDarkBgHex = RAW_COLOR_VALUES[theme.darkBg] || '#0A0F1E';
    const themeAccent1Hex = RAW_COLOR_VALUES[theme.accent1] || '#00D4FF';
    
    const primaryChartColor = config.color || GLOBAL_CHART_COLOR_PALETTE[index % GLOBAL_CHART_COLOR_PALETTE.length];
    const secondaryChartColor = config.secondaryYAxisColor || GLOBAL_CHART_COLOR_PALETTE[(index + 2) % GLOBAL_CHART_COLOR_PALETTE.length];
    
    const commonProps = {
      data: mergedChartData,
      margin: { top: 5, right: 5, left: -20, bottom: 35 },
    };

    const MAX_POINTS_FOR_HORIZONTAL_XLABELS = 12; 
    const MAX_POINTS_FOR_ALL_HORIZONTAL_XTICKS = 8;
    const MAX_POINTS_FOR_VALUE_LABELS_ON_LINES = 15;

    const horizontalXLabels = mergedChartData.length <= MAX_POINTS_FOR_HORIZONTAL_XLABELS;
    let xAxisInterval = 0;
    if (horizontalXLabels) {
        if (mergedChartData.length > MAX_POINTS_FOR_ALL_HORIZONTAL_XTICKS) {
            if (mergedChartData.length > 16) xAxisInterval = 2; 
            else if (mergedChartData.length > 8) xAxisInterval = 1; 
            else xAxisInterval = 0; 
        } else {
            xAxisInterval = 0; 
        }
    } else {
        xAxisInterval = 0; 
    }
    
    const xAxisComputedProps = {
      dataKey: "name",
      stroke: themeMediumGrayHex,
      angle: horizontalXLabels ? 0 : -35,
      textAnchor: horizontalXLabels ? "middle" : "end" as const,
      height: 50, 
      interval: xAxisInterval,
      tick: { fontSize: 9, dy: horizontalXLabels ? 5 : 0, fill: themeTextColorHex },
    };

    const yAxisPropsPrimary = {
      stroke: themeMediumGrayHex,
      tick: { fontSize: 9, fill: themeTextColorHex }
    };
    const yAxisPropsSecondary = {
      yAxisId: "right", orientation: "right" as const,
      stroke: secondaryChartColor,
      tick: { fontSize: 9, fill: themeTextColorHex }
    };

    const tooltipElement = <Tooltip content={<CustomChartTooltip config={config} theme={theme} />} wrapperStyle={{ zIndex: 1500 }} cursor={{ stroke: themeAccent1Hex, strokeDasharray: '3 3'}} />;

    const primaryStrokeColor = primaryChartColor;
    const primaryDistinctFillBaseColor = GLOBAL_CHART_COLOR_PALETTE.find(c => c !== primaryStrokeColor) || GLOBAL_CHART_COLOR_PALETTE[1] || RAW_COLOR_VALUES[theme.accent2];
    
    const secondaryStrokeColor = secondaryChartColor;
    const secondaryDistinctFillBaseColor = GLOBAL_CHART_COLOR_PALETTE.find(c => c !== secondaryStrokeColor && c !== primaryStrokeColor && c !== primaryDistinctFillBaseColor) || GLOBAL_CHART_COLOR_PALETTE[0] || RAW_COLOR_VALUES[theme.accent1];

    const valueLabelFormatter = (value: number | string) => {
        const num = Number(value);
        if (isNaN(num)) return String(value); 
        return num % 1 === 0 ? num.toString() : num.toFixed(1);
    };
    
    const showValueLabels = mergedChartData.length <= MAX_POINTS_FOR_VALUE_LABELS_ON_LINES;

    const primaryLineStrokeWidth = config.secondaryYAxisKey ? 4 : 5; 
    const primaryAreaStrokeWidthNew = config.secondaryYAxisKey ? 5 : 6;
    const primaryBarStrokeWidthNew = 3;

    const secondaryLineStrokeWidth = 3; 
    const secondaryAreaStrokeWidthNew = 4;
    const secondaryBarStrokeWidthNew = 2.5;


    if (config.chartType === 'pie' || config.chartType === 'donut') {
        return (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <PieChart> 
              {tooltipElement}
              <Legend wrapperStyle={{ color: themeTextColorHex, fontSize: '10px'}} layout="horizontal" verticalAlign="bottom" align="center" />
              <Pie data={primaryAggregatedData} dataKey="value" nameKey="name" cx="50%" cy="50%" 
                  outerRadius={config.chartType === 'donut' ? 80 : 100} 
                  innerRadius={config.chartType === 'donut' ? 40 : 0} 
                  fill={primaryChartColor} 
                  labelLine={false}
                  label={({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
                      const RADIAN = Math.PI / 180;
                      const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                      const x = cx + radius * Math.cos(-midAngle * RADIAN);
                      const y = cy + radius * Math.sin(-midAngle * RADIAN);
                      return ( (percent*100) > 5 && <text x={x} y={y} fill={themeTextColorHex} textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize="10px">
                          {`${(percent * 100).toFixed(0)}%`}
                      </text>);
                  }}
              >
                {primaryAggregatedData.map((entry, entryIndex) => {
                  const cellColor = GLOBAL_CHART_COLOR_PALETTE[entryIndex % GLOBAL_CHART_COLOR_PALETTE.length];
                  return (
                      <Cell key={`cell-${entryIndex}`} fill={cellColor} 
                            style={{ filter: `drop-shadow(0 0 3px ${cellColor})`, transition: 'opacity 0.2s ease' }}
                            onMouseOver={(e) => e.currentTarget.style.opacity = '0.7'}
                            onMouseOut={(e) => e.currentTarget.style.opacity = '1'}
                      />
                  );
                })}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        );
    }
    
    if (config.chartType === 'scatter') {
        const scatterPlotData = currentData.map(row => ({
            x: parseFloat(String(row[config.xAxisKey])), 
            y: parseFloat(String(row[config.yAxisKey])),
            ...(config.secondaryYAxisKey && { y2: parseFloat(String(row[config.secondaryYAxisKey])) })
        })).filter(p => !isNaN(p.x) && !isNaN(p.y) && (config.secondaryYAxisKey ? !isNaN(p.y2!) : true));

        if (scatterPlotData.length === 0) {
            return <p className="text-xs opacity-50 text-center p-4">Tidak ada data numerik X/Y yang valid untuk scatter plot setelah filter.</p>
        }
        return (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <ComposedChart {...commonProps} data={scatterPlotData}>
              <CartesianGrid strokeDasharray="3 3" stroke={themeMediumGrayHex} />
              <XAxis type="number" dataKey="x" name={config.xAxisKey} {...xAxisComputedProps} />
              <YAxis {...yAxisPropsPrimary} name={config.yAxisKey} dataKey="y"/>
              {config.secondaryYAxisKey && <YAxis {...yAxisPropsSecondary} name={config.secondaryYAxisKey} dataKey="y2" />}
              {tooltipElement}
              <Legend wrapperStyle={{ color: themeTextColorHex, fontSize: '10px'}}/>
              <Scatter name={config.yAxisKey} dataKey="y" fill={primaryChartColor} shape="star" style={{ filter: `drop-shadow(0 0 2px ${primaryChartColor})` }} />
              {config.secondaryYAxisKey && <Scatter name={config.secondaryYAxisKey} dataKey="y2" yAxisId="right" fill={secondaryStrokeColor} shape="circle" style={{ filter: `drop-shadow(0 0 2px ${secondaryStrokeColor})` }} />}
            </ComposedChart>
          </ResponsiveContainer>
        );
    }
    
    return (
      <ResponsiveContainer width="100%" height={chartHeight}>
        <ComposedChart {...commonProps}>
          <defs>
            <linearGradient id={`gradient-primary-db-${index}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={primaryDistinctFillBaseColor} stopOpacity={0.8}/>
              <stop offset="95%" stopColor={primaryDistinctFillBaseColor} stopOpacity={0.2}/>
            </linearGradient>
            {config.secondaryYAxisKey && (
              <linearGradient id={`gradient-secondary-db-${index}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={secondaryDistinctFillBaseColor} stopOpacity={0.7}/>
                <stop offset="95%" stopColor={secondaryDistinctFillBaseColor} stopOpacity={0.1}/>
              </linearGradient>
            )}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={themeMediumGrayHex} />
          <XAxis {...xAxisComputedProps} />
          <YAxis {...yAxisPropsPrimary} />
          {config.secondaryYAxisKey && <YAxis {...yAxisPropsSecondary} />}
          {tooltipElement}
          <Legend wrapperStyle={{ color: themeTextColorHex, fontSize: '10px'}}/>
          
          {config.chartType === 'bar' && 
              <Bar dataKey="primaryValue" name={config.yAxisKey} 
                  fill={primaryDistinctFillBaseColor} fillOpacity={0.3} 
                  stroke={primaryStrokeColor} strokeWidth={primaryBarStrokeWidthNew}
                  radius={[3, 3, 0, 0]} barSize={20}>
                  {showValueLabels && <LabelList dataKey="primaryValue" position="top" style={{ fill: themeTextColorHex, fontSize: '9px' }} formatter={valueLabelFormatter} />}
              </Bar>}
          {config.chartType === 'line' && 
            <Line type="monotone" dataKey="primaryValue" name={config.yAxisKey} stroke={primaryStrokeColor} strokeWidth={primaryLineStrokeWidth} 
                  dot={{ r: 3, fill: primaryStrokeColor, stroke: themeDarkBgHex, strokeWidth: 1, style: { filter: `drop-shadow(0 0 2px ${primaryStrokeColor})` } }} 
                  activeDot={{ r: 5, fill: primaryStrokeColor, stroke: themeDarkBgHex, strokeWidth: 1, style: { filter: `drop-shadow(0 0 3px ${primaryStrokeColor})` } }}>
              {showValueLabels && <LabelList dataKey="primaryValue" position="top" style={{ fill: themeTextColorHex, fontSize: '9px' }} formatter={valueLabelFormatter} />}
            </Line>}
          {config.chartType === 'area' && 
            <Area type="monotone" dataKey="primaryValue" name={config.yAxisKey} 
                  stroke={primaryStrokeColor} strokeWidth={primaryAreaStrokeWidthNew}
                  fill={`url(#gradient-primary-db-${index})`} fillOpacity={0.3} 
                  dot={{ r: 3, fill: primaryStrokeColor, stroke: themeDarkBgHex, strokeWidth: 1, style: { filter: `drop-shadow(0 0 2px ${primaryStrokeColor})` } }} 
                  activeDot={{ r: 5, fill: primaryStrokeColor, stroke: themeDarkBgHex, strokeWidth: 1, style: { filter: `drop-shadow(0 0 3px ${primaryStrokeColor})` } }}>
              {showValueLabels && <LabelList dataKey="primaryValue" position="top" offset={6} style={{ fill: themeTextColorHex, fontSize: '9px' }} formatter={valueLabelFormatter} />}
            </Area>}

          {config.secondaryYAxisKey && config.secondaryYAxisChartType === 'bar' && 
              <Bar yAxisId="right" dataKey="secondaryValue" name={config.secondaryYAxisKey} 
                  fill={secondaryDistinctFillBaseColor} fillOpacity={0.3} 
                  stroke={secondaryStrokeColor} strokeWidth={secondaryBarStrokeWidthNew}
                  radius={[3, 3, 0, 0]} barSize={15}>
                  {showValueLabels && <LabelList dataKey="secondaryValue" position="top" style={{ fill: themeTextColorHex, fontSize: '9px' }} formatter={valueLabelFormatter} />}
              </Bar>}
          {config.secondaryYAxisKey && config.secondaryYAxisChartType === 'line' && 
            <Line yAxisId="right" type="monotone" dataKey="secondaryValue" name={config.secondaryYAxisKey} stroke={secondaryStrokeColor} strokeWidth={secondaryLineStrokeWidth} 
                  dot={{ r: 2, fill: secondaryStrokeColor, stroke: themeDarkBgHex, strokeWidth: 1, style: { filter: `drop-shadow(0 0 2px ${secondaryStrokeColor})` } }} 
                  activeDot={{ r: 4, fill: secondaryStrokeColor, stroke: themeDarkBgHex, strokeWidth: 1, style: { filter: `drop-shadow(0 0 3px ${secondaryStrokeColor})` } }}>
              {showValueLabels && <LabelList dataKey="secondaryValue" position="top" style={{ fill: themeTextColorHex, fontSize: '9px' }} formatter={valueLabelFormatter} />}
            </Line>}
          {config.secondaryYAxisKey && config.secondaryYAxisChartType === 'area' && 
            <Area yAxisId="right" type="monotone" dataKey="secondaryValue" name={config.secondaryYAxisKey} 
                  stroke={secondaryStrokeColor} strokeWidth={secondaryAreaStrokeWidthNew} 
                  fill={`url(#gradient-secondary-db-${index})`} fillOpacity={0.3}
                  dot={{ r: 2, fill: secondaryStrokeColor, stroke: themeDarkBgHex, strokeWidth: 1, style: { filter: `drop-shadow(0 0 2px ${secondaryStrokeColor})` } }}
                  activeDot={{ r: 4, fill: secondaryStrokeColor, stroke: themeDarkBgHex, strokeWidth: 1, style: { filter: `drop-shadow(0 0 3px ${secondaryStrokeColor})` } }}>
              {showValueLabels && <LabelList dataKey="secondaryValue" position="top" offset={6} style={{ fill: themeTextColorHex, fontSize: '9px' }} formatter={valueLabelFormatter} />}
            </Area>}
        </ComposedChart>
      </ResponsiveContainer>
    );
  };
  
  const selectStyles = getSharedSelectBaseStyles(theme, 'text-xs');
  const markdownThemeComponents = useMemo(() => MarkdownComponents(theme), [theme]);

  const cardHoverClass = reduceMotion ? '' : `hover:-translate-y-1 hover:scale-[1.01] hover:shadow-neon-glow-${theme.accent1}/50 transition-all duration-300`;
  
  const titleGlowStyle: React.CSSProperties = {
    '--glow-color-1': RAW_COLOR_VALUES[theme.accent1] || '#00D4FF',
    '--glow-color-2': RAW_COLOR_VALUES[theme.accent2] || '#8B5CF6',
  } as React.CSSProperties;


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
          <h1 
            className={`text-3xl md:text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-${theme.accent1} to-${theme.accent2} report-title-glow`}
            style={titleGlowStyle}
          >
            Laporan Dashboard Interaktif
          </h1>
          <p className="text-xs opacity-70">Update Terakhir: {lastUpdated}</p>
        </div>

        <div className={`${theme.cardBg} p-4 rounded-lg shadow-lg border ${theme.borderColor} mb-6 ${cardHoverClass}`}>
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center">
                <FilterIcon size={20} className={`mr-2 text-${theme.accent3}`} />
                <h2 className={`text-lg font-semibold text-${theme.accent3}`}>Filter Global</h2>
            </div>
            <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsGlobalFilterMinimized(!isGlobalFilterMinimized)}
                title={isGlobalFilterMinimized ? "Expand Global Filters" : "Minimize Global Filters"}
                className="!p-1"
                aria-expanded={!isGlobalFilterMinimized} 
                aria-controls="global-filters-content"
            >
                {isGlobalFilterMinimized ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
            </Button>
          </div>
          <div id="global-filters-content" className={`${reduceMotion ? '' : 'transition-all duration-300 ease-in-out'} overflow-hidden ${isGlobalFilterMinimized ? 'max-h-0 opacity-0' : 'max-h-[500px] opacity-100'}`}>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 items-end pt-2">
              <div>
                <label htmlFor="globalFilterHeader0" className={`block text-[10px] font-medium ${theme.textColor} opacity-70 mb-0.5`}>Header Filter 1</label>
                <select id="globalFilterHeader0" value={globalFilters[0].header || ''} onChange={(e) => handleGlobalFilterChange(0, 'header', e.target.value)} className={`${selectStyles.baseClassName} w-full !py-1`} style={selectStyles.style}>
                  <option value="" style={selectStyles.optionStyle}>-- Pilih Header --</option>
                  {allHeaders.map(h => <option key={`gf0-${h}`} value={h} style={selectStyles.optionStyle}>{h}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="globalFilterValue0" className={`block text-[10px] font-medium ${theme.textColor} opacity-70 mb-0.5`}>Value Filter 1</label>
                <select id="globalFilterValue0" value={globalFilters[0].value || ''} onChange={(e) => handleGlobalFilterChange(0, 'value', e.target.value)} disabled={!globalFilters[0].header} className={`${selectStyles.baseClassName} w-full !py-1`} style={selectStyles.style}>
                  <option value="" style={selectStyles.optionStyle}>-- Pilih Value --</option>
                  {getGlobalFilterValueOptions(0).map(val => <option key={`gf0v-${val}`} value={val} style={selectStyles.optionStyle}>{val}</option>)}
                </select>
              </div>
              <div className="md:col-span-1 flex items-end">
                {!showSecondGlobalFilter ? (
                  <Button onClick={handleAddSecondFilter} variant="secondary" size="sm" leftIcon={<PlusCircle size={14} />} className="w-full md:w-auto">Tambah Filter</Button>
                ) : (<div className="w-full"></div>) }
              </div>
              {showSecondGlobalFilter && (
                  <>
                    <div>
                      <label htmlFor="globalFilterHeader1" className={`block text-[10px] font-medium ${theme.textColor} opacity-70 mb-0.5`}>Header Filter 2</label>
                      <select id="globalFilterHeader1" value={globalFilters[1].header || ''} onChange={(e) => handleGlobalFilterChange(1, 'header', e.target.value)} className={`${selectStyles.baseClassName} w-full !py-1`} style={selectStyles.style} disabled={!globalFilters[0].header || !globalFilters[0].value}>
                        <option value="" style={selectStyles.optionStyle}>-- Pilih Header --</option>
                        {allHeaders.filter(h => h !== globalFilters[0].header).map(h => <option key={`gf1-${h}`} value={h} style={selectStyles.optionStyle}>{h}</option>)}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="globalFilterValue1" className={`block text-[10px] font-medium ${theme.textColor} opacity-70 mb-0.5`}>Value Filter 2</label>
                      <select id="globalFilterValue1" value={globalFilters[1].value || ''} onChange={(e) => handleGlobalFilterChange(1, 'value', e.target.value)} disabled={!globalFilters[1].header || !globalFilters[0].header || !globalFilters[0].value} className={`${selectStyles.baseClassName} w-full !py-1`} style={selectStyles.style}>
                        <option value="" style={selectStyles.optionStyle}>-- Pilih Value --</option>
                        {getGlobalFilterValueOptions(1).map(val => <option key={`gf1v-${val}`} value={val} style={selectStyles.optionStyle}>{val}</option>)}
                      </select>
                    </div>
                    <div className="md:col-start-3 flex items-end">
                      <Button onClick={handleRemoveSecondFilter} variant="danger" size="sm" leftIcon={<Trash2 size={14} />} className="w-full md:w-auto">Hapus Filter Kedua</Button>
                    </div>
                  </>
              )}
            </div>
          </div>
        </div>

        <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6`}>
          {keyMetrics.map(metric => (
            <div key={metric.label} className={`${theme.cardBg} p-4 rounded-lg shadow-lg border ${theme.borderColor} flex items-center space-x-3 ${cardHoverClass}`}>
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
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className={`space-y-6 ${theme.cardBg} p-4 rounded-lg shadow-xl border ${theme.borderColor} ${cardHoverClass}`}>
            <div>
              <div className="flex justify-between items-center mb-3">
                <div className="flex items-center">
                  <MessageCircle size={20} className={`mr-2 text-${theme.accent4}`} />
                  <h2 className={`text-xl font-semibold text-${theme.accent4}`}>Ringkasan Naratif AI</h2>
                </div>
              </div>
              <div className="mb-3">
                <label htmlFor="manualAiInstruction" className={`block text-xs font-medium ${theme.textColor} opacity-80 mb-1`}>
                  Instruksi Manual (Opsional untuk AI):
                </label>
                <textarea
                  id="manualAiInstruction"
                  value={manualAiInstruction}
                  onChange={(e) => setManualAiInstruction(e.target.value)}
                  placeholder="Contoh: Fokus pada tren penjualan produk X, atau identifikasi anomali dalam biaya operasional."
                  rows={2}
                  className={`w-full text-xs p-2 border rounded-md futuristic-scrollbar bg-${theme.darkGray}/50 border-${theme.mediumGray} focus:ring-1 focus:ring-${theme.accent1} focus:border-${theme.accent1}`}
                  style={{color: RAW_COLOR_VALUES[theme.textColor.replace('text-','')]}}
                />
              </div>
              <Button onClick={generateAiSummary} size="sm" variant="secondary" isLoading={isAiSummaryLoading} disabled={isAiSummaryLoading} leftIcon={<Send size={14}/>} className="w-full sm:w-auto">
                {isAiSummaryLoading ? "Menghasilkan..." : (aiSummary ? "Segarkan Ringkasan AI" : "Hasilkan Ringkasan AI")}
              </Button>
              
              {isAiSummaryLoading && <div className="flex justify-center py-4 mt-3"><LoadingSpinner text="AI sedang menganalisis..."/></div>}
              
              {aiSummary && !isAiSummaryLoading && (
                <div className={`mt-4 p-3 border rounded-md bg-${theme.darkGray}/30 border-${theme.mediumGray} max-h-60 overflow-y-auto futuristic-scrollbar`}>
                  <ReactMarkdown components={markdownThemeComponents} remarkPlugins={[remarkGfm]}>
                    {aiSummary}
                  </ReactMarkdown>
                </div>
              )}
              {!aiSummary && !isAiSummaryLoading && <p className="text-xs opacity-70 text-center py-4 mt-3">Klik "Hasilkan Ringkasan AI" untuk mendapatkan narasi dari AI, atau berikan instruksi manual di atas.</p>}
            </div>

            {dataQualityHighlights.length > 0 && (
              <div className={`p-4 rounded-lg shadow-lg border ${theme.borderColor}`}>
                  <div className="flex items-center mb-2"> <Info size={18} className={`mr-2 text-${theme.accent3}`} /> <h2 className={`text-lg font-semibold text-${theme.accent3}`}>Sorotan Kualitas Data</h2> </div>
                  <ul className="list-disc list-inside space-y-1 text-xs opacity-90"> {dataQualityHighlights.map((highlight, index) => <li key={index}>{highlight}</li>)} </ul>
              </div>
            )}
          </div>

           <div className={`${theme.cardBg} p-4 rounded-lg shadow-xl border ${theme.borderColor} ${cardHoverClass}`}>
            <div className="flex justify-between items-center mb-3">
                <h2 className={`text-xl font-semibold text-${theme.accent1}`}>Ringkasan Tabel Pivot</h2>
                {pivotResult && <Sigma size={20} className={`text-${theme.accent1}`} />}
            </div>
            {renderActualPivotTable()}
          </div>
        </div>

        <div className={`mt-6 ${theme.cardBg} p-4 rounded-lg shadow-xl border ${theme.borderColor} ${cardHoverClass}`}>
            <div className="flex justify-between items-center mb-3"> <h2 className={`text-xl font-semibold text-${theme.accent2}`}>Grafik Visualisasi</h2> {chartConfigs.length > 0 && <ChartIconLucide size={20} className={`text-${theme.accent2}`} />} </div>
            {chartConfigs.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {chartConfigs.map((chartConfig, index) => (
                      <div key={`dashboard-chart-${index}`} className={`${theme.cardBg} p-4 rounded-lg shadow-md border ${theme.borderColor} ${cardHoverClass}`}> {/* Inner card hover */}
                        <h3 className={`text-md font-semibold mb-2 text-${theme.accent2}`}>{chartConfig.yAxisKey} berdasarkan {chartConfig.xAxisKey} ({chartConfig.chartType})</h3>
                        {renderSingleChart(chartConfig, index)}
                      </div>
                    ))}
                </div>
            ) : (
              <div className={`text-center py-8`}> <EyeOff size={32} className={`mx-auto mb-2 text-${theme.accent4} opacity-70`} /> <p className="opacity-70">Tidak ada grafik yang dikonfigurasi.</p> <p className="text-xs opacity-50">Buka halaman "Visualisasi" untuk mengatur grafik.</p> </div>
            )}
        </div>
        
        <div className={`mt-6 ${theme.cardBg} p-4 rounded-lg shadow-xl border ${theme.borderColor} ${cardHoverClass}`}>
            <div className="flex justify-between items-center mb-3"> <h2 className={`text-xl font-semibold text-${theme.accent3}`}>Ringkasan Kolom</h2> {columnSummaries.length > 4 && ( <Button variant="ghost" size="sm" onClick={() => setShowAllColumnSummaries(!showAllColumnSummaries)} className={`text-xs text-${theme.accent1}`}> {showAllColumnSummaries ? "Tampilkan Lebih Sedikit" : "Tampilkan Semua"} ({columnSummaries.length}) </Button> )} </div>
             {displayedColumnSummaries.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {displayedColumnSummaries.map(summary => (
                        <div key={summary.name} className={`${theme.cardBg} p-3 rounded-lg shadow-md border ${theme.borderColor} ${cardHoverClass}`}> {/* Inner card hover */}
                            <h4 className={`text-sm font-bold text-${theme.accent4} truncate mb-1`} title={summary.name}>{summary.name}</h4>
                            <p className="text-xs opacity-80">Tipe: {summary.type}</p> <p className="text-xs opacity-80">Hilang: {summary.missingPercentage}%</p> <p className="text-xs opacity-80">Unik: {summary.uniqueCount}</p>
                            {summary.type === 'numeric' && summary.mean !== undefined && <p className="text-xs opacity-80">Rata-rata: {summary.mean.toLocaleString(undefined, {maximumFractionDigits:1})}</p>}
                            {summary.type !== 'numeric' && summary.mostFrequent.length > 0 && <p className="text-xs opacity-80 truncate" title={`Teratas: ${summary.mostFrequent[0].value}`}>Teratas: {summary.mostFrequent[0].value}</p>}
                        </div>
                    ))}
                </div>
             ) : ( <p className="opacity-70 text-center py-4">Tidak ada ringkasan kolom untuk ditampilkan (mungkin karena filter global).</p> )}
        </div>
      </div>
    </div>
  );
};

export default DashboardReport;
