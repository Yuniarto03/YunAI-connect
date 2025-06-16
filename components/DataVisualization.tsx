import React, { useContext, useState, useMemo, useEffect } from 'react';
import { AppContext } from '../contexts/AppContext';
import { AppContextType, ProcessedData, DataRow, AggregationType, ChartConfig, AppChartType, Theme } from '../types';
import { ResponsiveContainer, ComposedChart, Bar, PieChart, Pie, Line, Area, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell, LabelList } from 'recharts';
import Button from './shared/Button';
import Modal from './shared/Modal';
import { AlertTriangle, Palette, Settings2, Trash2, PlusCircle, PlayCircle, Filter, ChevronDown, ChevronUp, ZoomIn, RotateCcw } from 'lucide-react';
import LoadingSpinner from './shared/LoadingSpinner';
import { RAW_COLOR_VALUES } from '../constants'; 
// Import NameType and ValueType for explicit payload typing
import { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent';
import { getSharedSelectBaseStyles } from '../utils'; // Import shared utility

// Helper for aggregation
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
    return { name, value: parseFloat(value.toFixed(2)) }; // Keep some precision for calculations, format on display
  });
};


const CHART_TYPES: AppChartType[] = ['bar', 'line', 'area', 'pie', 'donut', 'scatter']; 
const AGGREGATION_OPTIONS = Object.values(AggregationType);

const MAX_POINTS_FOR_HORIZONTAL_XLABELS = 12; 
const MAX_POINTS_FOR_ALL_HORIZONTAL_XTICKS = 8;
const MAX_POINTS_FOR_VALUE_LABELS_ON_LINES = 15;

const toProperCase = (str: string): string => {
  return str.replace(/_/g, ' ')
            .toLowerCase()
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
};

// Define the structure of individual items in the tooltip's payload array
interface PayloadItem {
  name?: NameType;
  value?: ValueType;
  color?: string;
  dataKey?: string;
  payload?: any; // The raw data entry for this item
}

// Define the props for the custom tooltip content component explicitly
interface CustomTooltipContentProps {
  active?: boolean;
  payload?: PayloadItem[];
  label?: string | number; // The X-axis label or name for this tooltip group
  config: ChartConfig;
  theme: Theme;
}


const CustomTooltipContent: React.FC<CustomTooltipContentProps> = ({ active, payload, label, config, theme }) => {
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
            Gap (Pri - Sec): {gapAbsolut.toFixed(0)}
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
                         ? primaryPayload.name // For pie/donut, label is the name of the slice
                         : `${config.xAxisKey}: ${label}`; // For others, it's X-Axis Key: Value

    return (
      <div 
        className="p-3 rounded-lg shadow-xl" 
        style={{ 
            backgroundColor: `${themeDarkGrayHex}E6`, // Dark gray with more opacity
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


const DataVisualization: React.FC = () => {
  const { theme, processedData, chartConfigs, setChartConfigs } = useContext(AppContext) as AppContextType;
  // Local state for UI interactions like loading, modals, expanded sections
  const [isLoading, setIsLoading] = useState(false); 
  const [expandedConfig, setExpandedConfig] = useState<Record<number, { secondaryAxis?: boolean, filters?: boolean }>>({});
  const [isZoomModalOpen, setIsZoomModalOpen] = useState(false);
  const [zoomedChartIndex, setZoomedChartIndex] = useState<number | null>(null);

  const data = processedData?.data || [];
  const headers = processedData?.headers || [];
  const numericHeaders = useMemo(() => headers.filter(h => data.length > 0 && data.every(row => typeof row[h] === 'number' || !isNaN(parseFloat(String(row[h]))))), [data, headers]);
  const categoricalHeaders = useMemo(() => headers.filter(h => !numericHeaders.includes(h) || data.some(row => typeof row[h] === 'string')), [data, headers, numericHeaders]);

  const themeTextColorHex = useMemo(() => RAW_COLOR_VALUES[theme.textColor.replace('text-', '')] || '#E0E0E0', [theme.textColor]);
  const themeMediumGrayHex = useMemo(() => RAW_COLOR_VALUES[theme.mediumGray] || '#333F58', [theme.mediumGray]);
  const themeDarkBgHex = useMemo(() => RAW_COLOR_VALUES[theme.darkBg] || '#0A0F1E', [theme.darkBg]);
  const themeAccent1Hex = useMemo(() => RAW_COLOR_VALUES[theme.accent1] || '#00D4FF', [theme.accent1]);

  const CHART_COLOR_PALETTE = useMemo(() => [
    RAW_COLOR_VALUES[theme.accent1] || '#00D4FF',
    RAW_COLOR_VALUES[theme.accent2] || '#8B5CF6',
    RAW_COLOR_VALUES[theme.accent3] || '#00FF88',
    RAW_COLOR_VALUES[theme.accent4] || '#FF6B35',
  ], [theme]);
  
  const addChartConfig = () => {
    const defaultX = categoricalHeaders.length > 0 ? categoricalHeaders[0] : (headers.length > 0 ? headers[0] : '');
    const defaultY = numericHeaders.length > 0 ? numericHeaders[0] : (headers.length > 1 ? headers[1] : (headers.length > 0 ? headers[0] : ''));
    
    if (!defaultX || !defaultY) {
        alert("Not enough data columns to create a new chart. Please load data with at least one column.");
        return;
    }

    setChartConfigs(prev => [...prev, {
      chartType: 'bar',
      xAxisKey: defaultX,
      yAxisKey: defaultY,
      yAxisAggregation: AggregationType.SUM,
      color: CHART_COLOR_PALETTE[prev.length % CHART_COLOR_PALETTE.length], 
      isGenerated: false,
      secondaryYAxisKey: undefined,
      secondaryYAxisChartType: 'line',
      secondaryYAxisAggregation: AggregationType.SUM,
      secondaryYAxisColor: CHART_COLOR_PALETTE[(prev.length + 2) % CHART_COLOR_PALETTE.length], 
      filter1Header: undefined, filter1Value: undefined, filter1SubHeader: undefined, filter1SubValue: undefined,
      filter2Header: undefined, filter2Value: undefined, filter2SubHeader: undefined, filter2SubValue: undefined,
    }]);
  };

  const updateChartConfig = (index: number, newConfig: Partial<ChartConfig>) => {
    setChartConfigs(prev => prev.map((c, i) => {
      if (i === index) {
        const updatedConfig = { ...c, ...newConfig };
        if (newConfig.isGenerated === undefined && 
            (newConfig.chartType || newConfig.xAxisKey || newConfig.yAxisKey || newConfig.yAxisAggregation ||
             newConfig.secondaryYAxisKey || newConfig.secondaryYAxisChartType || newConfig.secondaryYAxisAggregation ||
             newConfig.filter1Header || newConfig.filter1Value || newConfig.filter1SubHeader || newConfig.filter1SubValue ||
             newConfig.filter2Header || newConfig.filter2Value || newConfig.filter2SubHeader || newConfig.filter2SubValue
            )) {
           updatedConfig.isGenerated = false;
        }
        return updatedConfig;
      }
      return c;
    }));
  };

  const removeChartConfig = (index: number) => {
    setChartConfigs(prev => prev.filter((_, i) => i !== index));
    setExpandedConfig(prev => {
      const {[index]: _, ...rest} = prev;
      return rest;
    })
  };

  const handleGenerateChart = (index: number) => {
    setChartConfigs(prev => prev.map((c, i) => i === index ? { ...c, isGenerated: true } : c));
  };
  
  const toggleConfigSection = (index: number, section: 'secondaryAxis' | 'filters') => {
    setExpandedConfig(prev => ({
        ...prev,
        [index]: {
            ...prev[index],
            [section]: !prev[index]?.[section]
        }
    }));
  };

  const getFilterValueOptions = (config: ChartConfig, filterNum: 1 | 2, isSub: boolean) => {
    const headerKey = isSub ? (filterNum === 1 ? config.filter1SubHeader : config.filter2SubHeader) : (filterNum === 1 ? config.filter1Header : config.filter2Header);
    if (!headerKey || !processedData?.data) return [];

    let sourceData = processedData.data;
    if (isSub) { 
        const mainHeader = filterNum === 1 ? config.filter1Header : config.filter2Header;
        const mainValue = filterNum === 1 ? config.filter1Value : config.filter2Value;
        if (mainHeader && mainValue) {
            sourceData = sourceData.filter(row => String(row[mainHeader]) === mainValue);
        } else { return []; }
    }
    return [...new Set(sourceData.map(row => String(row[headerKey!])).sort())];
  };
  
  const getSubFilterHeaderOptions = (config: ChartConfig, filterNum: 1 | 2) => {
    const mainHeaderKey = filterNum === 1 ? config.filter1Header : config.filter2Header;
    return headers.filter(h => h !== mainHeaderKey);
  };


  const renderChart = (config: ChartConfig, index: number, isZoomed: boolean = false) => {
    if (!config.isGenerated && !isZoomed) { 
      return (
        <div className={`flex flex-col items-center justify-center h-full opacity-70`} style={{color: themeTextColorHex}}>
          <Palette size={48} className={`mb-4`} style={{color: RAW_COLOR_VALUES[theme.accent3]}} />
          <p>Chart not generated.</p>
          <p className="text-sm">Configure options and click "Generate Chart".</p>
        </div>
      );
    }
    
    if (!config.xAxisKey || !config.yAxisKey) {
        return <p className={`text-sm opacity-70 p-4 text-center`} style={{color: themeTextColorHex}}>Please select X and Y axes, then click "Generate Chart".</p>;
    }

    let currentData = [...data];
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
      return <p className={`text-sm opacity-70 p-4 text-center`} style={{color: themeTextColorHex}}>No data to display after filtering and aggregation.</p>;
    }

    const commonProps = {
      data: mergedChartData,
      margin: { top: 20, right: 30, left: 20, bottom: isZoomed ? 70 : 60 },
    };

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
      height: isZoomed ? 80 : 70, 
      interval: xAxisInterval,
      tick: { fontSize: isZoomed ? 11 : 10, dy: horizontalXLabels ? 5 : 0, fill: themeTextColorHex },
    };

    const yAxisPropsPrimary = {
      stroke: themeMediumGrayHex,
      tick: { fontSize: isZoomed ? 11 : 10, fill: themeTextColorHex }
    };
    const yAxisPropsSecondary = {
      yAxisId: "right", orientation: "right" as const,
      stroke: config.secondaryYAxisColor || RAW_COLOR_VALUES[theme.accent4] || '#FF6B35',
      tick: { fontSize: isZoomed ? 11 : 10, fill: themeTextColorHex }
    };

    const tooltipElement = <Tooltip content={<CustomTooltipContent config={config} theme={theme} />} wrapperStyle={{ zIndex: 1500 }} cursor={{ stroke: themeAccent1Hex, strokeDasharray: '3 3'}} />;

    // Define colors for stroke and distinct fill
    const primaryStrokeColor = config.color;
    const primaryDistinctFillBaseColor = CHART_COLOR_PALETTE.find(c => c !== primaryStrokeColor) || CHART_COLOR_PALETTE[1] || RAW_COLOR_VALUES[theme.accent2];
    
    const secondaryStrokeColor = config.secondaryYAxisColor || CHART_COLOR_PALETTE[3] || RAW_COLOR_VALUES[theme.accent4];
    const secondaryDistinctFillBaseColor = CHART_COLOR_PALETTE.find(c => c !== secondaryStrokeColor && c !== primaryStrokeColor && c !== primaryDistinctFillBaseColor) || CHART_COLOR_PALETTE[0] || RAW_COLOR_VALUES[theme.accent1];

    const valueLabelFormatter = (value: number | string) => {
        const num = Number(value);
        if (isNaN(num)) return value; 
        return num % 1 === 0 ? num.toString() : num.toFixed(1);
    };
    
    const showValueLabels = mergedChartData.length <= MAX_POINTS_FOR_VALUE_LABELS_ON_LINES;

    // Define new stroke widths
    const primaryLineStrokeWidth = config.secondaryYAxisKey ? 4 : 5; 
    const primaryAreaStrokeWidthNew = config.secondaryYAxisKey ? 5 : 6;
    const primaryBarStrokeWidthNew = 3;

    const secondaryLineStrokeWidth = 3; 
    const secondaryAreaStrokeWidthNew = 4;
    const secondaryBarStrokeWidthNew = 2.5;


    if (config.chartType === 'pie' || config.chartType === 'donut') {
        return (
          <PieChart width={isZoomed ? 600 : 400} height={isZoomed ? 600 : 400}> 
            {tooltipElement}
            <Legend wrapperStyle={{ color: themeTextColorHex, fontSize: isZoomed ? '13px' : '12px'}} layout="vertical" verticalAlign="middle" align="right" />
            <Pie data={primaryAggregatedData} dataKey="value" nameKey="name" cx="50%" cy="50%" 
                 outerRadius={config.chartType === 'donut' ? (isZoomed ? 180 : 120) : (isZoomed ? 220 : 150)} 
                 innerRadius={config.chartType === 'donut' ? (isZoomed ? 100 : 70) : 0} 
                 fill={config.color} 
                 labelLine={false}
                 label={({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
                    const RADIAN = Math.PI / 180;
                    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                    const x = cx + radius * Math.cos(-midAngle * RADIAN);
                    const y = cy + radius * Math.sin(-midAngle * RADIAN);
                    return ( (percent*100) > 5 && <text x={x} y={y} fill={themeTextColorHex} textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize={isZoomed ? "12px" : "10px"}>
                        {`${(percent * 100).toFixed(0)}%`}
                    </text>);
                 }}
            >
              {primaryAggregatedData.map((entry, entryIndex) => {
                const cellColor = CHART_COLOR_PALETTE[entryIndex % CHART_COLOR_PALETTE.length];
                return (
                    <Cell key={`cell-${entryIndex}`} fill={cellColor} 
                          style={{ filter: `drop-shadow(0 0 4px ${cellColor})`, transition: 'opacity 0.3s ease' }}
                          onMouseOver={(e) => e.currentTarget.style.opacity = '0.7'}
                          onMouseOut={(e) => e.currentTarget.style.opacity = '1'}
                    />
                );
              })}
            </Pie>
          </PieChart>
        );
    }
    
    if (config.chartType === 'scatter') {
        const scatterPlotData = currentData.map(row => ({
            x: parseFloat(String(row[config.xAxisKey])), 
            y: parseFloat(String(row[config.yAxisKey])),
            ...(config.secondaryYAxisKey && { y2: parseFloat(String(row[config.secondaryYAxisKey])) })
        })).filter(p => !isNaN(p.x) && !isNaN(p.y) && (config.secondaryYAxisKey ? !isNaN(p.y2!) : true));

        if (scatterPlotData.length === 0) {
            return <p className="p-4 text-center" style={{color: themeTextColorHex}}>No valid numeric X/Y data points for scatter plot after filtering.</p>
        }
        return (
          <ComposedChart {...commonProps} data={scatterPlotData}>
            <CartesianGrid strokeDasharray="3 3" stroke={themeMediumGrayHex} />
            <XAxis type="number" dataKey="x" name={config.xAxisKey} {...xAxisComputedProps} />
            <YAxis {...yAxisPropsPrimary} name={config.yAxisKey} dataKey="y"/>
            {config.secondaryYAxisKey && <YAxis {...yAxisPropsSecondary} name={config.secondaryYAxisKey} dataKey="y2" />}
            {tooltipElement}
            <Legend wrapperStyle={{ color: themeTextColorHex, fontSize: isZoomed ? '13px' : '12px'}}/>
            <Scatter name={config.yAxisKey} dataKey="y" fill={config.color} shape="star" style={{ filter: `drop-shadow(0 0 3px ${config.color})` }} />
            {config.secondaryYAxisKey && <Scatter name={config.secondaryYAxisKey} dataKey="y2" yAxisId="right" fill={secondaryStrokeColor} shape="circle" style={{ filter: `drop-shadow(0 0 3px ${secondaryStrokeColor})` }} />}
          </ComposedChart>
        );
    }
    
    return (
      <ComposedChart {...commonProps}>
        <defs>
          {/* Gradient for Primary Area (uses distinct fill base color) */}
          <linearGradient id={`gradient-primary-${index}${isZoomed ? '-zoomed' : ''}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={primaryDistinctFillBaseColor} stopOpacity={0.8}/> {/* Opacity within gradient */}
            <stop offset="95%" stopColor={primaryDistinctFillBaseColor} stopOpacity={0.2}/>
          </linearGradient>
          {/* Gradient for Secondary Area (uses distinct fill base color) */}
           <linearGradient id={`gradient-secondary-${index}${isZoomed ? '-zoomed' : ''}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={secondaryDistinctFillBaseColor} stopOpacity={0.7}/>
            <stop offset="95%" stopColor={secondaryDistinctFillBaseColor} stopOpacity={0.1}/>
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={themeMediumGrayHex} />
        <XAxis {...xAxisComputedProps} />
        <YAxis {...yAxisPropsPrimary} />
        {config.secondaryYAxisKey && <YAxis {...yAxisPropsSecondary} />}
        {tooltipElement}
        <Legend wrapperStyle={{ color: themeTextColorHex, fontSize: isZoomed ? '13px' : '12px'}}/>
        
        {/* Primary Y-Axis Elements */}
        {config.chartType === 'bar' && 
            <Bar dataKey="primaryValue" name={config.yAxisKey} 
                 fill={primaryDistinctFillBaseColor} fillOpacity={0.3} 
                 stroke={primaryStrokeColor} strokeWidth={primaryBarStrokeWidthNew}
                 radius={[5, 5, 0, 0]} barSize={isZoomed ? 40 : 30}>
                {showValueLabels && <LabelList dataKey="primaryValue" position="top" style={{ fill: themeTextColorHex, fontSize: isZoomed ? '11px':'10px' }} formatter={valueLabelFormatter} />}
            </Bar>}
        {config.chartType === 'line' && 
          <Line type="monotone" dataKey="primaryValue" name={config.yAxisKey} stroke={primaryStrokeColor} strokeWidth={primaryLineStrokeWidth} 
                dot={{ r: 5, fill: primaryStrokeColor, stroke: themeDarkBgHex, strokeWidth: 2, style: { filter: `drop-shadow(0 0 4px ${primaryStrokeColor})` } }} 
                activeDot={{ r: 8, fill: primaryStrokeColor, stroke: themeDarkBgHex, strokeWidth: 2, style: { filter: `drop-shadow(0 0 6px ${primaryStrokeColor})` } }}>
            {showValueLabels && <LabelList dataKey="primaryValue" position="top" style={{ fill: themeTextColorHex, fontSize: isZoomed ? '10px' : '9px' }} formatter={valueLabelFormatter} />}
          </Line>}
        {config.chartType === 'area' && 
          <Area type="monotone" dataKey="primaryValue" name={config.yAxisKey} 
                stroke={primaryStrokeColor} strokeWidth={primaryAreaStrokeWidthNew}
                fill={`url(#gradient-primary-${index}${isZoomed ? '-zoomed' : ''})`} fillOpacity={0.3} 
                dot={{ r: 5, fill: primaryStrokeColor, stroke: themeDarkBgHex, strokeWidth: 2, style: { filter: `drop-shadow(0 0 4px ${primaryStrokeColor})` } }} 
                activeDot={{ r: 8, fill: primaryStrokeColor, stroke: themeDarkBgHex, strokeWidth: 2, style: { filter: `drop-shadow(0 0 6px ${primaryStrokeColor})` } }}>
            {showValueLabels && <LabelList dataKey="primaryValue" position="top" offset={8} style={{ fill: themeTextColorHex, fontSize: isZoomed ? '10px' : '9px' }} formatter={valueLabelFormatter} />}
          </Area>}

        {/* Secondary Y-Axis Elements */}
        {config.secondaryYAxisKey && config.secondaryYAxisChartType === 'bar' && 
            <Bar yAxisId="right" dataKey="secondaryValue" name={config.secondaryYAxisKey} 
                 fill={secondaryDistinctFillBaseColor} fillOpacity={0.3} 
                 stroke={secondaryStrokeColor} strokeWidth={secondaryBarStrokeWidthNew}
                 radius={[5, 5, 0, 0]} barSize={isZoomed ? 30 :20}>
                {showValueLabels && <LabelList dataKey="secondaryValue" position="top" style={{ fill: themeTextColorHex, fontSize: isZoomed ? '10px' : '9px' }} formatter={valueLabelFormatter} />}
            </Bar>}
        {config.secondaryYAxisKey && config.secondaryYAxisChartType === 'line' && 
          <Line yAxisId="right" type="monotone" dataKey="secondaryValue" name={config.secondaryYAxisKey} stroke={secondaryStrokeColor} strokeWidth={secondaryLineStrokeWidth} 
                dot={{ r: 4, fill: secondaryStrokeColor, stroke: themeDarkBgHex, strokeWidth: 2, style: { filter: `drop-shadow(0 0 3px ${secondaryStrokeColor})` } }} 
                activeDot={{ r: 7, fill: secondaryStrokeColor, stroke: themeDarkBgHex, strokeWidth: 2, style: { filter: `drop-shadow(0 0 5px ${secondaryStrokeColor})` } }}>
             {showValueLabels && <LabelList dataKey="secondaryValue" position="top" style={{ fill: themeTextColorHex, fontSize: isZoomed ? '10px' : '9px' }} formatter={valueLabelFormatter} />}
          </Line>}
        {config.secondaryYAxisKey && config.secondaryYAxisChartType === 'area' && 
          <Area yAxisId="right" type="monotone" dataKey="secondaryValue" name={config.secondaryYAxisKey} 
                stroke={secondaryStrokeColor} strokeWidth={secondaryAreaStrokeWidthNew} 
                fill={`url(#gradient-secondary-${index}${isZoomed ? '-zoomed' : ''})`} fillOpacity={0.3}
                dot={{ r: 4, fill: secondaryStrokeColor, stroke: themeDarkBgHex, strokeWidth: 2, style: { filter: `drop-shadow(0 0 3px ${secondaryStrokeColor})` } }}
                activeDot={{ r: 7, fill: secondaryStrokeColor, stroke: themeDarkBgHex, strokeWidth: 2, style: { filter: `drop-shadow(0 0 5px ${secondaryStrokeColor})` } }}>
            {showValueLabels && <LabelList dataKey="secondaryValue" position="top" offset={8} style={{ fill: themeTextColorHex, fontSize: isZoomed ? '10px' : '9px' }} formatter={valueLabelFormatter} />}
          </Area>}
      </ComposedChart>
    );
  };

  if (!processedData) {
    return (
      <div className={`p-8 flex flex-col items-center justify-center h-full`} style={{color: themeTextColorHex}}>
        <AlertTriangle size={48} className={`mb-4`} style={{color: RAW_COLOR_VALUES[theme.accent4]}} />
        <h2 className="text-2xl font-semibold">No Data Loaded</h2>
        <p className="opacity-70">Please import a file to visualize its data.</p>
      </div>
    );
  }
  
  if (data.length === 0 || headers.length === 0) {
     return (
      <div className={`p-8 flex flex-col items-center justify-center h-full`} style={{color: themeTextColorHex}}>
        <AlertTriangle size={48} className={`mb-4`} style={{color: RAW_COLOR_VALUES[theme.accent4]}} />
        <h2 className="text-2xl font-semibold">Empty Data Set</h2>
        <p className="opacity-70">The loaded file contains no data or headers.</p>
      </div>
    );
  }

  const selectStyles = getSharedSelectBaseStyles(theme); 

  const renderSelect = (label: string, value: string | undefined, onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void, options: {key: string, value: string, display: string}[], disabled?: boolean, emptyOptionLabel: string = `Select ${label}`) => (
    <div>
        <label className="block text-xs font-medium opacity-80 mb-1" style={{color: themeTextColorHex}}>{label}</label>
        <select 
            value={value || ''} 
            onChange={onChange} 
            disabled={disabled}
            className={`${selectStyles.baseClassName} w-full px-2 py-1.5`}
            style={selectStyles.style}
        >
            <option value="" disabled={value !== undefined} style={selectStyles.optionStyle}>{emptyOptionLabel}</option>
            {options.map(opt => <option key={opt.key} value={opt.value} style={selectStyles.optionStyle}>{opt.display}</option>)}
        </select>
    </div>
  );
  
  const handleZoomChart = (index: number) => {
    setZoomedChartIndex(index);
    setIsZoomModalOpen(true);
  };

  return (
    <div className={`p-4 md:p-8 h-full flex flex-col futuristic-scrollbar overflow-y-auto`} style={{color: themeTextColorHex}}>
      <div className="flex justify-between items-center mb-8">
        <h1 className={`text-3xl md:text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-${theme.accent1} to-${theme.accent2}`}>Data Visualization</h1>
        <Button onClick={addChartConfig} variant="primary" leftIcon={<PlusCircle size={18}/>}>Add Chart</Button>
      </div>

      {isLoading && <LoadingSpinner text="Generating charts..." />}

      {chartConfigs.length === 0 && !isLoading && (
        <div className={`${theme.cardBg} p-6 rounded-xl shadow-lg border ${theme.borderColor} text-center`}>
          <Palette size={48} className={`mx-auto mb-4`} style={{color: RAW_COLOR_VALUES[theme.accent3]}} />
          <p className="text-lg">No charts configured yet.</p>
          <p className="text-sm opacity-70">Click "Add Chart" to start visualizing your data.</p>
        </div>
      )}

      <div className="space-y-8">
        {chartConfigs.map((config, index) => (
          <div key={index} className={`${theme.cardBg} p-4 rounded-xl shadow-2xl border ${theme.borderColor} border-opacity-50 flex flex-col`}>
            <div className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-3 p-3 border-b ${theme.borderColor}`}>
                {renderSelect("Chart Type", config.chartType, (e) => updateChartConfig(index, { chartType: e.target.value as AppChartType }), CHART_TYPES.map(type => ({key: type, value: type, display: type.charAt(0).toUpperCase() + type.slice(1)})))}
                {renderSelect("X-Axis (Group By)", config.xAxisKey, (e) => updateChartConfig(index, { xAxisKey: e.target.value }), categoricalHeaders.concat(numericHeaders.filter(h => !categoricalHeaders.includes(h))).map(h => ({key: String(h), value: String(h), display: String(h)})))}
                {renderSelect("Y-Axis (Value)", config.yAxisKey, (e) => updateChartConfig(index, { yAxisKey: e.target.value }), headers.map(h => ({key: String(h), value: String(h), display: String(h)})))}
                {renderSelect("Aggregation", config.yAxisAggregation, (e) => updateChartConfig(index, { yAxisAggregation: e.target.value as AggregationType }), AGGREGATION_OPTIONS.map(agg => ({key:agg, value:agg, display:toProperCase(agg)})))}
            </div>

            {/* Secondary Y-Axis Options - Re-enabled */}
            <details className="mb-3 group" open={expandedConfig[index]?.secondaryAxis}>
                <summary className={`flex justify-between items-center p-2 cursor-pointer rounded hover:bg-${theme.mediumGray}/30 transition-colors`} onClick={(e) => { e.preventDefault(); toggleConfigSection(index, 'secondaryAxis');}}>
                    <h4 className={`text-sm font-semibold`} style={{color: RAW_COLOR_VALUES[theme.accent2]}}>Secondary Y-Axis Options</h4>
                    {expandedConfig[index]?.secondaryAxis ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </summary>
                <div className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mt-2 p-3 border rounded ${theme.borderColor}`}>
                    {renderSelect("Sec. Y-Axis Key", config.secondaryYAxisKey, (e) => updateChartConfig(index, { secondaryYAxisKey: e.target.value }), headers.map(h => ({key:String(h), value:String(h), display:String(h)})), false, "None")}
                    {renderSelect("Sec. Chart Type", config.secondaryYAxisChartType, (e) => updateChartConfig(index, { secondaryYAxisChartType: e.target.value as AppChartType }), ['line', 'bar', 'area'].map(type => ({key: type, value: type, display: type.charAt(0).toUpperCase() + type.slice(1)})), !config.secondaryYAxisKey, "Sec. Chart Type")}
                    {renderSelect("Sec. Aggregation", config.secondaryYAxisAggregation, (e) => updateChartConfig(index, { secondaryYAxisAggregation: e.target.value as AggregationType }), AGGREGATION_OPTIONS.map(agg => ({key:agg, value:agg, display:toProperCase(agg)})), !config.secondaryYAxisKey, "Sec. Aggregation")}
                </div>
            </details>
            
            <details className="mb-3 group" open={expandedConfig[index]?.filters}>
                <summary className={`flex justify-between items-center p-2 cursor-pointer rounded hover:bg-${theme.mediumGray}/30 transition-colors`} onClick={(e) => { e.preventDefault(); toggleConfigSection(index, 'filters');}}>
                    <h4 className={`text-sm font-semibold`} style={{color: RAW_COLOR_VALUES[theme.accent3]}}>Data Filters</h4>
                     {expandedConfig[index]?.filters ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </summary>
                <div className={`mt-2 p-3 border rounded ${theme.borderColor} space-y-4 max-h-72 overflow-y-auto futuristic-scrollbar`}>
                    {[1, 2].map(pairNum => (
                        <div key={`filter-pair-${pairNum}`} className={`p-2 border rounded ${theme.borderColor} border-opacity-50`}>
                            <p className={`text-xs font-semibold mb-2`} style={{color: RAW_COLOR_VALUES[theme.accent4]}}>Filter Pair {pairNum}</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {renderSelect(`P${pairNum} Header`, config[`filter${pairNum}Header` as keyof ChartConfig] as string, (e) => updateChartConfig(index, { [`filter${pairNum}Header`]: e.target.value, [`filter${pairNum}Value`]: undefined, [`filter${pairNum}SubHeader`]: undefined, [`filter${pairNum}SubValue`]: undefined }), headers.map(h => ({key:String(h),value:String(h),display:String(h)})), false, "None")}
                                {renderSelect(`P${pairNum} Value`, config[`filter${pairNum}Value` as keyof ChartConfig] as string, (e) => updateChartConfig(index, { [`filter${pairNum}Value`]: e.target.value, [`filter${pairNum}SubValue`]: undefined }), getFilterValueOptions(config, pairNum as 1|2, false).map(v => ({key:String(v),value:String(v),display:String(v)})), !config[`filter${pairNum}Header` as keyof ChartConfig], "Select Value")}
                                {renderSelect(`P${pairNum} Sub-Header`, config[`filter${pairNum}SubHeader` as keyof ChartConfig] as string, (e) => updateChartConfig(index, { [`filter${pairNum}SubHeader`]: e.target.value, [`filter${pairNum}SubValue`]: undefined }), getSubFilterHeaderOptions(config, pairNum as 1|2).map(h => ({key:String(h),value:String(h),display:String(h)})), !config[`filter${pairNum}Header` as keyof ChartConfig] || !config[`filter${pairNum}Value` as keyof ChartConfig], "None")}
                                {renderSelect(`P${pairNum} Sub-Value`, config[`filter${pairNum}SubValue` as keyof ChartConfig] as string, (e) => updateChartConfig(index, { [`filter${pairNum}SubValue`]: e.target.value }), getFilterValueOptions(config, pairNum as 1|2, true).map(v => ({key:String(v),value:String(v),display:String(v)})), !config[`filter${pairNum}SubHeader` as keyof ChartConfig], "Select Sub-Value")}
                            </div>
                        </div>
                    ))}
                </div>
            </details>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-2 mt-2">
              <Button onClick={() => handleGenerateChart(index)} variant="primary" size="sm" className="flex-1 w-full" leftIcon={<PlayCircle size={16}/>}>Generate Chart</Button>
              {config.isGenerated && (
                <Button onClick={() => updateChartConfig(index, { isGenerated: false })} variant="secondary" size="sm" className="flex-1 w-full" leftIcon={<RotateCcw size={16}/>}>Reset Chart</Button>
              )}
              <Button onClick={() => removeChartConfig(index)} variant="danger" size="sm" className="flex-1 w-full" leftIcon={<Trash2 size={16}/>}>Remove</Button>
            </div>
            
            <div className="flex-grow h-80 md:h-96 w-full relative mt-4">
              {config.isGenerated && (
                <Button
                    onClick={() => handleZoomChart(index)}
                    variant="ghost"
                    size="sm"
                    className="absolute top-2 right-2 z-20 p-1.5 rounded-md"
                    title="Zoom Chart"
                    aria-label="Zoom Chart"
                    style={{ 
                        backgroundColor: `${RAW_COLOR_VALUES[theme.cardBg]}B3`, 
                        borderColor: `${RAW_COLOR_VALUES[theme.mediumGray]}`,
                        color: RAW_COLOR_VALUES[theme.textColor.replace('text-','')] || themeTextColorHex
                    }}
                >
                    <ZoomIn size={18} />
                </Button>
              )}
              <ResponsiveContainer width="100%" height="100%">
                {renderChart(config, index)}
              </ResponsiveContainer>
                 {config.isGenerated && config.color && (
                     <div className="absolute inset-0 border-2 border-transparent rounded-lg pointer-events-none"
                         style={{
                             boxShadow: `0 0 20px ${config.color}, inset 0 0 15px ${config.color}33`, 
                             animation: `pulseBorderMain-${index} 3s infinite ease-in-out alternate`
                         }}>
                    </div>
                 )}
                 {config.isGenerated && config.color && (
                    <style>{`
                        @keyframes pulseBorderMain-${index} {
                            0% { box-shadow: 0 0 10px ${config.color}55, inset 0 0 10px ${config.color}22; }
                            100% { box-shadow: 0 0 25px ${config.color}aa, inset 0 0 20px ${config.color}44; }
                        }
                    `}</style>
                 )}
            </div>
          </div>
        ))}
      </div>
      
      {isZoomModalOpen && zoomedChartIndex !== null && chartConfigs[zoomedChartIndex] && (
        <Modal
          isOpen={isZoomModalOpen}
          onClose={() => { setIsZoomModalOpen(false); setZoomedChartIndex(null); }}
          title={`Zoomed Chart: ${toProperCase(chartConfigs[zoomedChartIndex].chartType)} - ${chartConfigs[zoomedChartIndex].yAxisKey}`}
          size="full"
        >
            <div className="w-full h-full"> {/* Ensure inner div takes full modal content space */}
                <ResponsiveContainer width="100%" height="100%">
                    {renderChart(chartConfigs[zoomedChartIndex], zoomedChartIndex, true)}
                </ResponsiveContainer>
            </div>
        </Modal>
      )}
    </div>
  );
};

export default DataVisualization;
