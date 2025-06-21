
import React, { useContext, useState, useEffect, useRef } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Dock from './components/Dock';
import ImportData from './components/ImportData';
import DataTableComponent from './components/DataTable';
import DataVisualization from './components/DataVisualization'; // This line is correct if DataVisualization is default exported
import AiDocument from './components/AiDocument';
import FileLibrary from './components/FileLibrary';
import Settings from './components/Settings';
import Chatbot from './components/Chatbot';
import DataSummary from './components/DataSummary';
import { PivotTable } from './components/PivotTable'; 
import DocumentationPage from './components/DocumentationPage';
import DashboardView from './components/DashboardView';
import MilestonePlanner from './components/MilestonePlanner'; 
import DashboardReport from './components/DashboardReport';
import WhiteboardPage from './components/WhiteboardPage'; 
import RoutePlannerPage from './components/RoutePlannerPage'; // Added RoutePlannerPage import
import { AppContext } from './contexts/AppContext';
import { AppContextType } from './types';
import { RAW_COLOR_VALUES } from './constants';
import { MessageSquare } from 'lucide-react';
import ScrollToTop from './components/shared/ScrollToTop';
import LoadAndRedirect from './components/LoadAndRedirect';
import LoadSessionAndRedirect from './components/LoadSessionAndRedirect';

const AppContentLayout: React.FC = () => {
  const { theme, apiKey, reduceMotion } = useContext(AppContext) as AppContextType;
  const [isChatbotOpen, setIsChatbotOpen] = useState(false);
  const [isChatbotMaximized, setIsChatbotMaximized] = useState(false);
  
  const location = useLocation();
  const [animationState, setAnimationState] = useState<'idle' | 'exiting' | 'entering'>('idle');
  const [currentPathForAnimation, setCurrentPathForAnimation] = useState(location.pathname);
  const [gridAnimationClass, setGridAnimationClass] = useState('');

  useEffect(() => {
    const handleOpenChatbot = () => setIsChatbotOpen(true);
    window.addEventListener('open-chatbot' as any, handleOpenChatbot);
    return () => window.removeEventListener('open-chatbot' as any, handleOpenChatbot);
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
  
  useEffect(() => {
    // Check if it's a genuine path change and not just state update for the same path, and ensure not already transitioning
    if (location.pathname !== currentPathForAnimation && animationState === 'idle') {
      setAnimationState('exiting');
      setGridAnimationClass('grid-exit-active'); // Start grid exit animation

      const exitTimer = setTimeout(() => {
        setCurrentPathForAnimation(location.pathname); // This is when actual content should change
        setAnimationState('entering');
        setGridAnimationClass('grid-enter-active'); // Start grid enter animation

        const enterTimer = setTimeout(() => {
          setAnimationState('idle');
          setGridAnimationClass(''); // Clear grid animation
        }, 700); // Duration of enter animation
        return () => clearTimeout(enterTimer);
      }, 700); // Duration of exit animation
      return () => clearTimeout(exitTimer);
    }
  }, [location.pathname, currentPathForAnimation, animationState]);


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
  
  let mainContentAreaClasses = `flex-1 overflow-y-auto futuristic-scrollbar relative`;
  if (animationState === 'exiting') mainContentAreaClasses += ' page-exit-active';
  if (animationState === 'entering') mainContentAreaClasses += ' page-enter-active';
  
  const gridColorVar = RAW_COLOR_VALUES[theme.accent1] || '#00D4FF';

  return (
    <div className={`flex h-screen overflow-hidden ${theme.contentBg}`}>
      <div className="flex-1 flex flex-col overflow-hidden">
        <main
          className={mainContentAreaClasses}
          style={{ 
            paddingBottom: 'var(--dock-height)',
            '--grid-color': gridColorVar 
          } as React.CSSProperties}
          id="main-content-area"
        >
          {(animationState === 'exiting' || animationState === 'entering') && (
            <div className={`page-transition-grid-overlay ${gridAnimationClass}`}></div>
          )}
          <div key={currentPathForAnimation}> {/* This div gets re-keyed to swap content */}
            <Routes> 
              <Route path="/" element={<DashboardView />} />
              <Route path="/import" element={<ImportData />} />
              <Route path="/table" element={<DataTableComponent />} />
              <Route path="/summary" element={<DataSummary />} />
              <Route path="/table-summary" element={<PivotTable />} />
              <Route path="/route-planner" element={<RoutePlannerPage />} /> {/* Added RoutePlannerPage route */}
              <Route path="/milestones" element={<MilestonePlanner />} /> 
              <Route path="/whiteboard" element={<WhiteboardPage />} />
              <Route path="/visualize" element={<DataVisualization />} />
              <Route path="/dashboard-report" element={<DashboardReport />} />
              <Route path="/ai-document" element={<AiDocument />} />
              <Route path="/library" element={<FileLibrary />} />
              <Route path="/documentation" element={<DocumentationPage />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/load-from-library/:fileId" element={<LoadAndRedirect />} />
              <Route path="/load-session-and-redirect/:sessionId" element={<LoadSessionAndRedirect />} />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </div>
        </main>

        <Dock />
      </div>

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
  return (
    <HashRouter>
      <ScrollToTop />
      <AppContentLayout />
    </HashRouter>
  );
};

export default App;
