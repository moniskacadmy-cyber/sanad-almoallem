import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';

export type ThemeMode = 'dark' | 'light' | 'system';

interface ThemeContextType {
  theme: ThemeMode;
  toggleTheme: () => void;
  setTheme: (theme: ThemeMode) => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const THEME_STORAGE_KEY = 'sanad_theme';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode | null;
      if (saved === 'dark' || saved === 'light' || saved === 'system') {
        return saved;
      }
    }
    return 'system'; // Default to system theme
  });

  const [isSystemDark, setIsSystemDark] = useState(() => {
    return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      setIsSystemDark(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const isDark = useMemo(() => {
    if (theme === 'system') return isSystemDark;
    return theme === 'dark';
  }, [theme, isSystemDark]);

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const root = document.documentElement;
    const body = document.body;
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');

    if (isDark) {
      root.classList.add('dark');
      root.classList.remove('light');
      body.classList.add('dark');
      body.classList.remove('light');
      root.setAttribute('data-theme', 'dark');
      if (metaThemeColor) {
        metaThemeColor.setAttribute('content', '#070314');
      }
    } else {
      root.classList.remove('dark');
      root.classList.add('light');
      body.classList.remove('dark');
      body.classList.add('light');
      root.setAttribute('data-theme', 'light');
      if (metaThemeColor) {
        metaThemeColor.setAttribute('content', '#f8fafc');
      }
    }

    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Storage might be disabled in private mode
    }
  }, [isDark, theme]);

  const setTheme = (newTheme: ThemeMode) => {
    setThemeState(newTheme);
  };

  const toggleTheme = () => {
    setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
