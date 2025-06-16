
import React, { useContext, useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'; // Import useLocation
import Dock from './components/Dock';
import ImportData from './components/ImportData';
import DataTableComponent from './components/DataTable';
import DataVisualization from './components/DataVisualization';
import AiDocument from './components/AiDocument';
import FileLibrary from './components/FileLibrary';
import Settings from './components/Settings';
import Chatbot from './components/Chatbot';
import DataSummary from './components/DataSummary';
import { PivotTable } from './components/PivotTable';
import DocumentationPage from './components/DocumentationPage';
// Clock component import removed
import DashboardView from './components/DashboardView';
import MilestonePlanner from './components/MilestonePlanner'; 
import DashboardReport from './components/DashboardReport';
import { AppContext } from './contexts/AppContext';
import { AppContextType } from './types';
import { RAW_COLOR_VALUES } from './constants';
import { MessageSquare } from 'lucide-react';
import ScrollToTop from './components/shared/ScrollToTop';

// New internal component to manage layout and route rendering with a key
const AppContentLayout: React.FC = () => {
  const { theme, apiKey, reduceMotion } = useContext(AppContext) as AppContextType;
  const [isChatbotOpen, setIsChatbotOpen] = useState(false);
  const [isChatbotMaximized, setIsChatbotMaximized] = useState(false);
  // isPresentationModeActiveForClock state removed

  useEffect(() => {
    const handleOpenChatbot = () => setIsChatbotOpen(true);
    window.addEventListener('open-chatbot' as any, handleOpenChatbot);

    // Event listener for presentationModeChange removed as Clock is no longer here
    // If other components need this, it should be handled separately.

    return () => {
      window.removeEventListener('open-chatbot' as any, handleOpenChatbot);
      // Cleanup for presentationModeChange listener removed
    }
  }, []);

  useEffect(() => {
    const bodyClassColor = theme.textColor.startsWith('text-') ? theme.textColor : `text-${theme.textColor}`;
    const bodyClassBg = theme.contentBg.startsWith('bg-') ? theme.contentBg : `bg-${theme.contentBg}`;

    if (reduceMotion) {
      document.body.classList.add('no-motion');
    } else {
      document.body.classList.remove('no-motion');
    }
    document.body.className = `${bodyClassColor} ${bodyClassBg} futuristic-scrollbar ${document.body.classList.contains('no-motion') ? 'no-motion' : ''}`.trim();

    const rootStyle = document.documentElement.style;
    rootStyle.setProperty('--futuristic-scrollbar-thumb', RAW_COLOR_VALUES[theme.accent2] || '#8B5CF6');
    rootStyle.setProperty('--futuristic-scrollbar-thumb-hover', RAW_COLOR_VALUES[theme.accent1] || '#00D4FF');
    rootStyle.setProperty('--futuristic-scrollbar-track', RAW_COLOR_VALUES[theme.darkGray] || '#1E293B');
  }, [theme, reduceMotion]);

  if (!apiKey) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center ${theme.contentBg} ${theme.textColor} p-4`}>
        <div className={`${theme.cardBg} p-8 rounded-lg shadow-xl border ${theme.borderColor}`}>
          <h1 className={`text-3xl font-bold text-${theme.accent1} mb-4`}>API Key Required</h1>
          <p className="mb-4">
            The Gemini API Key is not configured. Please ensure the <code>process.env.API_KEY</code>
            is set in your environment or configured in <code>index.html</code> for this application to function.
          </p>
          <p className={`text-sm text-${theme.accent4}/80`}>
            Refer to the application setup instructions for more details.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-screen overflow-hidden ${theme.contentBg}`}>
      <main
        className={`flex-1 overflow-y-auto futuristic-scrollbar relative`}
        style={{ paddingBottom: 'var(--dock-height)' }}
        id="main-content-area"
      >
        {/* Clock component rendering removed */}
        <Routes> 
          <Route path="/" element={<DashboardView />} />
          <Route path="/import" element={<ImportData />} />
          <Route path="/table" element={<DataTableComponent />} />
          <Route path="/summary" element={<DataSummary />} />
          <Route path="/table-summary" element={<PivotTable />} />
          <Route path="/milestones" element={<MilestonePlanner />} /> 
          <Route path="/visualize" element={<DataVisualization />} />
          <Route path="/dashboard-report" element={<DashboardReport />} />
          <Route path="/ai-document" element={<AiDocument />} />
          <Route path="/library" element={<FileLibrary />} />
          <Route path="/documentation" element={<DocumentationPage />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>

      <Dock />

      {!isChatbotOpen && (
        <button
          onClick={() => setIsChatbotOpen(true)}
          className={`fixed bottom-[calc(var(--dock-height)_+_2rem)] right-8 p-4 rounded-full bg-gradient-to-br from-${theme.accent1} to-${theme.accent2} text-white shadow-xl ${!reduceMotion ? 'hover:scale-110 transition-transform duration-300 animate-pulse-fast' : ''} z-50`}
          aria-label="Open Chatbot"
          style={{ color: RAW_COLOR_VALUES[theme.darkBg] || '#0A0F1E' }}
        >
          <MessageSquare size={28} />
        </button>
      )}

      {isChatbotOpen && (
        <Chatbot
          isOpen={isChatbotOpen}
          onClose={() => setIsChatbotOpen(false)}
          isMaximized={isChatbotMaximized}
          onToggleMaximize={() => setIsChatbotMaximized(!isChatbotMaximized)}
        />
      )}
    </div>
  );
};

const App: React.FC = () => {
  // Main App component is now simpler
  return (
    <HashRouter>
      <ScrollToTop />
      <AppContentLayout /> {/* Render the new layout component */}
    </HashRouter>
  );
};

export default App;
