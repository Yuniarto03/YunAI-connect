
import React, { useContext, useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { AppContext } from '../contexts/AppContext';
import { AppContextType, ThemeName } from '../types';
import { NAVIGATION_ITEMS, APP_NAME, RAW_COLOR_VALUES } from '../constants';
import { DatabaseZap, Clock as ClockIcon } from 'lucide-react';

const Dock: React.FC = () => {
  const { theme, reduceMotion } = useContext(AppContext) as AppContextType;
  const location = useLocation();
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timerId = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timerId);
  }, []);

  const dockBgColor = RAW_COLOR_VALUES[theme.cardBg.replace(/bg-([a-z0-9-]+).*/, '$1')] || RAW_COLOR_VALUES[theme.darkGray];
  const textColor = RAW_COLOR_VALUES[theme.textColor.replace('text-', '')] || '#E0E0E0';
  const accent1Color = RAW_COLOR_VALUES[theme.accent1] || '#00D4FF';
  const accent2Color = RAW_COLOR_VALUES[theme.accent2] || '#8B5CF6';

  const appNameParts = APP_NAME.split(' ');
  const mainTitle = appNameParts[0]; 
  const subTitle = appNameParts.slice(1).join(' ');

  const formattedTime = currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const formattedDate = currentTime.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });

  let clockTextColorClass = theme.textColor;
   if (theme.name === ThemeName.SILVER_TECH || theme.name === ThemeName.PURE_LIGHT) {
    clockTextColorClass = 'text-slate-700';
  } else if (theme.name === ThemeName.PURE_DARK) {
    clockTextColorClass = 'text-slate-300';
  }


  return (
    <nav 
      className={`
        fixed bottom-0 left-1/2 -translate-x-1/2 
        mb-3 px-3 py-2.5 
        rounded-2xl shadow-2xl border
        flex items-center justify-center space-x-1
      `}
      style={{
        backgroundColor: `${dockBgColor}BF`, 
        borderColor: `${RAW_COLOR_VALUES[theme.accent1]}4D`, 
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        minWidth: `${Math.min(80 * (NAVIGATION_ITEMS.length + 2), window.innerWidth - 40)}px`, // Adjusted for logo and clock
        maxWidth: '95vw',
        height: 'var(--dock-height)',
      }}
      role="navigation"
      aria-label="Main application navigation"
    >
      <div className="flex items-center mr-3 pr-3 border-r border-white/10">
        <div 
            className={`w-8 h-8 rounded-md flex items-center justify-center shadow-inner`}
            style={{ background: `linear-gradient(to bottom right, ${accent1Color}, ${accent2Color})` }}
          >
            <DatabaseZap size={18} className="text-white" />
        </div>
        <div className="ml-2 hidden sm:block">
            <h2 className="text-xs font-bold leading-tight" style={{ color: accent1Color }}>
              {mainTitle}
            </h2>
            <h3 className="text-[10px] font-semibold leading-tight" style={{color: accent2Color }}>
              {subTitle || "Analytics"}
            </h3>
        </div>
      </div>

      {/* Clock Display */}
      <div className={`flex items-center space-x-2 px-2 py-1 rounded-lg bg-[${RAW_COLOR_VALUES[theme.darkGray]}]/30 border border-transparent hover:border-[${accent1Color}]/30 transition-colors`}>
        <ClockIcon size={20} style={{ color: accent1Color }} />
        <div className={`text-right ${clockTextColorClass.replace('text-','')}`} style={{color: RAW_COLOR_VALUES[clockTextColorClass.replace('text-','')] || textColor}}>
          <p className="text-xs font-medium tabular-nums whitespace-nowrap">{formattedTime}</p>
          <p className="text-[10px] opacity-80 whitespace-nowrap">{formattedDate}</p>
        </div>
      </div>
      <div className="w-px h-6 bg-white/10 mx-1.5"></div> {/* Divider */}


      {NAVIGATION_ITEMS.map((navItem) => {
        const isActive = location.pathname === navItem.path;
        return (
          <div 
            key={navItem.name} 
            className="relative group"
            onMouseEnter={() => setHoveredItem(navItem.name)}
            onMouseLeave={() => setHoveredItem(null)}
          >
            <div 
              className={`
                absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 
                bg-black/80 text-white text-xs rounded-md shadow-lg
                whitespace-nowrap
                pointer-events-none 
                ${!reduceMotion ? 'transition-all duration-200 ease-out' : ''}
                ${hoveredItem === navItem.name ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1'}
              `}
              role="tooltip"
            >
              {navItem.name}
              <div className="absolute bottom-[-4px] left-1/2 -translate-x-1/2 w-2 h-2 bg-black/80 transform rotate-45"></div>
            </div>

            <NavLink
              to={navItem.path}
              title={navItem.name}
              className={({ isActive: navIsActive }) => `
                flex flex-col items-center justify-center p-1.5 rounded-lg 
                w-11 h-11 
                ${!reduceMotion ? 'transition-all duration-200 ease-out transform group-hover:scale-125 group-hover:-translate-y-1.5' : ''}
                focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-transparent focus:ring-${theme.accent1}
              `}
              style={{
                color: isActive ? accent1Color : textColor,
              }}
            >
              <navItem.icon size={24} strokeWidth={isActive ? 2.5 : 2} />
              {isActive && (
                <div 
                  className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: accent1Color }}
                />
              )}
            </NavLink>
          </div>
        );
      })}
    </nav>
  );
};

export default Dock;
