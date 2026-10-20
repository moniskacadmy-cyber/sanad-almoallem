import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface CollapsibleSectionProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

export const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  description,
  icon,
  children,
  defaultOpen = false,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const { isDark } = useTheme();

  return (
    <div className={`rounded-2xl p-4 border transition-all duration-300 ${
      isDark 
        ? 'bg-slate-900 border-slate-800' 
        : 'bg-white border-slate-100 shadow-sm'
    }`}>
      <div 
        className="flex justify-between items-center cursor-pointer select-none" 
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-3">
          {icon && (
            <div className={`p-2.5 rounded-xl ${
              isDark ? 'bg-purple-900/30 text-purple-400' : 'bg-purple-50 text-purple-600'
            }`}>
              {icon}
            </div>
          )}
          <div>
            <h3 className={`font-bold text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {title}
            </h3>
            {description && (
              <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {description}
              </p>
            )}
          </div>
        </div>
        
        <button 
          className={`w-8 h-8 flex items-center justify-center rounded-full transition-transform duration-300 ${
            isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-50 text-slate-500'
          }`}
          style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >
          <ChevronDown className="w-4 h-4" />
        </button>
      </div>

      {isOpen && (
        <div className={`mt-4 pt-4 border-t transition-opacity duration-300 ${
          isDark ? 'border-slate-700' : 'border-slate-100'
        }`}>
          {children}
        </div>
      )}
    </div>
  );
};
