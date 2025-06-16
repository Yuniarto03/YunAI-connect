

import React, { useContext } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { AppContextType } from '../../types';
import { RAW_COLOR_VALUES } from '../../constants';

// Augment CSSProperties to include custom properties used in this component
declare module 'react' {
  interface CSSProperties {
    '--placeholder-color'?: string;
  }
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  // any custom props if needed
}

const Input: React.FC<InputProps> = ({ className = '', style, ...props }) => {
  const { theme } = useContext(AppContext) as AppContextType;

  const baseStyles = `
    p-2 rounded-md border text-sm
    focus:outline-none focus:ring-1 
    transition-colors duration-200 ease-in-out
    disabled:opacity-60 disabled:cursor-not-allowed
  `;
  
  const placeholderColor = RAW_COLOR_VALUES[theme.textColor.replace('text-','')] || '#E0E0E0';
  const placeholderOpacity = '80'; 
  
  const dynamicStyles: React.CSSProperties = {
    backgroundColor: RAW_COLOR_VALUES[theme.darkGray] || '#1E293B',
    color: RAW_COLOR_VALUES[theme.textColor.replace('text-','')] || '#E0E0E0',
    borderColor: RAW_COLOR_VALUES[theme.mediumGray] || '#333F58',
    '--placeholder-color': `${placeholderColor}${placeholderOpacity}`
  };

  const themeFocusStyles = `focus:ring-${theme.accent1} focus:border-${theme.accent1}`;

  return (
    <input
      className={`${baseStyles} ${themeFocusStyles} ${className}`}
      style={{ ...dynamicStyles, ...style }}
      {...props}
    />
  );
};

export default Input;