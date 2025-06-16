

import React, { useContext, useEffect } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { AppContextType } from '../../types';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, size = 'md' }) => {
  const { theme, reduceMotion } = useContext(AppContext) as AppContextType;

  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
    }
    return () => {
      document.removeEventListener('keydown', handleEsc);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    full: 'max-w-[98vw] max-h-[95vh] w-full h-full', // Adjusted for "almost full screen"
  };
  
  const contentPadding = size === 'full' ? 'p-2 md:p-4' : 'p-6';
  const animationClass = reduceMotion ? '' : 'animate-fade-in';


  return (
    <div 
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 ${animationClass}`}
      onClick={onClose}
    >
      <div
        className={`
          ${theme.cardBg} ${theme.textColor} border ${theme.borderColor} rounded-xl shadow-2xl 
          ${sizeClasses[size]} flex flex-col overflow-hidden
          transform ${!reduceMotion ? 'transition-all duration-300 ease-out scale-95 group-hover:scale-100' : ''}
          ${size !== 'full' ? 'max-h-[90vh]' : ''} 
        `}
        onClick={(e) => e.stopPropagation()} // Prevent click through to backdrop
      >
        <div className={`flex items-center justify-between p-4 border-b ${theme.borderColor}`}>
          <h2 className={`text-xl font-semibold text-${theme.accent1}`}>{title}</h2>
          <button
            onClick={onClose}
            className={`p-1 rounded-full hover:bg-${theme.mediumGray} text-${theme.textColor.replace('text-','')} hover:text-${theme.accent1} transition-colors`}
            aria-label="Close modal"
          >
            <X size={24} />
          </button>
        </div>
        <div className={`${contentPadding} overflow-y-auto futuristic-scrollbar flex-grow`}> {/* Added flex-grow for full size content */}
          {children}
        </div>
      </div>
    </div>
  );
};

export default Modal;