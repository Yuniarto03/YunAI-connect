

import React, { useContext } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { AppContextType } from '../../types';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  isLoading?: boolean;
}

const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  leftIcon,
  rightIcon,
  isLoading = false,
  className = '',
  ...props
}) => {
  const { theme } = useContext(AppContext) as AppContextType;

  const baseStyles = `
    font-semibold rounded-lg transition-all duration-200 ease-in-out 
    focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-${theme.contentBg.replace('bg-','')}
    flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed
    shadow-md hover:shadow-lg
  `;

  const sizeStyles = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  const variantStyles = {
    primary: `
      bg-gradient-to-br from-${theme.accent1} to-${theme.accent2} text-white 
      hover:from-${theme.accent1}/90 hover:to-${theme.accent2}/90
      focus:ring-${theme.accent1}
      border border-transparent
      shadow-neon-glow-${theme.accent1} hover:shadow-neon-glow-${theme.accent2}
    `,
    secondary: `
      ${theme.cardBg} ${theme.textColor} border ${theme.borderColor}
      hover:bg-${theme.mediumGray} hover:border-${theme.accent1} hover:text-${theme.accent1}
      focus:ring-${theme.accent1}
    `,
    danger: `
      bg-red-500 text-white hover:bg-red-600 focus:ring-red-500
      border border-transparent
      shadow-md hover:shadow-red-500/50
    `,
    ghost: `
      bg-transparent ${theme.textColor} hover:bg-${theme.accent1}/20 hover:text-${theme.accent1}
      focus:ring-${theme.accent1}
    `,
  };

  return (
    <button
      className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      disabled={isLoading || props.disabled}
      {...props}
    >
      {isLoading && (
        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      )}
      {leftIcon && !isLoading && <span>{leftIcon}</span>}
      {children}
      {rightIcon && !isLoading && <span>{rightIcon}</span>}
    </button>
  );
};

export default Button;