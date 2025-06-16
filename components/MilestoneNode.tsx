
import React, { useState, useContext } from 'react';
import { Milestone, AppContextType } from '../types';
import { AppContext } from '../contexts/AppContext';
import { Calendar, Info, CheckCircle, Zap, Settings, Briefcase, AlertOctagon, BookOpen, Users, PenTool, Code, FlaskConical, Rocket, ClipboardList, Eye, Landmark, Server, MessageSquare, Search as SearchIconLucide } from 'lucide-react';
import { RAW_COLOR_VALUES } from '../constants';
// Removed Button import as "View Details" is removed.

export const MILESTONE_CATEGORIES = {
  GENERAL: { icon: CheckCircle, colorKey: 'accent1', label: 'General' },
  DESIGN: { icon: PenTool, colorKey: 'accent2', label: 'Design' },
  DEVELOPMENT: { icon: Code, colorKey: 'accent3', label: 'Development' },
  TESTING: { icon: FlaskConical, colorKey: 'accent4', label: 'Testing' },
  DEPLOYMENT: { icon: Rocket, colorKey: 'pink-500', label: 'Deployment' },
  MEETING: { icon: Users, colorKey: 'cyan-400', label: 'Meeting' },
  DOCUMENTATION: { icon: BookOpen, colorKey: 'amber-500', label: 'Documentation' },
  URGENT: { icon: AlertOctagon, colorKey: 'red-500', label: 'Urgent' },
  RESEARCH: { icon: SearchIconLucide, colorKey: 'lime-500', label: 'Research' },
  PLANNING: { icon: ClipboardList, colorKey: 'sky-500', label: 'Planning'},
  REVIEW: { icon: Eye, colorKey: 'violet-500', label: 'Review'},
  FINANCE: { icon: Landmark, colorKey: 'emerald-500', label: 'Finance'},
  INFRASTRUCTURE: { icon: Server, colorKey: 'slate-500', label: 'Infrastructure'},
  CLIENT_FEEDBACK: { icon: MessageSquare, colorKey: 'teal-400', label: 'Client Feedback'},
  DATABASE: { icon: Zap, colorKey: 'matrix-green', label: 'Database' }, 
  USER: { icon: Users, colorKey: 'cyber-purple', label: 'User Related' }, 
  SECURITY: { icon: AlertOctagon, colorKey: 'red-500', label: 'Security' }, 
  MOBILE: { icon: Zap, colorKey: 'tech-orange', label: 'Mobile' }, 
  SETTINGS: { icon: Settings, colorKey: 'slate-500', label: 'Settings/Config' },
  OTHER: { icon: Briefcase, colorKey: 'medium-gray', label: 'Other' }, 
};
export type MilestoneCategoryKey = keyof typeof MILESTONE_CATEGORIES;

interface MilestoneNodeProps {
  milestone: Milestone;
  positionStyle: React.CSSProperties; 
  isAboveAxis: boolean;
  connectorColor: string; 
  onViewDetails: (milestone: Milestone) => void; // Kept for potential future use, but button is removed
}


const MilestoneNode: React.FC<MilestoneNodeProps> = ({ milestone, positionStyle, isAboveAxis, connectorColor, onViewDetails }) => {
  const { theme, reduceMotion } = useContext(AppContext) as AppContextType;
  const [showTooltip, setShowTooltip] = useState(false);

  let displayCategoryKey: MilestoneCategoryKey = (milestone.category?.toUpperCase() as MilestoneCategoryKey) || 'GENERAL';
  if (!MILESTONE_CATEGORIES[displayCategoryKey]) { 
    displayCategoryKey = 'OTHER';
  }

  const categoryInfo = MILESTONE_CATEGORIES[displayCategoryKey];
  const IconComponent = categoryInfo.icon;
  const NodeIcon = typeof IconComponent === 'function' ? IconComponent : CheckCircle;
  
  const nodeColorHex = connectorColor; 
  const themedTextColor = theme.textColor; 
  const themedDateColorHex = RAW_COLOR_VALUES[theme.accent1]; 

  const animationClass = reduceMotion ? '' : 'transition-all duration-300 ease-out';

  const formatDateForDisplay = (isoDate: string): string => {
    try {
      const dateObj = new Date(isoDate);
      const year = dateObj.getUTCFullYear();
      const month = dateObj.getUTCMonth(); 
      let season = '';
      if (month >= 2 && month <= 4) season = 'Spring'; 
      else if (month >= 5 && month <= 7) season = 'Summer'; 
      else if (month >= 8 && month <= 10) season = 'Fall';  
      else season = 'Winter'; 
      return `${season} ${year}`;
    } catch (e) {
      return isoDate; 
    }
  };

  const formattedDateString = formatDateForDisplay(milestone.date);

  return (
    <div
      className={`absolute flex flex-col items-center group ${animationClass} hover:z-20`}
      style={positionStyle}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {showTooltip && (
        <div
          className={`absolute ${isAboveAxis ? 'bottom-full mb-3' : 'top-full mt-3'} w-64 p-3 rounded-md shadow-lg text-xs z-50
                     ${theme.cardBg} border ${theme.borderColor} ${themedTextColor} ${animationClass}
                     opacity-0 group-hover:opacity-100 transform group-hover:translate-y-0 ${isAboveAxis ? '-translate-y-2' : 'translate-y-2'}`}
        >
          <p className="font-bold mb-1" style={{ color: nodeColorHex }}>{milestone.title}</p>
          <p className="mb-1"><Calendar size={12} className="inline mr-1 opacity-70" /> {milestone.date}</p>
          {milestone.description && (
            <p className="mb-1 text-ellipsis overflow-hidden whitespace-nowrap" title={milestone.description}>
              <Info size={12} className="inline mr-1 opacity-70" />
              {milestone.description}
            </p>
          )}
          {milestone.value && (
            <p className="mb-1">
              <Zap size={12} className="inline mr-1 opacity-70" />
              Value: <span className={`font-semibold`} style={{ color: nodeColorHex }}>{milestone.value}</span>
            </p>
          )}
          {milestone.category && (
            <p className="mb-1">
              <NodeIcon size={12} className="inline mr-1 opacity-70" />
              Category: {categoryInfo.label}
            </p>
          )}
          {/* Sub-task count removed */}
          {milestone.durationFromPrevious && <p className="text-[10px] opacity-80">From Prev: {milestone.durationFromPrevious}</p>}
          {milestone.durationFromStart && <p className="text-[10px] opacity-80">From Start: {milestone.durationFromStart}</p>}
          <p className={`text-[10px] opacity-60 mt-1`}>Source: {milestone.source}</p>
           {/* "View Details" button removed */}
        </div>
      )}

      <div
        className="absolute w-0.5"
        style={{
          height: '30px', 
          backgroundColor: nodeColorHex, 
          left: '50%',
          transform: 'translateX(-50%)',
          ...(isAboveAxis ? { bottom: 'calc(100% - 20px)' } : { top: 'calc(100% - 20px)' }), 
          zIndex: 1,
        }}
      ></div>
      
      <div
        className={`w-10 h-10 rounded-full flex items-center justify-center cursor-pointer
                   border-2 ${animationClass} group-hover:scale-110 group-hover:shadow-md relative z-10`}
        style={{
          borderColor: nodeColorHex, 
          backgroundColor: RAW_COLOR_VALUES[theme.contentBg.replace('bg-','')] || '#FFFFFF', 
          order: isAboveAxis ? 2 : 1, 
        }}
      >
        <NodeIcon size={20} style={{ color: nodeColorHex }} />
      </div>

      <div 
        className={`text-center mt-2 px-1 w-40 ${animationClass} ${themedTextColor}`} 
        style={{ order: isAboveAxis ? 1 : 2 }} 
      >
        {formattedDateString !== "Summer 2025" && (
          <p className={`text-xs font-semibold`} style={{color: themedDateColorHex}}>{formattedDateString}</p>
        )}
        <p className={`text-sm font-bold mt-0.5`}>{milestone.title}</p>
        {milestone.description && (
            <p className={`text-xs mt-0.5 opacity-80`} style={{ WebkitLineClamp: 2, display: '-webkit-box', WebkitBoxOrient: 'vertical', overflow: 'hidden'}}>
                {milestone.description}
            </p>
        )}
        {/* Sub-task count display removed */}
      </div>
    </div>
  );
};

export default MilestoneNode;
export { MILESTONE_CATEGORIES as DefaultMilestoneCategories };
export type { MilestoneCategoryKey as DefaultMilestoneCategoryKey };
