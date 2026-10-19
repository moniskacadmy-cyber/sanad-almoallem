import React from 'react';
import { useTheme } from '../context/ThemeContext';

interface CardProps {
  title: string;
  description: string;
  children?: React.ReactNode;
  className?: string;
}

export const AdaptiveCard: React.FC<CardProps> = ({ title, description, children, className = '' }) => {
  const { isDark } = useTheme();

  return (
    <div className={`p-5 rounded-2xl border transition-all duration-200 ${
      isDark 
        ? 'bg-slate-900 border-slate-800 text-slate-100 shadow-lg shadow-black/40' 
        : 'bg-white border-slate-200 text-slate-900 shadow-md'
    } ${className}`}>
      {/* العنوان واضح في الوضعين */}
      <h3 className={`font-bold text-base ${isDark ? 'text-white' : 'text-slate-900'}`}>
        {title}
      </h3>
      
      {/* النص الفرعي واضح وغير باهت */}
      <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
        {description}
      </p>
      
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
};
