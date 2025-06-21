
import React, { useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppContext } from '../contexts/AppContext';
import { AppContextType, SavedFileEntry } from '../types';
import Button from './shared/Button';
import { HardDrive, FileText, Database, CalendarDays, Trash2, Eye, AlertCircle, ExternalLink, Globe } from 'lucide-react';

const FileLibrary: React.FC = () => {
  const { theme, savedFiles, deleteFileFromLibrary, loadDataFromLibrary, reduceMotion } = useContext(AppContext) as AppContextType;
  const navigate = useNavigate();

  const handleLoadFile = (fileId: string) => {
    loadDataFromLibrary(fileId);
    navigate('/table'); 
  };

  const handleLoadInNewContext = (fileId: string, newWindow: boolean = false) => {
    const url = `${window.location.origin}${window.location.pathname}#/load-from-library/${fileId}`;
    if (newWindow) {
      window.open(url, '_blank', 'width=1200,height=800,resizable,scrollbars');
    } else {
      window.open(url, '_blank');
    }
  };
  
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className={`p-8 ${theme.textColor} futuristic-scrollbar overflow-auto h-full`}>
      <div className="flex justify-between items-center mb-8">
        <h1 className={`text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-${theme.accent1} to-${theme.accent2}`}>File Library</h1>
        <div className="flex items-center space-x-2">
          <HardDrive size={24} className={`text-${theme.accent3}`} />
          <span className="text-sm opacity-80">{savedFiles.length} file(s) stored locally</span>
        </div>
      </div>

      {savedFiles.length === 0 ? (
        <div className={`${theme.cardBg} p-10 rounded-xl shadow-xl border ${theme.borderColor} text-center`}>
          <Database size={60} className={`mx-auto mb-6 text-${theme.accent4} opacity-50`} />
          <h2 className="text-2xl font-semibold mb-3">Your Library is Empty</h2>
          <p className="opacity-70">Save processed data from the 'Data Table' section to store it here for later use.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {savedFiles.map((file: SavedFileEntry) => (
            <div key={file.id} className={`${theme.cardBg} p-5 rounded-xl shadow-xl border ${theme.borderColor} flex flex-col justify-between ${!reduceMotion ? `hover:shadow-neon-glow-${theme.accent1} transition-shadow duration-300` : ''}`}>
              <div>
                <div className="flex items-center mb-3">
                  <FileText size={28} className={`mr-3 text-${theme.accent1}`} />
                  <h3 className={`text-xl font-semibold truncate text-${theme.accent2}`} title={file.fileName}>
                    {file.fileName}
                  </h3>
                </div>
                {file.sheetName && (
                  <p className="text-xs opacity-70 mb-1">Sheet: {file.sheetName}</p>
                )}
                <div className="text-sm space-y-1 opacity-80 mb-4">
                  <p><strong className={`text-${theme.accent3}`}>Rows:</strong> {file.data.length}</p>
                  <p><strong className={`text-${theme.accent3}`}>Columns:</strong> {file.headers.length}</p>
                  <p><strong className={`text-${theme.accent3}`}>Size:</strong> {formatFileSize(file.fileSize)}</p>
                  <div className="flex items-center">
                     <CalendarDays size={14} className={`mr-1.5 text-${theme.accent4}`} />
                     <strong className={`text-${theme.accent4}`}>Saved:</strong> {new Date(file.savedAt).toLocaleString()}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-auto pt-3 border-t ${theme.borderColor} border-opacity-50">
                <Button onClick={() => handleLoadFile(file.id)} variant="primary" size="sm" className="w-full" leftIcon={<Eye size={16}/>}>
                  Load Here
                </Button>
                 <Button onClick={() => deleteFileFromLibrary(file.id)} variant="danger" size="sm" className="w-full" leftIcon={<Trash2 size={16}/>}>
                  Delete
                </Button>
                 <Button onClick={() => handleLoadInNewContext(file.id, false)} variant="secondary" size="sm" className="w-full !text-xs" leftIcon={<ExternalLink size={14}/>}>
                  New Tab
                </Button>
                <Button onClick={() => handleLoadInNewContext(file.id, true)} variant="secondary" size="sm" className="w-full !text-xs" leftIcon={<Globe size={14}/>}>
                  New Window
                </Button>
              </div>
               <div className={`absolute top-2 right-2 p-1.5 bg-${theme.accent1}/20 rounded-full shadow-lg ${!reduceMotion ? 'animate-pulse-fast' : ''}`}>
                  <AlertCircle size={12} className={`text-${theme.accent1}`} />
                </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FileLibrary;
