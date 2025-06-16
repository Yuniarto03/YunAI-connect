
import React, { useContext, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AppContext } from '../contexts/AppContext';
import { AppContextType } from '../types';
import { APP_NAME, RAW_COLOR_VALUES } from '../constants';
import { DatabaseZap, BrainCircuit, UploadCloud, BarChart2, PlayCircle, Presentation, Minimize2 } from 'lucide-react';
import Button from './shared/Button';
import FuturisticBackground from './shared/FuturisticBackground'; // Import the new component

const DashboardView: React.FC = () => {
  const { theme, reduceMotion, setIsSidebarOpen } = useContext(AppContext) as AppContextType;
  const [isPresentationMode, setIsPresentationMode] = useState(false);

  const appNameParts = APP_NAME.split(' ');
  const mainTitle = appNameParts.slice(0, Math.ceil(appNameParts.length / 2)).join(' ');
  const subTitle = appNameParts.slice(Math.ceil(appNameParts.length / 2)).join(' ');

  const infoCards = [
    {
      icon: DatabaseZap,
      title: APP_NAME,
      text: "Unlock the power of your data. Connect, analyze, visualize, and gain AI-driven insights with a futuristic edge.",
      accent: theme.accent1,
      size: 'large' as 'large',
    },
    {
      icon: BrainCircuit,
      title: "AI-Powered Insights",
      text: "Leverage cutting-edge AI for document analysis, chat assistance, and intelligent data summarization.",
      accent: theme.accent2,
    },
    {
      icon: UploadCloud,
      title: "Versatile Data Handling",
      text: "Import data from local files or cloud sources. Explore and profile your datasets with ease.",
      accent: theme.accent3,
    },
    {
      icon: BarChart2,
      title: "Dynamic Visualizations",
      text: "Create interactive charts and pivot tables to uncover trends and patterns within your data.",
      accent: theme.accent4,
    },
  ];

  const gettingStartedCard = {
    icon: PlayCircle,
    title: "Ready to Dive In?",
    text: "Begin your data journey by importing a dataset, or explore the documentation to learn more.",
    accent: theme.accent1,
    actions: [
      { label: "Import Data", path: "/import", variant: 'primary' as 'primary' },
      { label: "View Documentation", path: "/documentation", variant: 'secondary' as 'secondary'},
    ]
  };

  const bgAccent1 = RAW_COLOR_VALUES[theme.accent1] || '#00D4FF';
  const bgAccent2 = RAW_COLOR_VALUES[theme.accent2] || '#8B5CF6';
  const bgAccent3 = RAW_COLOR_VALUES[theme.accent3] || '#00FF88';
  const bgAccent4 = RAW_COLOR_VALUES[theme.accent4] || '#FF6B35';
  

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isPresentationMode) {
        setIsPresentationMode(false);
        setIsSidebarOpen(true); 
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    const event = new CustomEvent('presentationModeChange', { detail: { isActive: isPresentationMode } });
    window.dispatchEvent(event);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isPresentationMode, setIsSidebarOpen]);

  const togglePresentationMode = () => {
    const newMode = !isPresentationMode;
    setIsPresentationMode(newMode);
    setIsSidebarOpen(!newMode); 
  };

  return (
    <div className="dashboard-view-wrapper h-full w-full relative overflow-hidden flex items-center justify-center p-4">
      <FuturisticBackground theme={theme} reduceMotion={reduceMotion} />
      
      <div className={`dashboard-content relative z-10 w-full ${isPresentationMode ? 'max-w-full h-full' : 'max-w-5xl'} mx-auto ${isPresentationMode ? 'p-0 md:p-8' : ''}`}>
        {!isPresentationMode && (
            <div className="absolute top-0 right-0 mt-2 mr-2 z-20">
                <Button onClick={togglePresentationMode} variant="secondary" size="sm" leftIcon={<Presentation size={16}/>}>
                    Presentation Mode
                </Button>
            </div>
        )}
        {isPresentationMode && (
            <div className="absolute top-4 right-4 z-20">
                <Button onClick={togglePresentationMode} variant="primary" size="sm" leftIcon={<Minimize2 size={16}/>}>
                    Exit Presentation
                </Button>
            </div>
        )}

        {!isPresentationMode && (
            <div className="text-center mb-12">
            <h1 
                className="text-5xl md:text-7xl font-extrabold mb-3 bg-clip-text text-transparent"
                style={{
                    backgroundImage: `linear-gradient(to right, ${bgAccent1}, ${bgAccent2})`,
                    textShadow: `0 0 15px ${bgAccent1}77, 0 0 25px ${bgAccent2}55`
                }}
            >
                {mainTitle}
            </h1>
            <h2 
                className="text-4xl md:text-6xl font-bold bg-clip-text text-transparent"
                style={{
                    backgroundImage: `linear-gradient(to right, ${bgAccent3}, ${bgAccent4})`,
                    textShadow: `0 0 10px ${bgAccent3}55, 0 0 20px ${bgAccent4}33`
                }}
            >
                {subTitle}
            </h2>
            <p className={`mt-6 text-lg md:text-xl ${theme.textColor} opacity-80 max-w-3xl mx-auto`}>
                {infoCards.find(card => card.size === 'large')?.text || "Your advanced data connectivity and AI insights platform."}
            </p>
            </div>
        )}

        <div className={`grid grid-cols-1 ${isPresentationMode ? 'md:grid-cols-2 lg:grid-cols-3' : 'md:grid-cols-3'} gap-6 mb-10 ${isPresentationMode ? 'mt-16' : ''}`}>
          {infoCards.filter(card => card.size !== 'large' || isPresentationMode).map((card, index) => (
            <div 
              key={index} 
              className={`
                ${isPresentationMode ? 'bg-slate-800/70 backdrop-blur-sm' : theme.cardBg} p-6 rounded-xl shadow-xl border ${isPresentationMode ? 'border-slate-700' : theme.borderColor} text-left
                relative overflow-hidden group
                ${!reduceMotion ? `transition-all duration-300 ease-out hover:shadow-neon-glow-${card.accent} ${!isPresentationMode ? 'hover:-translate-y-1.5' : 'hover:scale-105'}` : ''}
              `}
            >
              <div 
                className="absolute inset-0 opacity-10 group-hover:opacity-20 transition-opacity duration-500" 
                style={{ 
                    backgroundImage: `radial-gradient(circle at 10% 10%, ${RAW_COLOR_VALUES[card.accent]}1A 0%, transparent 50%)`,
                }}
              />
              <div className="relative z-10">
                <div className={`mb-3 inline-flex items-center justify-center p-3 rounded-lg bg-${card.accent}/20 text-${card.accent}`}>
                  <card.icon size={28} strokeWidth={2}/>
                </div>
                <h3 className={`text-xl font-semibold mb-2 text-${card.accent}`}>{card.title}</h3>
                <p className={`text-sm ${isPresentationMode ? 'text-slate-300' : theme.textColor} opacity-80`}>{card.text}</p>
              </div>
            </div>
          ))}
        </div>
        
        <div 
            className={`
                ${isPresentationMode ? 'bg-slate-800/70 backdrop-blur-sm' : theme.cardBg} p-8 rounded-2xl shadow-2xl border ${isPresentationMode ? 'border-slate-700' : theme.borderColor} text-center
                relative overflow-hidden group
                 ${!reduceMotion ? `transition-all duration-300 ease-out hover:shadow-neon-glow-${gettingStartedCard.accent}` : ''}
            `}
        >
             <div 
                className="absolute inset-0 opacity-5 group-hover:opacity-10 transition-opacity duration-500" 
                style={{ 
                    backgroundImage: `radial-gradient(ellipse at center, ${RAW_COLOR_VALUES[gettingStartedCard.accent]}0D 0%, transparent 70%)`,
                }}
              />
            <div className="relative z-10">
                <div className={`mb-4 inline-flex items-center justify-center p-4 rounded-full bg-${gettingStartedCard.accent}/20 text-${gettingStartedCard.accent}`}>
                    <gettingStartedCard.icon size={36} strokeWidth={2}/>
                </div>
                <h3 className={`text-2xl font-semibold mb-3 text-${gettingStartedCard.accent}`}>{gettingStartedCard.title}</h3>
                <p className={`text-md ${isPresentationMode ? 'text-slate-300' : theme.textColor} opacity-85 mb-6 max-w-md mx-auto`}>{gettingStartedCard.text}</p>
                <div className="flex flex-col sm:flex-row justify-center items-center gap-3 sm:gap-4">
                    {gettingStartedCard.actions.map(action => (
                         <Button
                            key={action.label}
                            variant={action.variant}
                            size="md"
                            className="w-full sm:w-auto px-8"
                            onClick={() => (window as any).location.hash = action.path} 
                          >
                           {action.label}
                        </Button>
                    ))}
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardView;
