import React, { createContext, useContext, useState, useEffect } from 'react';

interface SettingsContextType {
  isFocusMode: boolean;
  toggleFocusMode: () => void;
  // Optional screen sections & tabs customization
  showPerformanceAnalytics: boolean;
  setShowPerformanceAnalytics: (val: boolean) => void;
  showQuickFinancialCard: boolean;
  setShowQuickFinancialCard: (val: boolean) => void;
  showNextClassCountdown: boolean;
  setShowNextClassCountdown: (val: boolean) => void;
  showLibraryTab: boolean;
  setShowLibraryTab: (val: boolean) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isFocusMode, setIsFocusMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('sanad_focus_mode') === 'true';
  });

  // Performance analytics (charts/graphs on home) - default FALSE to prevent crowding
  const [showPerformanceAnalytics, setShowPerformanceAnalyticsState] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const saved = localStorage.getItem('sanad_pref_performance_analytics');
    return saved === 'true'; // Default clean: false
  });

  const setShowPerformanceAnalytics = (val: boolean) => {
    setShowPerformanceAnalyticsState(val);
    if (typeof window !== 'undefined') {
      localStorage.setItem('sanad_pref_performance_analytics', String(val));
    }
  };

  // Quick Financial Card on Home screen - default true
  const [showQuickFinancialCard, setShowQuickFinancialCardState] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const saved = localStorage.getItem('sanad_pref_quick_financial');
    return saved !== 'false';
  });

  const setShowQuickFinancialCard = (val: boolean) => {
    setShowQuickFinancialCardState(val);
    if (typeof window !== 'undefined') {
      localStorage.setItem('sanad_pref_quick_financial', String(val));
    }
  };

  // Next Class Countdown on Home screen - default true
  const [showNextClassCountdown, setShowNextClassCountdownState] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const saved = localStorage.getItem('sanad_pref_countdown');
    return saved !== 'false';
  });

  const setShowNextClassCountdown = (val: boolean) => {
    setShowNextClassCountdownState(val);
    if (typeof window !== 'undefined') {
      localStorage.setItem('sanad_pref_countdown', String(val));
    }
  };

  // Educational Library Tab in Bottom Navigation - default true
  const [showLibraryTab, setShowLibraryTabState] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const saved = localStorage.getItem('sanad_pref_library_tab');
    return saved !== 'false';
  });

  const setShowLibraryTab = (val: boolean) => {
    setShowLibraryTabState(val);
    if (typeof window !== 'undefined') {
      localStorage.setItem('sanad_pref_library_tab', String(val));
    }
  };

  const toggleFocusMode = () => {
    setIsFocusMode((prev) => {
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
    <SettingsContext.Provider
      value={{
        isFocusMode,
        toggleFocusMode,
        showPerformanceAnalytics,
        setShowPerformanceAnalytics,
        showQuickFinancialCard,
        setShowQuickFinancialCard,
        showNextClassCountdown,
        setShowNextClassCountdown,
        showLibraryTab,
        setShowLibraryTab,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) throw new Error('useSettings must be used within a SettingsProvider');
  return context;
};
