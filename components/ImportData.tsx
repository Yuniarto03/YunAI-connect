
import React, { useState, useCallback, useContext, useEffect } from 'react';
import { useDropzone, FileWithPath } from 'react-dropzone';
import * as XLSX from 'xlsx';
import { AppContext } from '../contexts/AppContext';
import { AppContextType, ProcessedData, DataRow, Theme, DataSourceOrigin, FileSystemFileHandle, OpenFilePickerOptions, FileSystemHandlePermissionDescriptor } from '../types';
import Button from './shared/Button';
import { UploadCloud, FileText, RefreshCw, CheckCircle, AlertTriangle, Server, HardDrive, Link as LinkIcon, Cloud, FileJson, FileSpreadsheet, Info, Zap } from 'lucide-react'; // Download icon removed
import Modal from './shared/Modal';
import LoadingSpinner from './shared/LoadingSpinner';
import { RAW_COLOR_VALUES } from '../constants';
import Input from './shared/Input';
import FuturisticBackground from './shared/FuturisticBackground'; // Import the new component
import { getSharedSelectBaseStyles } from '../utils'; // Import shared utility

const ImportData: React.FC = () => {
  const { theme, setProcessedData, processedData, reduceMotion } = useContext(AppContext) as AppContextType;
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [currentFileSourceDetails, setCurrentFileSourceDetails] = useState<DataSourceOrigin | null>(null);

  const [isSheetSelectorOpen, setIsSheetSelectorOpen] = useState(false);
  const [workbookSheets, setWorkbookSheets] = useState<string[]>([]);
  const [currentWorkbookForModal, setCurrentWorkbookForModal] = useState<XLSX.WorkBook | null>(null);
  const [currentOriginForModal, setCurrentOriginForModal] = useState<DataSourceOrigin | null>(null);


  const [selectedCloudProvider, setSelectedCloudProvider] = useState<CloudProvider | null>(null);
  const [cloudSourceUrlInput, setCloudSourceUrlInput] = useState<string>('');

  const [originalExcelFileDetails, setOriginalExcelFileDetails] = useState<{ workbook: XLSX.WorkBook; fileName: string; origin: DataSourceOrigin } | null>(null);
  const [isFileSystemApiSupported, setIsFileSystemApiSupported] = useState(false);

  useEffect(() => {
    setIsFileSystemApiSupported(typeof window.showOpenFilePicker === 'function');
  }, []);

  const commonProcessAndSetData = (rawData: DataRow[], fileName: string, origin: DataSourceOrigin, sheetName?: string) => {
    if (rawData.length === 0) {
      setError("The selected file or sheet is empty or could not be parsed.");
      setProcessedData(null, {isUserAction: false});
      return;
    }
    const headers = Object.keys(rawData[0]).filter(h => h !== '__ROW_ID__');
    const dataWithIds = rawData.map((row, index) => ({
      ...row,
      __ROW_ID__: `${fileName}-${sheetName || 'default'}-${index}`
    }));

    setProcessedData({ fileName, data: dataWithIds, headers, sheetName, origin }, {isUserAction: false}); // Mark as initial load for history
    setCurrentFileSourceDetails(origin); // Keep track of the most recent source with its handle/live status
    setSuccessMessage(`Successfully loaded ${dataWithIds.length} rows from ${fileName}${sheetName ? ` (Sheet: ${sheetName})` : ''}.${origin.type === 'local' && origin.isLive ? ' (Live Sync Enabled)' : ''}`);
    setError(null);
  };

  const handleSheetSelectionFromModal = (sheetName: string) => {
    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);

    if (currentWorkbookForModal && currentOriginForModal) {
      try {
        const worksheet = currentWorkbookForModal.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json<DataRow>(worksheet, { defval: null });

        const baseFileName = currentOriginForModal.type === 'local' ? currentOriginForModal.file.name : currentOriginForModal.url.substring(currentOriginForModal.url.lastIndexOf('/') + 1) || 'cloud_file';
        commonProcessAndSetData(jsonData, baseFileName, currentOriginForModal, sheetName);

        setOriginalExcelFileDetails({ workbook: currentWorkbookForModal, fileName: baseFileName, origin: currentOriginForModal });
      } catch (e: any) {
        console.error("Error processing sheet from modal:", e);
        setError(`Error processing sheet ${sheetName}: ${e.message}`);
        setProcessedData(null, {isUserAction: false});
        setOriginalExcelFileDetails(null);
      }
    }
    setIsSheetSelectorOpen(false);
    setCurrentWorkbookForModal(null);
    setCurrentOriginForModal(null);
    setIsLoading(false);
  };

  const processExcelWorkbook = (workbook: XLSX.WorkBook, fileName: string, origin: DataSourceOrigin) => {
    setIsLoading(true);
    const sheetNames = workbook.SheetNames;

    if (sheetNames.length > 1) {
      setCurrentWorkbookForModal(workbook);
      setCurrentOriginForModal(origin);
      setWorkbookSheets(sheetNames);
      setIsSheetSelectorOpen(true);
      // setIsLoading(false) will be handled by modal choice or its closure
    } else {
      setOriginalExcelFileDetails(null);
      const firstSheetName = sheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const jsonData = XLSX.utils.sheet_to_json<DataRow>(worksheet, { defval: null });
      commonProcessAndSetData(jsonData, fileName, origin, firstSheetName);
      setIsLoading(false);
    }
  };

  const processActualFile = async (file: File, origin: DataSourceOrigin, specificSheetName?: string) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const binaryStr = event.target?.result;
        if (!binaryStr) throw new Error("File content is empty.");

        if (file.name.endsWith('.json')) {
          const jsonData = JSON.parse(binaryStr as string) as DataRow[];
          commonProcessAndSetData(jsonData, file.name, origin);
          setOriginalExcelFileDetails(null);
        } else if (file.name.endsWith('.xls') || file.name.endsWith('.xlsx')) {
          const workbook = XLSX.read(binaryStr, { type: 'binary' });
           if (specificSheetName && workbook.SheetNames.includes(specificSheetName)) {
            const worksheet = workbook.Sheets[specificSheetName];
            const jsonData = XLSX.utils.sheet_to_json<DataRow>(worksheet, { defval: null });
            commonProcessAndSetData(jsonData, file.name, origin, specificSheetName);
            setOriginalExcelFileDetails({ workbook, fileName: file.name, origin });
          } else {
            processExcelWorkbook(workbook, file.name, origin);
          }
        } else {
          throw new Error("Unsupported file type. Please upload XLS, XLSX, or JSON.");
        }
      } catch (e: any) {
        console.error("Error processing file:", e);
        setError(`Error processing file: ${e.message}`);
        setProcessedData(null, {isUserAction:false});
        setOriginalExcelFileDetails(null);
      } finally {
        setIsLoading(false);
      }
    };
    reader.onerror = () => { setError("Error reading file."); setIsLoading(false); setProcessedData(null, {isUserAction:false}); setOriginalExcelFileDetails(null);};

    if (file.name.endsWith('.json')) reader.readAsText(file);
    else reader.readAsBinaryString(file);
  };


  const onDrop = useCallback(async (acceptedFiles: FileWithPath[], specificSheetName?: string) => {
    setError(null); setSuccessMessage(null); setIsLoading(true); setOriginalExcelFileDetails(null);

    if (acceptedFiles.length === 0) {
      setError("No file selected or file type not supported."); setIsLoading(false); return;
    }
    const file = acceptedFiles[0];
    // For dropped files, handle is null, isLive is false.
    const localOrigin: DataSourceOrigin = { type: 'local', file, handle: null, isLive: false };
    await processActualFile(file, localOrigin, specificSheetName);
  }, [setProcessedData]); // Dependencies are simplified as processActualFile handles the rest

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (files) => onDrop(files),
    accept: {
      'application/json': ['.json'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    },
    maxFiles: 1,
    disabled: isLoading,
  });

  const verifyPermission = async (fileHandle: FileSystemFileHandle, readWrite: boolean): Promise<boolean> => {
    const options: FileSystemHandlePermissionDescriptor = { mode: readWrite ? 'readwrite' : 'read' };
    if (await fileHandle.queryPermission(options) === 'granted') return true;
    if (await fileHandle.requestPermission(options) === 'granted') return true;
    return false;
  };

  const handleOpenFileWithLiveSync = async (specificSheetName?: string) => {
    if (!isFileSystemApiSupported || !window.showOpenFilePicker) {
      setError("File System Access API is not supported by your browser. Please use the drag & drop upload."); return;
    }
    setError(null); setSuccessMessage(null); setIsLoading(true); setOriginalExcelFileDetails(null);

    try {
      const pickerOpts: OpenFilePickerOptions = {
        types: [
          { description: 'Spreadsheets', accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'], 'application/vnd.ms-excel': ['.xls'] } },
          { description: 'JSON Files', accept: { 'application/json': ['.json'] } },
        ],
        excludeAcceptAllOption: false,
        multiple: false,
      };
      const [fileHandle] = await window.showOpenFilePicker(pickerOpts);
      const hasPermission = await verifyPermission(fileHandle, false);
      if (!hasPermission) {
        throw new Error("Permission to read the file was denied.");
      }
      const file = await fileHandle.getFile() as FileWithPath; // Cast File to FileWithPath
      const liveOrigin: DataSourceOrigin = { type: 'local', file, handle: fileHandle, isLive: true };
      await processActualFile(file, liveOrigin, specificSheetName);

    } catch (e: any) {
      console.error("Error opening file with File System Access API:", e);
      if (e.name === 'AbortError') {
        setError("File selection aborted by user.");
      } else if (e.message && typeof e.message === 'string' && e.message.includes("Cross origin sub frames aren't allowed to show a file picker")) {
        // This block specifically handles the cross-origin iframe error for showOpenFilePicker.
        setError("Could not open file picker due to browser security for cross-origin iframes. Please use the standard Drag & Drop upload method instead.");
      } else if (e.name === 'SecurityError') { 
        // Fallback for other SecurityErrors or if the message string check fails for some reason
        setError("Could not open file picker due to browser security. Please use the standard drag & drop upload method instead.");
      }
       else {
        setError(`Error opening file: ${e.message}. Please use the standard drag & drop upload.`);
      }
      setProcessedData(null, {isUserAction: false});
    } finally {
      setIsLoading(false);
    }
  };

  const handleCloudConnect = async (urlToFetch?: string, specificSheetName?: string) => {
    const targetUrl = urlToFetch || cloudSourceUrlInput.trim();
    if (!selectedCloudProvider || (selectedCloudProvider === 'url' && !targetUrl)) {
        setError("Please enter a valid file URL or select a provider and enter its share link.");
        return;
    }
    setIsLoading(true); setError(null); setSuccessMessage(null); setOriginalExcelFileDetails(null);

    const cloudOrigin: DataSourceOrigin = { type: 'cloud', url: targetUrl };

    try {
        const response = await fetch(targetUrl);
        if (!response.ok) throw new Error(`Failed to fetch: ${response.status} ${response.statusText}. Check URL & CORS.`);

        const contentType = response.headers.get('Content-Type');
        let fileName = targetUrl.substring(targetUrl.lastIndexOf('/') + 1);
        if (!fileName || !fileName.includes('.')) {
           fileName = selectedCloudProvider === 'url' ? 'url_file' : `${selectedCloudProvider}_file`;
           if (contentType?.includes('json')) fileName += '.json';
           else if (contentType?.includes('spreadsheet') || contentType?.includes('excel')) fileName += '.xlsx';
        }

        if (fileName.endsWith('.json') || contentType?.includes('application/json')) {
            const textContent = await response.text();
            const jsonData = JSON.parse(textContent) as DataRow[];
            commonProcessAndSetData(jsonData, fileName, cloudOrigin);
        } else if (fileName.endsWith('.xls') || fileName.endsWith('.xlsx') || contentType?.includes('spreadsheet') || contentType?.includes('excel')) {
            const arrayBuffer = await response.arrayBuffer();
            const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
            if (specificSheetName && workbook.SheetNames.includes(specificSheetName)) {
              const worksheet = workbook.Sheets[specificSheetName];
              const jsonData = XLSX.utils.sheet_to_json<DataRow>(worksheet, { defval: null });
              commonProcessAndSetData(jsonData, fileName, cloudOrigin, specificSheetName);
              setOriginalExcelFileDetails({ workbook, fileName, origin: cloudOrigin });
            } else {
              processExcelWorkbook(workbook, fileName, cloudOrigin);
            }
        } else {
            throw new Error(`Unsupported type from URL: ${fileName} (Content-Type: ${contentType || 'unknown'}).`);
        }
    } catch (e: any) {
        console.error("Error fetching/processing cloud file:", e);
        setError(e.message.includes('Failed to fetch') ? "Network error or CORS. Check console." : e.message);
        setProcessedData(null, {isUserAction:false});
    } finally {
        setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    if (!processedData || !processedData.origin) {
      setError("No active data with origin information to refresh."); return;
    }
    const { origin, sheetName } = processedData;
    setIsLoading(true); setError(null); setSuccessMessage(null);

    if (origin.type === 'local' && origin.handle && origin.isLive) {
      try {
        const hasPermission = await verifyPermission(origin.handle, false);
        if (!hasPermission) throw new Error("Permission to read the file was denied or lost.");
        const file = await origin.handle.getFile() as FileWithPath;
        // Re-use the same handle and isLive status for the origin
        const refreshedOrigin: DataSourceOrigin = { ...origin, file };
        await processActualFile(file, refreshedOrigin, sheetName);
      } catch (e: any) {
        setError(`Error refreshing live file: ${e.message}. Try re-opening the file.`);
        setProcessedData(null, { isUserAction:false }); // Clear data on error
        setIsLoading(false);
      }
    } else if (origin.type === 'local' && origin.file) { // Fallback for non-live local files
      await onDrop([origin.file], sheetName); // This calls setIsLoading internally
    } else if (origin.type === 'cloud') {
      await handleCloudConnect(origin.url, sheetName); // This calls setIsLoading internally
    } else {
      setError("Cannot refresh: Unknown data origin type or missing information.");
      setIsLoading(false);
    }
  };

  const handleSwitchSheetViaDropdown = (newSheetName: string) => {
    if (!originalExcelFileDetails) return;
    setIsLoading(true); setError(null); setSuccessMessage(null);
    try {
      const { workbook, fileName, origin } = originalExcelFileDetails;
      const worksheet = workbook.Sheets[newSheetName];
      const jsonData = XLSX.utils.sheet_to_json<DataRow>(worksheet, { defval: null });
      commonProcessAndSetData(jsonData, fileName, origin, newSheetName);
    } catch (e: any) {
      setError(`Error switching to sheet ${newSheetName}: ${e.message}`);
      setProcessedData(null, {isUserAction:false});
    }
    setIsLoading(false);
  };
  
  // handleDownloadTemplate function removed

  type CloudProvider = 'googledrive' | 'onedrive' | 'dropbox' | 'url';

  const selectStyles = getSharedSelectBaseStyles(theme); // Use shared utility

  const cloudProviders: {id: CloudProvider, name: string, icon: React.ElementType, exampleUrl?: string, fileTypes?: string}[] = [
    {id: 'url', name: 'Direct URL', icon: LinkIcon, exampleUrl: "https://example.com/data.xlsx", fileTypes:".xlsx, .xls, .json"},
    // Other cloud providers can be added here if direct linking/fetching is supported
  ];

  const currentProviderDetails = cloudProviders.find(p => p.id === selectedCloudProvider);
  const animationClass = reduceMotion ? '' : 'animate-fade-in';
  const canRefresh = !!(processedData && processedData.origin);

  return (
    <div className={`p-8 ${theme.textColor} futuristic-scrollbar overflow-auto h-full relative`}>
      <FuturisticBackground theme={theme} reduceMotion={reduceMotion} />
      <div className="relative z-10"> {/* Content wrapper */}
        <div className="flex justify-between items-center mb-8">
          <h1 className={`text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-${theme.accent1} to-${theme.accent2}`}>Import Data</h1>
          <div className="flex gap-2">
            {/* Download Template Button removed */}
            {canRefresh && (
                <Button onClick={handleRefresh} variant="secondary" size="md" leftIcon={<RefreshCw size={18}/>} disabled={isLoading}>
                    Refresh Data {(processedData?.origin?.type === 'local' && processedData.origin.isLive) ? <Zap size={14} className="ml-1.5 text-yellow-400" /> : null}
                </Button>
            )}
          </div>
        </div>

        <div className={`${theme.cardBg} p-6 rounded-xl shadow-xl border ${theme.borderColor} mb-6`}>
          <h2 className={`text-2xl font-semibold mb-4 text-${theme.accent3}`}>Local Computer</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div
                {...getRootProps()}
                className={`
                  p-8 border-2 border-dashed rounded-lg cursor-pointer
                  transition-all duration-300 ease-in-out text-center
                  ${theme.borderColor} hover:border-${theme.accent1} hover:bg-${theme.accent1}/10
                  ${isDragActive ? `border-${theme.accent1} bg-${theme.accent1}/20 shadow-neon-glow-${theme.accent1}` : ''}
                  ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}
                  flex flex-col items-center justify-center min-h-[150px]
                `}
              >
                <input {...getInputProps()} disabled={isLoading} />
                <UploadCloud size={40} className={`mx-auto mb-3 ${isDragActive ? `text-${theme.accent1}` : theme.textColor}`} />
                {isDragActive ? (
                  <p className={`text-md font-semibold text-${theme.accent1}`}>Drop the files here ...</p>
                ) : (
                  <p className="text-md">Drag & Drop XLS, XLSX, JSON</p>
                )}
                <p className="text-xs opacity-70 mt-1">(Standard Upload)</p>
              </div>

              {isFileSystemApiSupported && (
                  <Button
                    onClick={() => handleOpenFileWithLiveSync()}
                    variant="secondary"
                    className="w-full min-h-[150px] flex flex-col items-center justify-center text-md p-8"
                    disabled={isLoading}
                  >
                    <div className="flex items-center mb-2">
                       <Zap size={40} className={`mr-2 text-${theme.accent1}`} />
                       <span>Open File (Live Sync)</span>
                    </div>
                    <p className="text-xs opacity-70 mt-1">(XLSX, XLS, JSON - Recommended for live local file updates)</p>
                  </Button>
              )}
          </div>
        </div>

        <div className={`${theme.cardBg} p-6 rounded-xl shadow-xl border ${theme.borderColor} mb-6`}>
          <h2 className={`text-2xl font-semibold mb-4 text-${theme.accent4}`}>Online Storage</h2>
           <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mb-2">
                  {cloudProviders.map(provider => (
                  <Button
                      key={provider.id}
                      variant={selectedCloudProvider === provider.id ? 'primary' : 'secondary'}
                      onClick={() => {
                          setSelectedCloudProvider(provider.id); setError(null); setSuccessMessage(null);
                      }}
                      className="w-full text-sm py-2.5"
                      leftIcon={<provider.icon size={18}/>}
                  >
                      {provider.name}
                  </Button>
                  ))}
              </div>
              {selectedCloudProvider && (
                <div className="space-y-2">
                    <label htmlFor="cloudUrl" className={`text-sm font-medium text-${theme.textColor}`}>
                        {currentProviderDetails?.id === 'url' ? 'File URL (e.g., public CSV, JSON, XLSX link):' : `Publicly accessible share link for ${currentProviderDetails?.name} file (${currentProviderDetails?.fileTypes || '.xlsx, .json'}):`}
                    </label>
                    <Input
                        type="url"
                        id="cloudUrl"
                        value={cloudSourceUrlInput}
                        onChange={(e) => setCloudSourceUrlInput(e.target.value)}
                        placeholder={currentProviderDetails?.exampleUrl || "https://example.com/data.xlsx"}
                        className="w-full"
                        disabled={isLoading}
                    />
                     <p className="text-xs opacity-60">
                        Note: URL must be publicly accessible and allow cross-origin requests (CORS).
                    </p>
                </div>
              )}
              <Button
                  onClick={() => handleCloudConnect()}
                  variant="primary"
                  className="w-full"
                  disabled={isLoading || !selectedCloudProvider || !cloudSourceUrlInput.trim()}
                  isLoading={isLoading && currentFileSourceDetails?.type === 'cloud'}
                  leftIcon={isLoading && currentFileSourceDetails?.type === 'cloud' ? undefined : (selectedCloudProvider === 'url' ? <LinkIcon size={18} /> : <Cloud size={18} />)}
              >
                  {isLoading && currentFileSourceDetails?.type === 'cloud' ? 'Fetching & Processing...' : `Fetch & Load File from ${selectedCloudProvider ? currentProviderDetails?.name : 'Cloud'}`}
              </Button>
          </div>
        </div>


        {isLoading && (
          <div className="flex flex-col items-center justify-center my-8">
            <LoadingSpinner text={
              currentFileSourceDetails?.type === 'local' && currentFileSourceDetails.isLive
              ? "Processing live file..."
              : currentFileSourceDetails?.type === 'local'
              ? "Processing local file..."
              : "Fetching from cloud..."
            } />
          </div>
        )}

        {error && (
          <div className={`my-4 p-4 rounded-lg bg-${theme.accent4}/20 border border-${theme.accent4} text-${theme.accent4} flex items-center gap-3 ${animationClass}`}>
            <AlertTriangle size={24} />
            <span>{error}</span>
          </div>
        )}
        {successMessage && !error && (
           <div className={`my-4 p-4 rounded-lg bg-${theme.accent3}/20 border border-${theme.accent3} text-${theme.accent3} flex items-center gap-3 ${animationClass}`}>
            <CheckCircle size={24} />
            <span>{successMessage}</span>
          </div>
        )}

        {processedData && !isLoading && (
          <div className={`${theme.cardBg} p-6 rounded-xl shadow-lg border ${theme.borderColor} my-8 ${animationClass}`}>
              <div className="flex items-center mb-3">
                <Info size={24} className={`mr-3 text-${theme.accent1}`} />
                <h3 className={`text-xl font-semibold text-${theme.accent1}`}>Currently Active Data</h3>
              </div>
              <div className={`text-sm space-y-1 ${theme.textColor} opacity-90`}>
                <p><strong>File:</strong> {processedData.fileName}</p>
                {processedData.sheetName && <p><strong>Sheet:</strong> {processedData.sheetName}</p>}
                {processedData.origin?.type === 'local' && (
                  <p><strong>Source:</strong> Local Computer {processedData.origin.isLive ? <span className="text-yellow-400 text-xs ml-1">(Live Sync <Zap size={10} className="inline" />)</span> : '(Standard Upload)'}</p>
                )}
                {processedData.origin?.type === 'cloud' && <p><strong>Source:</strong> <a href={processedData.origin.url} target="_blank" rel="noopener noreferrer" className={`text-${theme.accent4} hover:underline`}>Cloud URL</a></p>}
              </div>

              {originalExcelFileDetails && originalExcelFileDetails.workbook.SheetNames.length > 1 && (
                <div className="mt-4 pt-4 border-t ${theme.borderColor}">
                  <label htmlFor="sheetSwitcher" className={`block text-sm font-medium mb-1 text-${theme.textColor}`}>
                    Switch to another sheet from "{originalExcelFileDetails.fileName}":
                  </label>
                  <select
                    id="sheetSwitcher"
                    value={processedData.sheetName || ''}
                    onChange={(e) => handleSwitchSheetViaDropdown(e.target.value)}
                    disabled={isLoading}
                    className={`${selectStyles.baseClassName} w-full p-2`}
                    style={selectStyles.style}
                  >
                    {originalExcelFileDetails.workbook.SheetNames.map(name => (
                      <option key={name} value={name} style={selectStyles.optionStyle}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
          </div>
        )}

        <Modal
          isOpen={isSheetSelectorOpen}
          onClose={() => {
              setIsSheetSelectorOpen(false);
              setCurrentWorkbookForModal(null);
              setCurrentOriginForModal(null);
              if (currentOriginForModal && !(processedData && processedData.origin &&
                  ((processedData.origin.type === 'local' && currentOriginForModal.type === 'local' && processedData.origin.file.name === currentOriginForModal.file.name) ||
                   (processedData.origin.type === 'cloud' && currentOriginForModal.type === 'cloud' && processedData.origin.url === currentOriginForModal.url)))) {
                   setOriginalExcelFileDetails(null);
              }
              setIsLoading(false);
          }}
          title="Select Sheet to Load"
        >
          <p className={`mb-4 ${theme.textColor}`}>This Excel file contains multiple sheets. Please select one:</p>
          <ul className="space-y-2 max-h-60 overflow-y-auto futuristic-scrollbar">
            {workbookSheets.map(sheetName => (
              <li key={sheetName}>
                <Button
                  variant="secondary"
                  className={`w-full justify-start ${theme.textColor} hover:bg-${theme.mediumGray}/50 focus:ring-${theme.accent1}`}
                  onClick={() => handleSheetSelectionFromModal(sheetName)}
                >
                  {sheetName}
                </Button>
              </li>
            ))}
          </ul>
        </Modal>
      </div>
    </div>
  );
};

export default ImportData;
