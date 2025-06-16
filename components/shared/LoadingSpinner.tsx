

import React, { useContext } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { AppContextType } from '../../types';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ size = 'md', text }) => {
  const { theme } = useContext(AppContext) as AppContextType;

  const sizeClasses = {
    sm: 'w-6 h-6 border-2',
    md: 'w-10 h-10 border-4',
    lg: 'w-16 h-16 border-[6px]',
  };

  return (
    <div className="flex flex-col items-center justify-center space-y-2">
      <div 
        className={`
          ${sizeClasses[size]} rounded-full animate-spin
          border-${theme.accent1} border-t-transparent
        `}
        style={{ borderTopColor: 'transparent' }} /* Tailwind JIT might struggle with this sometimes */
      ></div>
      {text && <p className={`text-sm ${theme.textColor} italic`}>{text}</p>}
    </div>
  );
};

export default LoadingSpinner;