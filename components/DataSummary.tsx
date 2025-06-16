import React, { useContext, useMemo, useState, useEffect, useRef } from 'react';
import { AppContext } from '../contexts/AppContext';
import { AppContextType, DataRow, Theme, ColumnSummary, ColumnType, NumericStats, CategoricalStats } from '../types';
import { AlertTriangle, Info, BarChartHorizontalBig, FileJson, Hash, TrendingUp, TrendingDown, ClipboardList, Filter as FilterIcon, CheckSquare, Square, XCircle, ZoomIn, ChevronDown, ChevronUp } from 'lucide-react';
import { RAW_COLOR_VALUES } from '../constants';
import Button from './shared/Button';
import Modal from './shared/Modal'; // Ensure Modal is imported
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';
import { getSharedSelectBaseStyles } from '../utils'; // Import shared utility


interface FilterSlot {
  header?: string;
  value?: string;
}

const MINI_CHART_BINS = 5; // For numeric histograms
const MINI_CHART_TOP_N = 3; // For categorical bar charts

const detectColumnType = (values: any[]): ColumnType => {
  if (values.every(v => v === null || v === undefined || String(v).trim() === '')) return 'empty';
  
  const nonNullValues = values.filter(v => v !== null && v !== undefined && String(v).trim() !== '');
  if (nonNullValues.length === 0) return 'empty';

  const isNumeric = nonNullValues.every(v => !isNaN(parseFloat(String(v))) && isFinite(Number(v)));
  if (isNumeric) return 'numeric';

  const isBoolean = nonNullValues.every(v => typeof v === 'boolean' || ['true', 'false'].includes(String(v).toLowerCase()));
  if (isBoolean) return 'boolean';
  
  let hasNumber = false;
  let hasString = false;
  let hasBool = false;

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

const calculateNumericStats = (values: number[]): NumericStats & { histogramBins?: { name: string; value: number }[] } => {
  if (values.length === 0) return { histogramBins: [] };
  const sortedValues = [...values].sort((a, b) => a - b);
  const sum = values.reduce((acc, val) => acc + val, 0);
  const mean = sum / values.length;
  const median = values.length % 2 === 0
    ? (sortedValues[values.length / 2 - 1] + sortedValues[values.length / 2]) / 2
    : sortedValues[Math.floor(values.length / 2)];
  const stdDev = values.length > 1 ? Math.sqrt(values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / (values.length -1 )) : 0;
  
  // Histogram bins calculation
  const minVal = sortedValues[0];
  const maxVal = sortedValues[values.length - 1];
  const histogramBins: { name: string; value: number }[] = [];

  if (minVal === maxVal && values.length > 0) { // All values are the same
    histogramBins.push({ name: String(minVal), value: values.length });
  } else if (values.length > 0) {
    const binWidth = (maxVal - minVal) / MINI_CHART_BINS;
    for (let i = 0; i < MINI_CHART_BINS; i++) {
      const binMin = minVal + i * binWidth;
      const binMax = minVal + (i + 1) * binWidth;
      const count = values.filter(v => v >= binMin && (i === MINI_CHART_BINS - 1 ? v <= binMax : v < binMax)).length;
      histogramBins.push({ name: `${formatValue(binMin, 'numeric')}-${formatValue(binMax, 'numeric')}`, value: count });
    }
  }

  return {
    min: sortedValues[0],
    max: sortedValues[values.length - 1],
    mean: parseFloat(mean.toFixed(2)),
    median: parseFloat(median.toFixed(2)),
    stdDev: parseFloat(stdDev.toFixed(2)),
    sum: parseFloat(sum.toFixed(2)),
    histogramBins,
  };
};

const calculateCategoricalStats = (values: string[], topN: number = 5): CategoricalStats & { topNCategorical?: { name: string; value: number }[] } => {
  if (values.length === 0) return { mostFrequent: [], leastFrequent: [], topNCategorical: [] };
  const frequencyMap = new Map<string, number>();
  values.forEach(val => {
    frequencyMap.set(val, (frequencyMap.get(val) || 0) + 1);
  });
  const sortedFrequencies = Array.from(frequencyMap.entries())
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || String(a.value).localeCompare(String(b.value)));
  
  return {
    mostFrequent: sortedFrequencies.slice(0, topN),
    leastFrequent: sortedFrequencies.slice(-topN).reverse(),
    topNCategorical: sortedFrequencies.slice(0, MINI_CHART_TOP_N).map(item => ({ name: item.value || '(empty)', value: item.count })),
  };
};

const formatValue = (value: any, type: ColumnType): string => {
    if (value === undefined || value === null) return 'N/A';
    if (typeof value === 'number') {
        if (value % 1 === 0) return value.toLocaleString(); 
        return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }); 
    }
    if (type === 'boolean') return String(value);
    return String(value);
};

// Helper function to render column summary details
const renderColumnSummaryDetails = (col: ColumnSummary, theme: Theme, isZoomedView: boolean = false) => {
  const accent4Color = RAW_COLOR_VALUES[theme.accent4];
  const miniChartFillColor = RAW_COLOR_VALUES[theme.accent1] || '#00D4FF';
  
  const textSizeClass = isZoomedView ? 'text-lg' : 'text-sm';
  const headingSizeClass = isZoomedView ? 'text-xl' : 'text-base';
  const itemKeyClass = isZoomedView ? 'font-bold' : 'font-semibold';

  const mostFrequentValueSize = isZoomedView ? 'text-base' : 'text-xs';
  const mostFrequentCountSize = isZoomedView ? 'text-sm' : 'text-[11px]';

  const renderMiniChart = () => {
    if (isZoomedView) return null; // Don't show mini charts in zoomed view

    if (col.type === 'numeric' && col.histogramBins && col.histogramBins.length > 0) {
      return (
        <div className="mt-2 h-[60px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={col.histogramBins} margin={{ top: 5, right: 5, left: -30, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 8, fill: RAW_COLOR_VALUES[theme.textColor.replace('text-','')] }} interval="preserveStartEnd" />
              <Bar dataKey="value" fill={miniChartFillColor} radius={[2, 2, 0, 0]} fillOpacity={0.7} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      );
    }

    if ((col.type === 'string' || col.type === 'mixed' || col.type === 'boolean') && col.topNCategorical && col.topNCategorical.length > 0) {
      return (
        <div className="mt-2 h-[60px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={col.topNCategorical} layout="vertical" margin={{ top: 5, right: 5, left: 5, bottom: 0 }}>
              <XAxis type="number" hide />
              <YAxis 
                type="category" 
                dataKey="name" 
                width={60} 
                tick={{ fontSize: 8, fill: RAW_COLOR_VALUES[theme.textColor.replace('text-','')] }} 
                tickFormatter={(value) => String(value).length > 8 ? String(value).substring(0,7) + '...' : value}
              />
              <Bar dataKey="value" fill={miniChartFillColor} radius={[0, 2, 2, 0]} barSize={10} fillOpacity={0.7} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      );
    }
    return null;
  };


  return (
    <div className={`${textSizeClass} space-y-2 opacity-90`}>
      <p><strong className={itemKeyClass}>Type:</strong> <span className={`px-1.5 py-0.5 rounded ${textSizeClass} bg-${theme.mediumGray}/50 border border-${theme.borderColor}`}>{col.type}</span></p>
      <p><strong className={itemKeyClass}>Total (in selection):</strong> {col.totalRows.toLocaleString()}</p>
      <p><strong className={itemKeyClass}>Missing:</strong> {col.missingCount} ({col.missingPercentage}%)</p>
      <p><strong className={itemKeyClass}>Unique Values:</strong> {col.uniqueCount.toLocaleString()}</p>

      {col.type === 'numeric' && (
        <>
          <p className={`mt-2 pt-2 border-t border-${theme.borderColor}/30 ${headingSizeClass} font-semibold`} style={{color: accent4Color}}>Numeric Stats:</p>
          <p><strong className={itemKeyClass}>Min:</strong> {formatValue(col.min, col.type)}</p>
          <p><strong className={itemKeyClass}>Max:</strong> {formatValue(col.max, col.type)}</p>
          <p><strong className={itemKeyClass}>Mean:</strong> {formatValue(col.mean, col.type)}</p>
          <p><strong className={itemKeyClass}>Median:</strong> {formatValue(col.median, col.type)}</p>
          <p><strong className={itemKeyClass}>Std. Dev:</strong> {formatValue(col.stdDev, col.type)}</p>
          <p><strong className={itemKeyClass}>Sum:</strong> {formatValue(col.sum, col.type)}</p>
        </>
      )}
      
      {(col.type === 'string' || col.type === 'mixed' || col.type === 'boolean') && col.mostFrequent.length > 0 && (
        <>
          <p className={`mt-2 pt-2 border-t border-${theme.borderColor}/30 ${headingSizeClass} font-semibold`} style={{color: accent4Color}}>Most Frequent (Top {col.mostFrequent.length}):</p>
          <ul className="list-none pl-0">
            {col.mostFrequent.map(item => (
              <li key={item.value} className="truncate" title={item.value}>
                <span className={`px-1.5 py-0.5 rounded ${mostFrequentValueSize} bg-${theme.darkGray} border border-${theme.borderColor}`}>
                  {item.value || '(empty)'}
                </span>: <span className={mostFrequentCountSize}>{item.count}</span>
              </li>
            ))}
          </ul>
        </>
      )}
       {col.totalRows === 0 && col.type !== 'empty' && (
          <p className="italic opacity-70 mt-2">No data for this column after current filters.</p>
       )}
       {renderMiniChart()}
    </div>
  );
};


const DataSummary: React.FC = () => {
  const { theme, processedData, reduceMotion } = useContext(AppContext) as AppContextType;
  
  const [selectedColumns, setSelectedColumns] = useState<Record<string, boolean>>({});
  const [isColumnFilterDropdownOpen, setIsColumnFilterDropdownOpen] = useState(false);
  const columnFilterDropdownRef = useRef<HTMLDivElement>(null);

  const [advancedFilters, setAdvancedFilters] = useState<[FilterSlot, FilterSlot, FilterSlot]>([{}, {}, {}]);
  const [isAdvFilterSectionOpen, setIsAdvFilterSectionOpen] = useState(false);

  const [isSummaryZoomModalOpen, setIsSummaryZoomModalOpen] = useState(false);
  const [zoomedColumnSummary, setZoomedColumnSummary] = useState<ColumnSummary | null>(null);

  const allHeaders = useMemo(() => processedData?.headers || [], [processedData]);

  useEffect(() => {
    if (allHeaders.length > 0) {
      const initialSelected: Record<string, boolean> = {};
      allHeaders.forEach(header => { initialSelected[header] = true; });
      setSelectedColumns(initialSelected);
    } else {
      setSelectedColumns({});
    }
    setAdvancedFilters([{}, {}, {}]);
    setIsAdvFilterSectionOpen(false); 
  }, [allHeaders, processedData]);
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (columnFilterDropdownRef.current && !columnFilterDropdownRef.current.contains(event.target as Node)) {
        setIsColumnFilterDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredDataForStats = useMemo(() => {
    if (!processedData || !processedData.data) return [];
    let dataToFilter = [...processedData.data];
    advancedFilters.forEach(filter => {
      if (filter.header && filter.value !== undefined) {
        dataToFilter = dataToFilter.filter(row => String(row[filter.header!]) === filter.value);
      }
    });
    return dataToFilter;
  }, [processedData, advancedFilters]);

  const handleAdvancedFilterChange = (filterIndex: number, type: 'header' | 'value', newValue: string) => {
    setAdvancedFilters(prevFilters => {
      const newFilters = [...prevFilters] as [FilterSlot, FilterSlot, FilterSlot];
      newFilters[filterIndex] = { ...newFilters[filterIndex] }; 

      if (type === 'header') {
        newFilters[filterIndex].header = newValue;
        newFilters[filterIndex].value = undefined; 
        for (let i = filterIndex + 1; i < newFilters.length; i++) {
          newFilters[i] = {};
        }
      } else { 
        newFilters[filterIndex].value = newValue;
        for (let i = filterIndex + 1; i < newFilters.length; i++) {
          newFilters[i] = { ...newFilters[i], value: undefined };
        }
      }
      return newFilters;
    });
  };
  
  const getDynamicValueOptions = (filterIndex: number): string[] => {
    if (!processedData?.data) return [];
    const currentFilterHeader = advancedFilters[filterIndex].header;
    if (!currentFilterHeader) return [];

    let dataForCurrentDropdown = [...processedData.data];
    for (let i = 0; i < filterIndex; i++) {
      const prevFilter = advancedFilters[i];
      if (prevFilter.header && prevFilter.value !== undefined) {
        dataForCurrentDropdown = dataForCurrentDropdown.filter(row => String(row[prevFilter.header!]) === prevFilter.value);
      }
    }
    return [...new Set(dataForCurrentDropdown.map(row => String(row[currentFilterHeader])).sort((a,b) => a.localeCompare(b)))];
  };

  const clearAdvancedFilters = () => {
    setAdvancedFilters([{}, {}, {}]);
  };

  const summaryStats = useMemo((): ColumnSummary[] | null => {
    if (filteredDataForStats.length === 0 && processedData && processedData.data.length > 0) {
      return allHeaders.map(header => ({
        name: header,
        type: detectColumnType(processedData.data.map(r => r[header])),
        totalRows: 0, 
        missingCount: 0,
        missingPercentage: 0,
        uniqueCount: 0,
        mostFrequent: [],
        leastFrequent: [],
        histogramBins: [],
        topNCategorical: [],
      }));
    }
    if (filteredDataForStats.length === 0) return null; 

    const totalRows = filteredDataForStats.length;

    return allHeaders.map(header => {
      const columnValues = filteredDataForStats.map(row => row[header]);
      const nonMissingValues = columnValues.filter(v => v !== null && v !== undefined && String(v).trim() !== '');
      const missingCount = totalRows - nonMissingValues.length;
      
      const type = detectColumnType(columnValues);
      let numericStats: NumericStats & { histogramBins?: { name: string; value: number }[] } = {};
      let categoricalStats: CategoricalStats & { topNCategorical?: { name: string; value: number }[] } = { mostFrequent: [], leastFrequent: [], topNCategorical: [] };


      if (type === 'numeric') {
        const numericData = nonMissingValues.map(v => parseFloat(String(v))).filter(n => !isNaN(n));
        numericStats = calculateNumericStats(numericData);
      } else if (type === 'string' || type === 'mixed' || type === 'boolean') {
        categoricalStats = calculateCategoricalStats(nonMissingValues.map(String));
      }
      
      const uniqueCount = new Set(nonMissingValues).size;

      return {
        name: header,
        type,
        totalRows,
        missingCount,
        missingPercentage: totalRows > 0 ? parseFloat(((missingCount / totalRows) * 100).toFixed(1)) : 0,
        uniqueCount,
        ...numericStats,
        ...categoricalStats,
      };
    });
  }, [filteredDataForStats, allHeaders, processedData]); 
  
  const handleSelectAllColumns = () => {
    const allSelected: Record<string, boolean> = {};
    allHeaders.forEach(header => { allSelected[header] = true; });
    setSelectedColumns(allSelected);
  };

  const handleUnselectAllColumns = () => {
    const noneSelected: Record<string, boolean> = {};
    allHeaders.forEach(header => { noneSelected[header] = false; });
    setSelectedColumns(noneSelected);
  };

  const handleColumnSelectionChange = (headerName: string) => {
    setSelectedColumns(prev => ({ ...prev, [headerName]: !prev[headerName] }));
  };

  const displayedSummaryStats = useMemo(() => {
    if (!summaryStats) return [];
    return summaryStats.filter(col => selectedColumns[col.name]);
  }, [summaryStats, selectedColumns]);

  const handleZoomColumnSummary = (summary: ColumnSummary) => {
    setZoomedColumnSummary(summary);
    setIsSummaryZoomModalOpen(true);
  };

  if (!processedData) {
    return (
      <div className={`p-8 ${theme.textColor} flex flex-col items-center justify-center h-full`}>
        <AlertTriangle size={48} className={`text-${theme.accent4} mb-4`} />
        <h2 className="text-2xl font-semibold">No Data Loaded</h2>
        <p className="opacity-70">Please import a file to view its summary.</p>
      </div>
    );
  }
  
  const selectStyles = getSharedSelectBaseStyles(theme); 
  const accent1Color = RAW_COLOR_VALUES[theme.accent1];
  const accent2Color = RAW_COLOR_VALUES[theme.accent2];
  const accent3Color = RAW_COLOR_VALUES[theme.accent3];
  
  return (
    <div className={`p-4 md:p-8 ${theme.textColor} futuristic-scrollbar overflow-auto h-full`}>
      <div className="flex justify-between items-center mb-8">
        <h1 className={`text-3xl md:text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-${theme.accent1} to-${theme.accent2}`}>Data Summary</h1>
      </div>

      <div className={`${theme.cardBg} p-6 rounded-xl shadow-xl border ${theme.borderColor} mb-8`}>
        <div className="flex items-center mb-4">
            <ClipboardList size={28} style={{ color: accent1Color }} className="mr-3" />
            <h2 className="text-2xl font-semibold" style={{ color: accent1Color }}>Dataset Overview</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
            <div className={`p-3 rounded-lg bg-${theme.darkGray}/50 border border-${theme.mediumGray}`}>
                <p className="opacity-70">File Name:</p>
                <p className="font-semibold text-base truncate" title={processedData.fileName}>{processedData.fileName}</p>
            </div>
            {processedData.sheetName && (
                <div className={`p-3 rounded-lg bg-${theme.darkGray}/50 border border-${theme.mediumGray}`}>
                    <p className="opacity-70">Sheet Name:</p>
                    <p className="font-semibold text-base truncate" title={processedData.sheetName}>{processedData.sheetName}</p>
                </div>
            )}
            <div className={`p-3 rounded-lg bg-${theme.darkGray}/50 border border-${theme.mediumGray}`}>
                <p className="opacity-70">Original Rows:</p>
                <p className="font-semibold text-base">{processedData.data.length.toLocaleString()}</p>
            </div>
             <div className={`p-3 rounded-lg bg-${theme.darkGray}/50 border border-${theme.mediumGray}`}>
                <p className="opacity-70">Rows for Stats (after adv. filters):</p>
                <p className="font-semibold text-base">{filteredDataForStats.length.toLocaleString()}</p>
            </div>
            <div className={`p-3 rounded-lg bg-${theme.darkGray}/50 border border-${theme.mediumGray}`}>
                <p className="opacity-70">Total Columns:</p>
                <p className="font-semibold text-base">{allHeaders.length.toLocaleString()}</p>
            </div>
        </div>
      </div>

      <div className={`${theme.cardBg} p-6 rounded-xl shadow-xl border ${theme.borderColor} mb-8`}>
        <details className="group" open={isAdvFilterSectionOpen}>
          <summary
            className={`flex justify-between items-center py-2 px-1 cursor-pointer rounded hover:bg-${theme.mediumGray}/20 transition-colors list-none`}
            onClick={(e) => {
              e.preventDefault();
              setIsAdvFilterSectionOpen(!isAdvFilterSectionOpen);
            }}
          >
            <div className="flex items-center">
              <FilterIcon size={24} style={{ color: accent3Color }} className="mr-3" />
              <h2 className="text-xl font-semibold" style={{ color: accent3Color }}>Advanced Data Filters</h2>
            </div>
            <div className="flex items-center">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={(e) => { e.stopPropagation(); clearAdvancedFilters(); }} 
                leftIcon={<XCircle size={14} />} 
                className={`hover:text-${theme.accent4} mr-2`}
              >
                Clear Filters
              </Button>
              {isAdvFilterSectionOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </div>
          </summary>
          
          <div className={`mt-4 border-t border-${theme.mediumGray}/30 pt-4`}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4">
                {[0, 1, 2].map(idx => (
                    <div key={`adv-filter-${idx}`} className={`p-3 border rounded-md border-${theme.mediumGray}/70 space-y-2`}>
                        <p className="text-xs font-semibold opacity-70" style={{color: theme.textColor}}>Filter Slot {idx + 1}</p>
                        <select
                            value={advancedFilters[idx].header || ''}
                            onChange={(e) => handleAdvancedFilterChange(idx, 'header', e.target.value)}
                            className={`${selectStyles.baseClassName} w-full p-2`}
                            style={selectStyles.style}
                        >
                            <option value="" style={selectStyles.optionStyle}>Select Header {idx + 1}</option>
                            {allHeaders.map(h => <option key={h} value={h} style={selectStyles.optionStyle}>{h}</option>)}
                        </select>
                        <select
                            value={advancedFilters[idx].value || ''}
                            onChange={(e) => handleAdvancedFilterChange(idx, 'value', e.target.value)}
                            disabled={!advancedFilters[idx].header}
                            className={`${selectStyles.baseClassName} w-full p-2`}
                            style={selectStyles.style}
                        >
                            <option value="" style={selectStyles.optionStyle}>Select Value {idx + 1}</option>
                            {getDynamicValueOptions(idx).map(val => <option key={val} value={val} style={selectStyles.optionStyle}>{val}</option>)}
                        </select>
                    </div>
                ))}
            </div>
            {filteredDataForStats.length !== processedData.data.length && (
                <p className="text-xs mt-3 opacity-70" style={{color: theme.textColor}}>
                    Advanced filters applied. Statistics below are based on {filteredDataForStats.length.toLocaleString()} matching rows.
                </p>
            )}
          </div>
        </details>
      </div>

      <div className="flex justify-between items-center mb-6">
        <h2 className={`text-2xl font-semibold`} style={{ color: accent2Color }}>Column Statistics</h2>
        <div className="relative" ref={columnFilterDropdownRef}>
            <Button 
                variant="secondary" 
                onClick={() => setIsColumnFilterDropdownOpen(!isColumnFilterDropdownOpen)}
                leftIcon={<FilterIcon size={16} />}
            >
                Show/Hide Columns ({displayedSummaryStats.length}/{allHeaders.length})
            </Button>
            {isColumnFilterDropdownOpen && (
                <div 
                    className={`absolute right-0 mt-2 w-72 p-4 rounded-lg shadow-2xl z-30 border max-h-96 overflow-y-auto futuristic-scrollbar`}
                    style={{
                        backgroundColor: RAW_COLOR_VALUES[theme.cardBg.replace('bg-', '').split('/')[0]] || RAW_COLOR_VALUES[theme.darkGray],
                        borderColor: RAW_COLOR_VALUES[theme.borderColor.replace('border-', '')] || RAW_COLOR_VALUES[theme.mediumGray],
                    }}
                >
                    <div className="flex justify-between items-center mb-3">
                        <Button variant="ghost" size="sm" onClick={handleSelectAllColumns} className={`${theme.textColor} hover:text-${theme.accent1}`}>Select All</Button>
                        <Button variant="ghost" size="sm" onClick={handleUnselectAllColumns} className={`${theme.textColor} hover:text-${theme.accent1}`}>Unselect All</Button>
                    </div>
                    <div className="space-y-2">
                        {allHeaders.map(header => (
                            <label key={header} className={`flex items-center space-x-2 p-1.5 rounded cursor-pointer hover:bg-${theme.mediumGray}/30 transition-colors`}>
                                <input
                                    type="checkbox"
                                    checked={selectedColumns[header] || false}
                                    onChange={() => handleColumnSelectionChange(header)}
                                    className={`form-checkbox h-4 w-4 rounded border focus:ring-offset-0 focus:ring-1`}
                                    style={{
                                        backgroundColor: RAW_COLOR_VALUES[theme.darkGray],
                                        borderColor: RAW_COLOR_VALUES[theme.mediumGray],
                                        color: RAW_COLOR_VALUES[theme.accent1],
                                        accentColor: RAW_COLOR_VALUES[theme.accent1] 
                                    }}
                                />
                                <span className={`text-sm truncate ${theme.textColor}`}>{header}</span>
                            </label>
                        ))}
                    </div>
                </div>
            )}
        </div>
      </div>
      
      {!summaryStats && processedData.data.length > 0 && (
        <div className={`${theme.cardBg} p-6 rounded-xl shadow-lg border ${theme.borderColor} text-center ${!reduceMotion ? 'animate-fade-in' : ''}`}>
          <Info size={48} className={`mx-auto mb-4 text-${theme.accent3}`} />
          <p className="text-lg">No data matches the advanced filters.</p>
          <p className="text-sm opacity-70">Try adjusting the advanced filter settings above.</p>
        </div>
      )}

      {displayedSummaryStats.length === 0 && allHeaders.length > 0 && summaryStats && (
         <div className={`${theme.cardBg} p-6 rounded-xl shadow-lg border ${theme.borderColor} text-center ${!reduceMotion ? 'animate-fade-in' : ''}`}>
          <Info size={48} className={`mx-auto mb-4 text-${theme.accent3}`} />
          <p className="text-lg">No columns selected for display.</p>
          <p className="text-sm opacity-70">Use the "Show/Hide Columns" button to display statistics.</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {summaryStats && displayedSummaryStats.map((col) => (
          <div key={col.name} className={`${theme.cardBg} p-4 rounded-lg shadow-lg border ${theme.borderColor} flex flex-col ${!reduceMotion ? `hover:shadow-neon-glow-${theme.accent1} transition-shadow duration-300` : ''} relative`}>
            <Button
                variant="ghost"
                size="sm"
                className="absolute top-2 right-2 z-10 p-1 rounded-md"
                title={`Zoom details for ${col.name}`}
                aria-label={`Zoom details for ${col.name}`}
                onClick={() => handleZoomColumnSummary(col)}
                style={{ 
                    color: RAW_COLOR_VALUES[theme.accent1],
                    backgroundColor: `${RAW_COLOR_VALUES[theme.darkGray]}99`
                }}
            >
                <ZoomIn size={16} />
            </Button>
            <div className="flex items-center mb-3">
               {col.type === 'numeric' && <Hash size={20} className="mr-2 opacity-80" style={{color: accent3Color}} />}
               {col.type === 'string' && <FileJson size={20} className="mr-2 opacity-80" style={{color: accent3Color}} />}
               {(col.type === 'boolean' || col.type === 'mixed' || col.type === 'empty') && <BarChartHorizontalBig size={20} className="mr-2 opacity-80" style={{color: accent3Color}} />}
              <h3 className="text-lg font-semibold truncate" style={{color: accent3Color}} title={col.name}>{col.name}</h3>
            </div>
            {renderColumnSummaryDetails(col, theme)}
          </div>
        ))}
      </div>
      
      {isSummaryZoomModalOpen && zoomedColumnSummary && (
        <Modal
            isOpen={isSummaryZoomModalOpen}
            onClose={() => { setIsSummaryZoomModalOpen(false); setZoomedColumnSummary(null);}}
            title={`Detailed Summary: ${zoomedColumnSummary.name}`}
            size="md"
        >
             <div className="flex items-center mb-3">
               {zoomedColumnSummary.type === 'numeric' && <Hash size={24} className="mr-2 opacity-80" style={{color: accent3Color}} />}
               {zoomedColumnSummary.type === 'string' && <FileJson size={24} className="mr-2 opacity-80" style={{color: accent3Color}} />}
               {(zoomedColumnSummary.type === 'boolean' || zoomedColumnSummary.type === 'mixed' || zoomedColumnSummary.type === 'empty') && <BarChartHorizontalBig size={24} className="mr-2 opacity-80" style={{color: accent3Color}} />}
              <h3 className="text-2xl font-semibold" style={{color: accent3Color}}>{zoomedColumnSummary.name}</h3>
            </div>
            {renderColumnSummaryDetails(zoomedColumnSummary, theme, true)}
        </Modal>
      )}

    </div>
  );
};

export default DataSummary;
