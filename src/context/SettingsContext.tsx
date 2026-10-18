import React, { createContext, useContext, useState, useEffect } from 'react';

interface SettingsContextType {
  isFocusMode: boolean;
  toggleFocusMode: () => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isFocusMode, setIsFocusMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('sanad_focus_mode');
    return saved === 'true';
  });

  const toggleFocusMode = () => {
    setIsFocusMode(prev => {
      const next = !prev;
      localStorage.setItem('sanad_focus_mode', String(next));
      return next;
    });
  };

  useEffect(() => {
    if (isFocusMode) {
      document.documentElement.classList.add('focus-mode');
    } else {
      document.documentElement.classList.remove('focus-mode');
    }
  }, [isFocusMode]);

  return (
    <SettingsContext.Provider value={{ isFocusMode, toggleFocusMode }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) throw new Error('useSettings must be used within a SettingsProvider');
  return context;
};
