
import React, { useState, useEffect, useCallback, useContext, useRef } from 'react';
import { useDropzone, FileWithPath } from 'react-dropzone';
import * as XLSX from 'xlsx';
import { AppContext } from '../contexts/AppContext';
import { AppContextType, Milestone, MilestoneOutputType, DataRow, Theme } from '../types';
import Button from './shared/Button';
import Input from './shared/Input';
import LoadingSpinner from './shared/LoadingSpinner';
// Modal import removed as detail modal is removed
import { analyzeDocumentWithGemini } from '../services/geminiService';
import { ListChecks, CalendarRange, Heading1, Baseline, Hash, UploadCloud, Download as DownloadIcon, Clock, Send, Edit3, Trash2, AlertTriangle, CheckCircle, ExternalLink, Flag, PlusCircle, ChevronDown, ChevronUp, Maximize2, Minimize2, Settings2, Info, EyeIcon, PackagePlus, GripVertical, X, Circle, Trash } from 'lucide-react';
import { RAW_COLOR_VALUES } from '../constants';
import MilestoneNode, { MILESTONE_CATEGORIES as DefaultMilestoneCategories, MilestoneCategoryKey as DefaultMilestoneCategoryKey } from './MilestoneNode';
import { getSharedSelectBaseStyles } from '../utils';

const categoryKeys = Object.keys(DefaultMilestoneCategories) as DefaultMilestoneCategoryKey[];

const TIMELINE_NODE_WIDTH = 160; 
const TIMELINE_NODE_SPACING = 80; 
const TIMELINE_VERTICAL_OFFSET = 100; 

const formatDateDiff = (days: number): string => {
  if (days === 0) return "Today";
  if (days === 1) return "1 day";
  if (days === -1) return "-1 day (overdue)";
  if (days > 0) return `${days} days`;
  return `${Math.abs(days)} days (overdue)`;
};


const MilestonePlanner: React.FC = () => {
  const { theme, reduceMotion } = useContext(AppContext) as AppContextType;

  const [manualMilestones, setManualMilestones] = useState<Milestone[]>([]);
  const [uploadedFile, setUploadedFile] = useState<FileWithPath | null>(null);
  const [uploadedDataHeaders, setUploadedDataHeaders] = useState<string[]>([]);
  const [uploadedDataRows, setUploadedDataRows] = useState<DataRow[]>([]);
  
  const [fieldMappings, setFieldMappings] = useState<{ date?: string; title?: string; description?: string; value?: string; category?: string; }>({});
  
  const [combinedMilestones, setCombinedMilestones] = useState<Milestone[]>([]);
  const [manualFormState, setManualFormState] = useState<Partial<Omit<Milestone, 'id' | 'source'>>>({ date: '', title: '', description: '', value: '', category: 'GENERAL' });
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [selectedExportType, setSelectedExportType] = useState<MilestoneOutputType>('csv');
  const [draggedHeader, setDraggedHeader] = useState<string | null>(null);
  
  const [isConfigSectionOpen, setIsConfigSectionOpen] = useState(true);
  const [isIndividualManagementSectionOpen, setIsIndividualManagementSectionOpen] = useState(false);
  const timelineContainerRef = useRef<HTMLDivElement>(null);

  const [projectStartDate, setProjectStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [targetFinishDate, setTargetFinishDate] = useState<string>('');
  const [editingMilestone, setEditingMilestone] = useState<Milestone | null>(null);
  const [editFormState, setEditFormState] = useState<Partial<Milestone>>({});
  
  const [totalProjectDuration, setTotalProjectDuration] = useState<string | null>(null);
  const [remainingDaysToTarget, setRemainingDaysToTarget] = useState<string | null>(null);
  const [gapWithLastMilestone, setGapWithLastMilestone] = useState<string | null>(null);

  const [isTimelineMaximized, setIsTimelineMaximized] = useState(false);

  // Detail Modal State removed

  const timelineAxisColorStart = RAW_COLOR_VALUES[theme.accent1] || "#00D4FF";
  const timelineAxisColorEnd = RAW_COLOR_VALUES[theme.accent2] || "#8B5CF6";
  const timelineNodeColorCycle = [
    RAW_COLOR_VALUES[theme.accent3] || "#00FF88",
    RAW_COLOR_VALUES[theme.accent4] || "#FF6B35",
    RAW_COLOR_VALUES[theme.accent1] || "#00D4FF",
    RAW_COLOR_VALUES['pink-500'] || "#EC4899",
    RAW_COLOR_VALUES['cyan-400'] || "#22D3EE",
    RAW_COLOR_VALUES['lime-500'] || "#84CC16",
  ];

  const calculateDurations = useCallback((milestones: Milestone[], startDate: string): Milestone[] => {
    const sortedMilestones = [...milestones].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    return sortedMilestones.map((m, index) => {
      let durationFromPrevious: string | undefined;
      let durationFromStart: string | undefined;
      try {
        const currentDate = new Date(m.date);
        if (isNaN(currentDate.getTime())) throw new Error('Invalid milestone date');
        if (index > 0) {
          const prevDate = new Date(sortedMilestones[index - 1].date);
          if (isNaN(prevDate.getTime())) throw new Error('Invalid previous milestone date');
          const diffTime = Math.abs(currentDate.getTime() - prevDate.getTime());
          durationFromPrevious = `${Math.ceil(diffTime / (1000 * 60 * 60 * 24))} day(s)`;
        }
        if (startDate) {
          const projStartDate = new Date(startDate);
          if (isNaN(projStartDate.getTime())) throw new Error('Invalid project start date');
          const diffTime = currentDate.getTime() - projStartDate.getTime(); 
          durationFromStart = `${Math.ceil(diffTime / (1000 * 60 * 60 * 24))} day(s)`;
        }
      } catch(e: any) { console.warn(`Error calculating duration for milestone "${m.title}": ${e.message}`); }
      return { ...m, durationFromPrevious, durationFromStart };
    });
  }, []);

  useEffect(() => {
    let mappedMilestones: Milestone[] = [];
    if (uploadedDataRows.length > 0 && fieldMappings.date && fieldMappings.title) {
      mappedMilestones = uploadedDataRows.map((row, index) => {
        const dateValue = fieldMappings.date ? String(row[fieldMappings.date]) : '';
        let formattedDate = '';
        if (dateValue) {
            try {
                let d;
                if (/^\d{5}$/.test(dateValue)) { 
                     const excelEpoch = new Date(1899, 11, 30);
                     d = new Date(excelEpoch.getTime() + parseInt(dateValue, 10) * 24 * 60 * 60 * 1000);
                } else { d = new Date(dateValue); }
                if (d && !isNaN(d.getTime())) { formattedDate = d.toISOString().split('T')[0]; }
                 else { formattedDate = ''; console.warn(`Invalid date value for row ${index}: ${dateValue}`) } 
            } catch (e) { formattedDate = ''; console.warn(`Error parsing date for row ${index}: ${dateValue}`, e) }
        }
        return {
          id: `uploaded-${index}-${Date.now()}`, date: formattedDate,
          title: fieldMappings.title ? String(row[fieldMappings.title]) : 'Untitled',
          description: fieldMappings.description ? String(row[fieldMappings.description]) : undefined,
          value: fieldMappings.value ? String(row[fieldMappings.value]) : undefined,
          category: (fieldMappings.category ? String(row[fieldMappings.category]).toUpperCase() as DefaultMilestoneCategoryKey : 'GENERAL'),
          source: 'uploaded' as 'uploaded',
        };
      }).filter(m => m.date && m.title); 
    }
    const allMilestones = [...manualMilestones, ...mappedMilestones].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const milestonesWithDurations = calculateDurations(allMilestones, projectStartDate);
    setCombinedMilestones(milestonesWithDurations);

    const today = new Date(); today.setHours(0,0,0,0);
    if (targetFinishDate) {
        const targetDate = new Date(targetFinishDate);
        if (!isNaN(targetDate.getTime())) {
            const diffTime = targetDate.getTime() - today.getTime();
            setRemainingDaysToTarget(formatDateDiff(Math.ceil(diffTime / (1000 * 60 * 60 * 24))));
        } else { setRemainingDaysToTarget(null); }
    } else { setRemainingDaysToTarget(null); }

    if (milestonesWithDurations.length > 0) {
        const sortedForTotal = [...milestonesWithDurations].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        const firstDateForCalc = projectStartDate ? new Date(projectStartDate) : new Date(sortedForTotal[0].date);
        const lastMilestoneDate = new Date(sortedForTotal[sortedForTotal.length -1].date);
        
        const finalDateForDuration = targetFinishDate ? new Date(targetFinishDate) : lastMilestoneDate;

        if(!isNaN(firstDateForCalc.getTime()) && !isNaN(finalDateForDuration.getTime())) {
            const diffTime = Math.abs(finalDateForDuration.getTime() - firstDateForCalc.getTime());
            setTotalProjectDuration(`${Math.ceil(diffTime / (1000 * 60 * 60 * 24))} day(s)`);
        } else { setTotalProjectDuration(null); }
        
        if (targetFinishDate && !isNaN(lastMilestoneDate.getTime()) && !isNaN(new Date(targetFinishDate).getTime())) {
            const targetD = new Date(targetFinishDate);
            const diff = Math.ceil((targetD.getTime() - lastMilestoneDate.getTime()) / (1000 * 60 * 60 * 24));
            if (diff === 0) setGapWithLastMilestone("Target matches last milestone.");
            else if (diff > 0) setGapWithLastMilestone(`${diff} day(s) after last milestone.`);
            else setGapWithLastMilestone(`${Math.abs(diff)} day(s) before last milestone.`);
        } else { setGapWithLastMilestone(null); }

    } else if (projectStartDate && targetFinishDate) {
        const firstDate = new Date(projectStartDate);
        const lastDate = new Date(targetFinishDate);
        if(!isNaN(firstDate.getTime()) && !isNaN(lastDate.getTime())) {
             const diffTime = Math.abs(lastDate.getTime() - firstDate.getTime());
             setTotalProjectDuration(`${Math.ceil(diffTime / (1000 * 60 * 60 * 24))} day(s)`);
        } else { setTotalProjectDuration(null); }
        setGapWithLastMilestone(null);
    } else {
        setTotalProjectDuration(null);
        setGapWithLastMilestone(null);
    }

  }, [manualMilestones, uploadedDataRows, fieldMappings, projectStartDate, targetFinishDate, calculateDurations]);

  const handleManualFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setManualFormState(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleAddManualMilestone = () => {
    if (!manualFormState.date || !manualFormState.title) { setError("Date and Title are required for manual milestones."); return; }
    const newMilestone: Milestone = {
      id: `manual-${Date.now()}`,
      date: manualFormState.date,
      title: manualFormState.title,
      description: manualFormState.description,
      value: manualFormState.value,
      category: manualFormState.category as DefaultMilestoneCategoryKey || 'GENERAL',
      source: 'manual',
    };
    setManualMilestones(prev => [...prev, newMilestone]);
    setManualFormState({ date: '', title: '', description: '', value: '', category: 'GENERAL' });
    setError(null); setSuccessMessage("Manual milestone added.");
  };
  
  const handleEditMilestone = (milestone: Milestone) => { setEditingMilestone(milestone); setEditFormState({ ...milestone }); };
  
  const handleEditFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setEditFormState(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSaveEdit = () => { if (!editingMilestone || !editFormState.date || !editFormState.title) { setError("Date and Title are required when editing."); return; } const updateFunction = (m: Milestone) => m.id === editingMilestone.id ? { ...m, ...editFormState } as Milestone : m; if (editingMilestone.source === 'manual') { setManualMilestones(prev => prev.map(updateFunction)); } else { setCombinedMilestones(prev => prev.map(updateFunction));} setEditingMilestone(null); setError(null); setSuccessMessage("Milestone updated."); };
  const handleDeleteMilestone = (milestoneId: string, source: 'manual' | 'uploaded') => { if (window.confirm("Are you sure you want to delete this milestone?")) { if (source === 'manual') { setManualMilestones(prev => prev.filter(m => m.id !== milestoneId)); } else { const deletedMilestone = combinedMilestones.find(m => m.id === milestoneId); if(deletedMilestone) { setCombinedMilestones(prev => prev.filter(m => m.id !== milestoneId)); } } setSuccessMessage("Milestone removed."); }};

  const selectStyles = getSharedSelectBaseStyles(theme);

  const onDrop = useCallback((acceptedFiles: FileWithPath[]) => { if (acceptedFiles.length > 0) { const file = acceptedFiles[0]; setUploadedFile(file); const reader = new FileReader(); reader.onload = (event) => { try { const binaryStr = event.target?.result; if (!binaryStr) throw new Error("File content is empty."); const workbook = XLSX.read(binaryStr, { type: 'binary', cellDates: true }); const firstSheetName = workbook.SheetNames[0]; if (!firstSheetName) { setError("Excel file has no sheets."); return; } const worksheet = workbook.Sheets[firstSheetName]; const jsonData = XLSX.utils.sheet_to_json<DataRow>(worksheet, { defval: null, raw: false }); if (jsonData.length === 0) { setError(`Sheet "${firstSheetName}" is empty.`); return; } setUploadedDataHeaders(Object.keys(jsonData[0] || {})); setUploadedDataRows(jsonData); setFieldMappings({}); setError(null); setSuccessMessage(`File "${file.name}" uploaded. Map fields below.`); } catch (e: any) { setError(`Error processing file: ${e.message}`); }}; reader.onerror = () => { setError("Error reading file."); }; reader.readAsBinaryString(file);}}, []);
  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: { 'application/vnd.ms-excel': ['.xls'], 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] }, maxFiles: 1 });
  const handleFieldMapping = (targetField: keyof typeof fieldMappings, sourceHeader: string) => setFieldMappings(prev => ({ ...prev, [targetField]: sourceHeader }));
  const handleHeaderDragStart = (header: string) => setDraggedHeader(header);
  const handleDropOnMappingTarget = (targetField: keyof typeof fieldMappings, e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); if (draggedHeader) { handleFieldMapping(targetField, draggedHeader); setDraggedHeader(null); } };
  const handleDragOverMappingTarget = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; };
  const handleExportMilestones = async () => { setIsLoading(true);setError(null);setSuccessMessage(null);try{let dataToExport=combinedMilestones.map(({id,source,durationFromPrevious,durationFromStart, ...rest})=>rest);if(selectedExportType==='csv'){const worksheet=XLSX.utils.json_to_sheet(dataToExport);const csvString=XLSX.utils.sheet_to_csv(worksheet);const blob=new Blob([csvString],{type:'text/csv;charset=utf-8;'});const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.setAttribute('download','milestones.csv');document.body.appendChild(link);link.click();document.body.removeChild(link);setSuccessMessage("Milestones exported as CSV.");}else if(selectedExportType==='json'){const jsonString=JSON.stringify(dataToExport,null,2);const blob=new Blob([jsonString],{type:'application/json;charset=utf-8;'});const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.setAttribute('download','milestones.json');document.body.appendChild(link);link.click();document.body.removeChild(link);setSuccessMessage("Milestones exported as JSON.");}else if(selectedExportType==='text'){const textContent=dataToExport.map(m=>`${m.date} - ${m.title}${m.description?` (${m.description})`:''}${m.value?` [Value: ${m.value}]`:''}`).join('\n\n');const blob=new Blob([textContent],{type:'text/plain;charset=utf-8;'});const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.setAttribute('download','milestones.txt');document.body.appendChild(link);link.click();document.body.removeChild(link);setSuccessMessage("Milestones exported as TXT.");}else if(selectedExportType==='ai_report'){const prompt=`Analyze the following milestones and generate a concise report summarizing key events, potential risks or opportunities, and an overall project outlook. Milestones:\n${combinedMilestones.map(m=>`- ${m.date}: ${m.title}${m.description?` (Details: ${m.description})`:''}${m.value?` (Value: ${m.value})`:''}`).join('\n')}\n\nPlease provide the report in well-structured Markdown.`;const response=await analyzeDocumentWithGemini(prompt,undefined,'text');if(response.type==='text'&&typeof response.content==='string'){const blob=new Blob([response.content],{type:'text/markdown;charset=utf-8;'});const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.setAttribute('download','ai_milestone_report.md');document.body.appendChild(link);link.click();document.body.removeChild(link);setSuccessMessage("AI Milestone Report generated and downloaded.");}else{setError("Failed to generate AI report. "+(response.type==='error'?response.content:'Unknown error.'));}}}catch(e:any){setError(`Export failed: ${e.message}`);}setIsLoading(false);};

  const mappingTargets: {label: string, field: keyof typeof fieldMappings, icon: React.ElementType }[] = [{ label: 'Date Field*', field: 'date', icon: CalendarRange },{ label: 'Title Field*', field: 'title', icon: Heading1 },{ label: 'Description Field', field: 'description', icon: Baseline },{ label: 'Value Field', field: 'value', icon: Hash },{ label: 'Category Field', field: 'category', icon: ListChecks }];
  const summaryElementStyle = `flex justify-between items-center cursor-pointer list-none hover:bg-${theme.mediumGray}/10 p-3 -m-3 rounded-md transition-colors`;
  
  // Removed handleViewDetails and detail modal logic.

  return (
    <div className={`p-4 md:p-6 h-full flex flex-col ${theme.contentBg} ${theme.textColor} futuristic-scrollbar overflow-y-auto`}>
        <div className="flex justify-between items-center mb-6">
            <h1 className={`text-2xl md:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-${theme.accent1} to-${theme.accent2}`}>Milestone Planner</h1>
        </div>
        
        <div className={`transition-all duration-500 ease-in-out ${isTimelineMaximized ? 'max-h-24 overflow-hidden opacity-50' : 'max-h-[2000px] opacity-100'}`}>
            <details className={`${theme.cardBg} p-4 rounded-lg shadow-md border ${theme.borderColor} mb-6 group`} open={isConfigSectionOpen} onToggle={(e) => setIsConfigSectionOpen((e.target as HTMLDetailsElement).open)}>
                <summary className={summaryElementStyle}>
                    <div className="flex items-center"><Settings2 size={20} className={`mr-2 text-${theme.accent3}`} /><h2 className={`text-lg font-semibold text-${theme.accent3}`}>Configuration & Input</h2></div>
                    <ChevronDown size={20} className={`group-open:rotate-180 transition-transform text-${theme.accent3}`} />
                </summary>
                <div className="mt-4 pt-4 border-t ${theme.borderColor} space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div><label className={`text-xs ${theme.textColor} opacity-70`}>Project Start Date</label><Input type="date" value={projectStartDate} onChange={(e) => setProjectStartDate(e.target.value)} className="w-full"/></div>
                      <div><label className={`text-xs ${theme.textColor} opacity-70`}>Target Finish Date (Optional)</label><Input type="date" value={targetFinishDate} onChange={(e) => setTargetFinishDate(e.target.value)} className="w-full"/></div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-3"> {/* Manual Input */}
                            <h3 className={`text-md font-semibold text-${theme.accent1} mb-2`}>Add Milestone Manually</h3>
                            <div><label className={`text-xs ${theme.textColor} opacity-70`}>Date*</label><Input type="date" name="date" value={manualFormState.date || ''} onChange={handleManualFormChange} className="w-full"/></div>
                            <div><label className={`text-xs ${theme.textColor} opacity-70`}>Title*</label><Input type="text" name="title" placeholder="Milestone Title" value={manualFormState.title || ''} onChange={handleManualFormChange} className="w-full"/></div>
                            <div><label className={`text-xs ${theme.textColor} opacity-70`}>Description</label><Input type="text" name="description" placeholder="Details (optional)" value={manualFormState.description || ''} onChange={handleManualFormChange} className="w-full"/></div>
                            <div><label className={`text-xs ${theme.textColor} opacity-70`}>Value</label><Input type="text" name="value" placeholder="Metric/KPI (optional)" value={manualFormState.value || ''} onChange={handleManualFormChange} className="w-full"/></div>
                            <div><label className={`text-xs ${theme.textColor} opacity-70`}>Category</label>
                                <select name="category" value={manualFormState.category || 'GENERAL'} onChange={handleManualFormChange} className={`${selectStyles.baseClassName} w-full`} style={selectStyles.style}><option value="" style={selectStyles.optionStyle}>Select Category</option>{categoryKeys.map(key => <option key={key} value={key} style={selectStyles.optionStyle}>{DefaultMilestoneCategories[key].label}</option>)}</select>
                            </div>
                            {/* Sub-tasks for Manual Input removed */}
                            <Button onClick={handleAddManualMilestone} variant="primary" size="sm" leftIcon={<PlusCircle size={16}/>}>Add Manual Milestone</Button>
                        </div>
                        <div className="space-y-3"> {/* File Upload & Mapping */}
                            <h3 className={`text-md font-semibold text-${theme.accent1} mb-2`}>Import Milestones from File</h3>
                            <div {...getRootProps()} className={`p-4 border-2 border-dashed rounded-lg cursor-pointer text-center ${theme.borderColor} hover:border-${theme.accent1} ${isDragActive ? `border-${theme.accent1} bg-${theme.accent1}/10` : ''}`}>
                                <input {...getInputProps()} /><UploadCloud size={24} className={`mx-auto mb-1 ${isDragActive ? `text-${theme.accent1}` : `${theme.textColor} opacity-70`}`} />
                                <p className={`text-xs ${theme.textColor} opacity-70`}>{isDragActive ? "Drop file..." : "Drag & drop .xlsx, .xls, or click"}</p>
                            </div>
                            {uploadedFile && <p className={`text-xs truncate ${theme.textColor} opacity-70`}>Uploaded: <span className={`font-semibold text-${theme.accent2}`}>{uploadedFile.name}</span></p>}
                            {uploadedDataHeaders.length > 0 && (<>
                                <p className={`text-xs ${theme.textColor} opacity-60 mt-2`}>Drag headers to map, or select:</p>
                                <div className={`grid grid-cols-2 gap-1 mb-1 max-h-24 overflow-y-auto futuristic-scrollbar border ${theme.borderColor} p-1 rounded bg-${theme.darkGray}/30`}>{uploadedDataHeaders.map(h => (<div key={h} draggable onDragStart={()=>handleHeaderDragStart(h)} className={`p-1 border ${theme.borderColor} rounded text-[10px] cursor-grab bg-${theme.mediumGray}/30 hover:bg-${theme.mediumGray}/60 truncate ${theme.textColor}`} title={h}>{h}</div>))}</div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                                    {mappingTargets.map(t => (<div key={t.field} onDrop={(e)=>handleDropOnMappingTarget(t.field, e)} onDragOver={handleDragOverMappingTarget} className={`p-2 border rounded-md border-dashed ${fieldMappings[t.field] ? `border-${theme.accent3}` : theme.borderColor} bg-${theme.darkGray}/30`}>
                                        <label className={`flex items-center text-xs ${theme.textColor} opacity-70 mb-1`}><t.icon size={12} className="mr-1.5"/>{t.label}:</label>
                                        <select value={fieldMappings[t.field]||''} onChange={(e)=>handleFieldMapping(t.field,e.target.value)} className={`${selectStyles.baseClassName} w-full`} style={selectStyles.style}><option value="" style={selectStyles.optionStyle}>-- Select --</option>{uploadedDataHeaders.map(h=><option key={h} value={h} style={selectStyles.optionStyle}>{h}</option>)}</select>
                                        {fieldMappings[t.field] && (<p className={`text-[10px] mt-0.5 ${theme.textColor} opacity-60`}>Mapped: <span className={`font-semibold text-${theme.accent3}`}>{fieldMappings[t.field]}</span></p>)}
                                    </div>))}
                                </div>
                            </>)}
                        </div>
                    </div>
                </div>
            </details>
        </div>
        
        {error && <div className={`my-3 p-3 rounded-md bg-${theme.accent4}/20 border border-${theme.accent4} text-${theme.accent4} text-sm flex items-center gap-2`}><AlertTriangle size={18}/>{error}</div>}
        {successMessage && <div className={`my-3 p-3 rounded-md bg-${theme.accent3}/20 border border-${theme.accent3} text-${theme.accent3} text-sm flex items-center gap-2`}><CheckCircle size={18}/>{successMessage}</div>}
        
        {(totalProjectDuration || remainingDaysToTarget || gapWithLastMilestone) && (
            <div className={`${theme.cardBg} p-3 rounded-md shadow-md border ${theme.borderColor} mb-4 flex flex-wrap gap-x-4 gap-y-2 text-xs`}>
                {totalProjectDuration && <p><strong style={{color: RAW_COLOR_VALUES[theme.accent1]}}>Total Duration:</strong> {totalProjectDuration}</p>}
                {remainingDaysToTarget && <p><strong style={{color: RAW_COLOR_VALUES[theme.accent2]}}>To Target:</strong> {remainingDaysToTarget}</p>}
                {gapWithLastMilestone && <p><strong style={{color: RAW_COLOR_VALUES[theme.accent3]}}>Target vs Last Milestone:</strong> {gapWithLastMilestone}</p>}
            </div>
        )}

        <div className={`${theme.cardBg} p-4 rounded-lg shadow-md border ${theme.borderColor} mb-6 group ${isTimelineMaximized ? 'fixed inset-0 z-[100] flex flex-col' : ''}`}>
            <div className={`${summaryElementStyle} ${isTimelineMaximized ? 'cursor-auto' : ''}`} onClick={(e) => !isTimelineMaximized && (e.target as HTMLElement).closest('button') === null && setIsTimelineMaximized(true)}>
                <div className="flex items-center">
                  <Flag size={20} className={`mr-2 text-${theme.accent1}`} />
                  <h2 className={`text-lg font-semibold text-${theme.accent1}`}>Timeline Visualization ({combinedMilestones.length})</h2>
                </div>
                <Button
                    onClick={(e) => { e.stopPropagation(); setIsTimelineMaximized(!isTimelineMaximized); }}
                    variant="ghost"
                    size="sm"
                    className={`p-1.5 hover:bg-${theme.mediumGray}/30`}
                    aria-label={isTimelineMaximized ? "Minimize Timeline View" : "Maximize Timeline View"}
                >
                    {isTimelineMaximized ? <Minimize2 size={20} className={`text-${theme.accent1}`}/> : <Maximize2 size={20} className={`text-${theme.accent1}`}/>}
                </Button>
            </div>
            <div className={`mt-4 pt-4 border-t ${theme.borderColor} ${isTimelineMaximized ? 'flex-grow min-h-0 overflow-hidden flex flex-col' : 'max-h-[60vh]'} overflow-y-auto futuristic-scrollbar pr-2`}>
                {combinedMilestones.length === 0 ? <p className={`text-sm ${theme.textColor} opacity-70 text-center py-8`}>No milestones to display for timeline.</p> :
                (
                  <div ref={timelineContainerRef} className={`w-full relative ${isTimelineMaximized ? 'flex-grow' : ''} overflow-x-auto futuristic-scrollbar pb-8 pt-8 px-4 min-h-[350px]`}> 
                    <div 
                        className="absolute top-1/2 left-0 h-2.5 rounded-full" 
                        style={{ 
                            width: `${Math.max(combinedMilestones.length * (TIMELINE_NODE_WIDTH + TIMELINE_NODE_SPACING), timelineContainerRef.current?.clientWidth || 800) + TIMELINE_NODE_SPACING}px`, 
                            background: `linear-gradient(to right, ${timelineAxisColorStart}, ${timelineAxisColorEnd})`,
                            transform: 'translateY(-50%)', 
                            zIndex:1 
                        }}
                    >
                        <div className="absolute right-[-1px] top-1/2 w-0 h-0 border-t-[12px] border-t-transparent border-b-[12px] border-b-transparent border-l-[18px]" style={{borderLeftColor: timelineAxisColorEnd, transform: 'translateY(-50%)'}}></div>
                    </div>
                    
                    <div className="relative flex items-start h-full" style={{ minWidth: `${combinedMilestones.length * (TIMELINE_NODE_WIDTH + TIMELINE_NODE_SPACING)}px`}}>
                        {combinedMilestones.map((milestone, index) => {
                           const nodeColor = timelineNodeColorCycle[index % timelineNodeColorCycle.length];
                           const isAbove = index % 2 === 0;
                           const leftPosition = index * (TIMELINE_NODE_WIDTH + TIMELINE_NODE_SPACING) + (TIMELINE_NODE_WIDTH / 2) + (TIMELINE_NODE_SPACING / 2);
                           
                           const positionStyle: React.CSSProperties = {
                               left: `${leftPosition}px`,
                               top: isAbove ? 'auto' : `calc(50% + ${TIMELINE_VERTICAL_OFFSET / 2 - 25}px)`, 
                               bottom: isAbove ? `calc(50% + ${TIMELINE_VERTICAL_OFFSET / 2 - 25}px)` : 'auto',
                               transform: 'translateX(-50%)', 
                               zIndex: 10,
                               width: `${TIMELINE_NODE_WIDTH}px`
                           };

                           return (
                            <MilestoneNode 
                                key={milestone.id} 
                                milestone={milestone} 
                                positionStyle={positionStyle}
                                isAboveAxis={isAbove}
                                connectorColor={nodeColor}
                                onViewDetails={() => {}} // onViewDetails is now a no-op or could be repurposed
                            />
                           );
                        })}
                    </div>
                  </div>
                )}
            </div>
        </div>
        
        {!isTimelineMaximized && (
          <details className={`${theme.cardBg} p-4 rounded-lg shadow-md border ${theme.borderColor} mb-6 group`} open={isIndividualManagementSectionOpen} onToggle={(e) => setIsIndividualManagementSectionOpen((e.target as HTMLDetailsElement).open)}>
            <summary className={summaryElementStyle}>
                <div className="flex items-center"><ListChecks size={20} className={`mr-2 text-${theme.accent2}`} /><h2 className={`text-lg font-semibold text-${theme.accent2}`}>Manage Individual Milestones</h2></div>
                <ChevronDown size={20} className={`group-open:rotate-180 transition-transform text-${theme.accent2}`} />
            </summary>
            <div className={`mt-4 pt-4 border-t ${theme.borderColor} max-h-[60vh] overflow-y-auto futuristic-scrollbar pr-2`}>
                {combinedMilestones.length > 0 ? combinedMilestones.map(m => { 
                    const categoryKey = (m.category?.toUpperCase() as DefaultMilestoneCategoryKey) || 'GENERAL';
                    const categoryInfo = DefaultMilestoneCategories[categoryKey] || DefaultMilestoneCategories.OTHER;
                    const IconComp = typeof categoryInfo.icon === 'function' ? categoryInfo.icon : CheckCircle;
                    const iconColor = RAW_COLOR_VALUES[categoryInfo.colorKey] || RAW_COLOR_VALUES[theme.accent1];

                    return (
                    <div key={`${m.id}-list-manage`} className={`p-2 border-b ${theme.borderColor} last:border-b-0 hover:bg-${theme.mediumGray}/10`}>
                        {editingMilestone?.id === m.id ? (
                            <div className="space-y-2 text-xs">
                                {/* Edit Form Inputs */}
                                <div><label className={`text-[10px] ${theme.textColor} opacity-70`}>Date*</label><Input type="date" name="date" value={editFormState.date || ''} onChange={handleEditFormChange} className="w-full !py-1"/></div>
                                <div><label className={`text-[10px] ${theme.textColor} opacity-70`}>Title*</label><Input type="text" name="title" value={editFormState.title || ''} onChange={handleEditFormChange} placeholder="Title" className="w-full !py-1"/></div>
                                <div><label className={`text-[10px] ${theme.textColor} opacity-70`}>Category</label>
                                    <select name="category" value={editFormState.category || 'GENERAL'} onChange={handleEditFormChange} className={`${selectStyles.baseClassName} w-full !py-1 !text-xs`} style={selectStyles.style}><option value="" style={selectStyles.optionStyle}>Select Category</option>{categoryKeys.map(key => <option key={key} value={key} style={selectStyles.optionStyle}>{DefaultMilestoneCategories[key].label}</option>)}</select>
                                </div>
                                <div><label className={`text-[10px] ${theme.textColor} opacity-70`}>Description</label><Input type="text" name="description" value={editFormState.description || ''} onChange={handleEditFormChange} placeholder="Description" className="w-full !py-1"/></div>
                                <div><label className={`text-[10px] ${theme.textColor} opacity-70`}>Value</label><Input type="text" name="value" value={editFormState.value || ''} onChange={handleEditFormChange} placeholder="Value" className="w-full !py-1"/></div>
                                {/* Sub-tasks for Edit Form removed */}
                                <div className="flex gap-2 mt-1">
                                    <Button onClick={handleSaveEdit} size="sm" variant="primary" className={`!text-xs !py-1`}>Save</Button>
                                    <Button onClick={() => setEditingMilestone(null)} size="sm" variant="secondary" className="!text-xs !py-1">Cancel</Button>
                                </div>
                            </div>
                        ) : (
                            <div className={`flex justify-between items-start text-xs ${theme.textColor}`}>
                                <div className="flex-grow min-w-0"> {/* Added min-w-0 for truncation */}
                                    <div className="flex items-center mb-0.5">
                                        <IconComp size={14} className="mr-1.5 flex-shrink-0" style={{color: iconColor}}/>
                                        <span className={`font-semibold truncate text-${theme.accent1}`} title={m.title}>{m.title}</span>
                                        <span className={`mx-1.5 ${theme.textColor} opacity-50`}>|</span>
                                        <span className={`${theme.textColor} opacity-80`}>{m.date}</span>
                                        <span className={`ml-2 px-1.5 py-0.5 text-[9px] rounded-full bg-${theme.mediumGray}/30 ${theme.textColor} opacity-70`}>{categoryInfo.label}</span>
                                    </div>
                                    {m.description && <p className={`text-[10px] ${theme.textColor} opacity-60 ml-5 truncate`} title={m.description}>{m.description}</p>}
                                    {m.value && <p className={`text-[10px] ${theme.textColor} opacity-60 ml-5`}>Value: {m.value}</p>}
                                    {/* Sub-task count display removed */}
                                    <div className={`flex gap-2 text-[10px] ${theme.textColor} opacity-50 ml-5 mt-0.5`}>
                                        {m.durationFromPrevious && <span>From Prev: {m.durationFromPrevious}</span>}
                                        {m.durationFromStart && <span>From Start: {m.durationFromStart}</span>}
                                    </div>
                                </div>
                                <div className="flex-shrink-0 flex gap-1.5">
                                    {/* "View Details" button removed from here */}
                                    <Button onClick={() => handleEditMilestone(m)} variant="ghost" size="sm" className={`!p-1 text-${theme.accent3} hover:text-${theme.accent3}/80`}><Edit3 size={12}/></Button>
                                    <Button onClick={() => handleDeleteMilestone(m.id, m.source)} variant="ghost" size="sm" className={`!p-1 text-${theme.accent4} hover:text-${theme.accent4}/80`}><Trash2 size={12}/></Button>
                                </div>
                            </div>
                        )}
                    </div>
                )}) : <p className={`text-sm ${theme.textColor} opacity-70 text-center py-4`}>No milestones to manage.</p>}
            </div>
          </details>
        )}
        
        {combinedMilestones.length > 0 && !isTimelineMaximized && (
            <div className={`${theme.cardBg} p-4 rounded-lg shadow-md border ${theme.borderColor} mt-4`}>
                <h3 className={`text-md font-semibold mb-2 text-${theme.accent4}`}>Export Milestones</h3>
                <div className="flex items-center gap-3">
                    <select value={selectedExportType} onChange={(e)=>setSelectedExportType(e.target.value as MilestoneOutputType)} className={`${selectStyles.baseClassName} w-auto`} style={selectStyles.style}><option value="csv" style={selectStyles.optionStyle}>CSV</option><option value="json" style={selectStyles.optionStyle}>JSON</option><option value="text" style={selectStyles.optionStyle}>TXT</option><option value="ai_report" style={selectStyles.optionStyle}>AI Report (MD)</option></select>
                    <Button onClick={handleExportMilestones} variant="secondary" size="sm" leftIcon={<DownloadIcon size={16}/>} isLoading={isLoading && selectedExportType === 'ai_report'}>{isLoading && selectedExportType==='ai_report' ? 'Generating...' : 'Export'}</Button>
                </div>
            </div>
        )}

      {/* Milestone Detail Modal removed */}
    </div>
  );
};
export default MilestonePlanner;
