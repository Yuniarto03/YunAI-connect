
import React, { useContext } from 'react';
import { AppContext } from '../contexts/AppContext';
import { AppContextType, ThemeName, ExportFormat, ExportFormatOption, Theme } from '../types';
import Button from './shared/Button';
import { Palette, Sun, Moon, Monitor, Info, Sparkles, CheckCircle, Bell, FileDown, Settings as SettingsIconLucide, Accessibility, VenetianMask, AlertTriangle } from 'lucide-react'; 
import { RAW_COLOR_VALUES, EXPORT_FORMAT_OPTIONS } from '../constants';
import { getSharedSelectBaseStyles } from '../utils'; // Import shared utility

const Settings: React.FC = () => {
  const { 
    theme, setTheme, availableThemes, apiKey,
    enableNotifications, setEnableNotifications,
    defaultExportFormat, setDefaultExportFormat,
    autoProfileOnLoad, setAutoProfileOnLoad,
    reduceMotion, setReduceMotion
  } = useContext(AppContext) as AppContextType;

  // Retrieve the user's actual selection for highlighting "System Default" correctly
  const storedUserThemeName = localStorage.getItem('appUserThemeName') as ThemeName | null;
  const currentUserSelection = storedUserThemeName || theme.name;

  const displayableThemes: Theme[] = Object.values(availableThemes).filter(
    (t: Theme) => t.name !== ThemeName.SYSTEM_DEFAULT
  );
  const systemDefaultThemeAvailable: Theme | undefined = availableThemes[ThemeName.SYSTEM_DEFAULT];

  const selectBaseStyles = getSharedSelectBaseStyles(theme);

  const ToggleSwitch: React.FC<{
    id: string;
    label: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
    Icon?: React.ElementType;
  }> = ({ id, label, checked, onChange, Icon }) => (
    <div className="flex items-center justify-between py-3 border-b ${theme.borderColor} border-opacity-50 last:border-b-0">
      <label htmlFor={id} className="flex items-center text-sm cursor-pointer">
        {Icon && <Icon size={18} className={`mr-3 text-${theme.accent4}`} />}
        {label}
      </label>
      <button
        id={id}
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`
          relative inline-flex items-center h-6 rounded-full w-11 transition-colors duration-200 ease-in-out
          focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-${theme.cardBg.replace('bg-','')} focus:ring-${theme.accent1}
          ${checked ? `bg-${theme.accent1}` : `bg-${theme.mediumGray}`}
        `}
      >
        <span
          className={`
            inline-block w-4 h-4 transform bg-white rounded-full transition-transform duration-200 ease-in-out
            ${checked ? 'translate-x-6' : 'translate-x-1'}
          `}
        />
      </button>
    </div>
  );


  return (
    <div className={`p-8 ${theme.textColor} futuristic-scrollbar overflow-auto h-full`}>
      <h1 className={`text-4xl font-bold mb-8 bg-clip-text text-transparent bg-gradient-to-r from-${theme.accent1} to-${theme.accent2}`}>Settings</h1>

      {/* Theme Selection */}
      <div className={`${theme.cardBg} p-6 rounded-xl shadow-xl border ${theme.borderColor} mb-8`}>
        <div className="flex items-center mb-6">
          <Palette size={28} className={`mr-3 text-${theme.accent3}`} />
          <h2 className={`text-2xl font-semibold text-${theme.accent3}`}>Application Theme</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {systemDefaultThemeAvailable && (
            <button
              key={ThemeName.SYSTEM_DEFAULT}
              onClick={() => setTheme(ThemeName.SYSTEM_DEFAULT)}
              className={`
                p-4 rounded-lg border-2 transition-all duration-200 ease-in-out relative
                ${currentUserSelection === ThemeName.SYSTEM_DEFAULT ? `border-${theme.accent1} shadow-neon-glow-${theme.accent1} ${!reduceMotion ? 'scale-105' : ''}` : `${theme.borderColor} hover:border-${theme.accent2}`}
                focus:outline-none focus:ring-2 focus:ring-${theme.accent1} focus:ring-offset-2 focus:ring-offset-${theme.contentBg.replace('bg-','')}
                flex flex-col items-center justify-center
              `}
              style={{ backgroundColor: RAW_COLOR_VALUES[systemDefaultThemeAvailable.cardBg.replace('bg-','').split('/')[0]] || RAW_COLOR_VALUES[systemDefaultThemeAvailable.darkGray] }} 
            >
              <div className="flex items-center justify-center mb-2">
                <Sun size={20} className="text-yellow-400" />
                <Moon size={20} className="text-sky-400 ml-1" />
              </div>
              <p className={`font-semibold text-sm mb-1 ${theme.textColor}`}>System Default</p>
              <p className={`text-xs ${theme.textColor} opacity-70`}>Follows OS Light/Dark Mode</p>
              {currentUserSelection === ThemeName.SYSTEM_DEFAULT && (
                  <div className={`absolute -top-2 -right-2 p-1 bg-${theme.accent1} rounded-full shadow-md`}>
                      <CheckCircle size={16} className="text-white" style={{ color: RAW_COLOR_VALUES[theme.darkBg] || '#0A0F1E'}} />
                  </div>
              )}
            </button>
          )}
          {displayableThemes.map((t) => (
            <button
              key={t.name}
              onClick={() => setTheme(t.name)}
              className={`
                p-4 rounded-lg border-2 transition-all duration-200 ease-in-out relative
                ${currentUserSelection === t.name ? `border-${theme.accent1} shadow-neon-glow-${theme.accent1} ${!reduceMotion ? 'scale-105' : ''}` : `${theme.borderColor} hover:border-${theme.accent2}`}
                focus:outline-none focus:ring-2 focus:ring-${theme.accent1} focus:ring-offset-2 focus:ring-offset-${theme.contentBg.replace('bg-','')}
                flex flex-col items-center justify-center
              `}
              style={{ backgroundColor: RAW_COLOR_VALUES[t.cardBg.replace('bg-','').split('/')[0]] || RAW_COLOR_VALUES[t.darkGray] }} 
            >
              <div className="w-full h-8 mb-2 rounded flex items-center justify-around px-2" style={{ background: `linear-gradient(to right, ${RAW_COLOR_VALUES[t.accent1]}, ${RAW_COLOR_VALUES[t.accent2]}, ${RAW_COLOR_VALUES[t.accent3]})` }}>
                <span className="text-xs font-bold" style={{ color: RAW_COLOR_VALUES[theme.darkBg] || '#0A0F1E' }}>Aa</span>
              </div>
              <p className={`font-semibold text-sm mb-1 ${theme.textColor}`}>{t.name}</p>
              {currentUserSelection === t.name && (
                  <div className={`absolute -top-2 -right-2 p-1 bg-${theme.accent1} rounded-full shadow-md`}>
                      <CheckCircle size={16} className="text-white" style={{ color: RAW_COLOR_VALUES[theme.darkBg] || '#0A0F1E'}}/>
                  </div>
              )}
            </button>
          ))}
        </div>
      </div>
      
      {/* General Settings */}
      <div className={`${theme.cardBg} p-6 rounded-xl shadow-xl border ${theme.borderColor} mb-8`}>
        <div className="flex items-center mb-4">
          <SettingsIconLucide size={28} className={`mr-3 text-${theme.accent1}`} />
          <h2 className={`text-2xl font-semibold text-${theme.accent1}`}>Preferences</h2>
        </div>
        <div className="divide-y ${theme.borderColor}">
            <ToggleSwitch 
              id="enableNotifications"
              label="Enable In-App Notifications"
              checked={enableNotifications}
              onChange={setEnableNotifications}
              Icon={Bell}
            />
            <div className="flex items-center justify-between py-3 border-b ${theme.borderColor} border-opacity-50 last:border-b-0">
                <label htmlFor="defaultExportFormat" className="flex items-center text-sm">
                    <FileDown size={18} className={`mr-3 text-${theme.accent4}`} />
                    Default Export Format
                </label>
                <select
                    id="defaultExportFormat"
                    value={defaultExportFormat}
                    onChange={(e) => setDefaultExportFormat(e.target.value as ExportFormat)}
                    className={`${selectBaseStyles.baseClassName} w-auto max-w-[180px] text-xs py-1.5`}
                    style={selectBaseStyles.style}
                >
                    {EXPORT_FORMAT_OPTIONS.map((opt: ExportFormatOption) => (
                        <option key={opt.value} value={opt.value} style={selectBaseStyles.optionStyle}>{opt.label}</option>
                    ))}
                </select>
            </div>
             <ToggleSwitch 
              id="autoProfileOnLoad"
              label="Automatically Profile Data on Load"
              checked={autoProfileOnLoad}
              onChange={setAutoProfileOnLoad}
              Icon={VenetianMask} 
            />
        </div>
      </div>

      {/* Accessibility Settings */}
       <div className={`${theme.cardBg} p-6 rounded-xl shadow-xl border ${theme.borderColor} mb-8`}>
        <div className="flex items-center mb-4">
          <Accessibility size={28} className={`mr-3 text-${theme.accent2}`} />
          <h2 className={`text-2xl font-semibold text-${theme.accent2}`}>Accessibility</h2>
        </div>
        <div className="divide-y ${theme.borderColor}">
             <ToggleSwitch 
              id="reduceMotion"
              label="Reduce Animations & Motion Effects"
              checked={reduceMotion}
              onChange={setReduceMotion}
              Icon={Sparkles}
            />
        </div>
      </div>


      {/* API Key Information */}
      <div className={`${theme.cardBg} p-6 rounded-xl shadow-xl border ${theme.borderColor} mb-8`}>
        <div className="flex items-center mb-4">
            <Info size={28} className={`mr-3 text-${theme.accent1}`} />
            <h2 className={`text-2xl font-semibold text-${theme.accent1}`}>API Information</h2>
        </div>
        {apiKey ? (
          <div className={`p-4 rounded-lg bg-${theme.accent3}/20 border border-${theme.accent3} text-sm`}>
            <div className="flex items-center">
              <CheckCircle size={20} className={`mr-2 text-${theme.accent3}`} />
              <p className={`text-${theme.accent3} font-semibold`}>Gemini API Key is configured and active.</p>
            </div>
            <p className="mt-1 text-xs opacity-80">
              The API Key is loaded from the application's environment (<code>process.env.API_KEY</code>). It cannot be changed from within the application.
            </p>
          </div>
        ) : (
          <div className={`p-4 rounded-lg bg-${theme.accent4}/20 border border-${theme.accent4} text-sm`}>
            <div className="flex items-center">
              <AlertTriangle size={20} className={`mr-2 text-${theme.accent4}`} />
              <p className={`text-${theme.accent4} font-semibold`}>Gemini API Key not found.</p>
            </div>
            <p className="mt-1 text-xs opacity-80">
              Please ensure <code>process.env.API_KEY</code> is set in your hosting environment or <code>index.html</code> for the application to function correctly with AI features.
            </p>
          </div>
        )}
      </div>

    </div>
  );
};

export default Settings;
