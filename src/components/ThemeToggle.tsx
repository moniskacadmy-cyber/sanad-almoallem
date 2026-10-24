import React from 'react';
import { Sun, Moon, Check } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface ThemeToggleProps {
  className?: string;
}

/**
 * Compact icon button for header or quick bar
 */
export const ThemeToggleCompact: React.FC<ThemeToggleProps> = ({ className = '' }) => {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`relative p-1.5 rounded-xl transition-all cursor-pointer border ${
        isDark
          ? 'bg-purple-900/40 hover:bg-purple-800/60 border-purple-500/30 text-amber-300'
          : 'bg-amber-100 hover:bg-amber-200 border-amber-300 text-amber-700 shadow-sm'
      } active:scale-95 ${className}`}
      title={isDark ? 'التبديل إلى الوضع الفاتح (النهاري)' : 'التبديل إلى الوضع الداكن (الليلي)'}
      aria-label="تبديل مظهر التطبيق"
    >
      {isDark ? (
        <Sun className="w-4 h-4 transition-transform duration-300 rotate-0 hover:rotate-45" />
      ) : (
        <Moon className="w-4 h-4 transition-transform duration-300 -rotate-12 hover:rotate-0" />
      )}
    </button>
  );
};

/**
 * Prominent segmented toggle for Sidebar
 */
export const ThemeSidebarToggle: React.FC<ThemeToggleProps> = ({ className = '' }) => {
  const { theme, setTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <div
      className={`p-2 rounded-2xl border transition-all ${
        isDark
          ? 'bg-purple-950/40 border-purple-900/40'
          : 'bg-slate-100 border-slate-200 shadow-sm'
      } ${className}`}
    >
      <div className="flex items-center justify-between mb-1.5 px-1">
        <span
          className={`text-[11px] font-bold ${
            isDark ? 'text-purple-300' : 'text-slate-700'
          }`}
        >
          مظهر التطبيق
        </span>
        <span
          className={`text-[10px] font-semibold ${
            isDark ? 'text-purple-400' : 'text-slate-500'
          }`}
        >
          {isDark ? 'داكن 🌙' : 'فاتح ☀️'}
        </span>
      </div>
      <div
        className={`grid grid-cols-3 p-1 rounded-xl gap-1 text-xs font-bold ${
          isDark ? 'bg-slate-900/90' : 'bg-slate-200/80'
        }`}
      >
        <button
          type="button"
          onClick={() => setTheme('light')}
          className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg transition-all cursor-pointer ${
            theme === 'light'
              ? 'bg-white text-amber-600 shadow-sm font-black'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sun className="w-3.5 h-3.5 text-amber-500" />
          <span>فاتح</span>
        </button>
        <button
          type="button"
          onClick={() => setTheme('system')}
          className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg transition-all cursor-pointer ${
            theme === 'system'
              ? 'bg-slate-700 text-white shadow-sm font-black'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <span className="text-[10px]">تلقائي</span>
        </button>
        <button
          type="button"
          onClick={() => setTheme('dark')}
          className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg transition-all cursor-pointer ${
            theme === 'dark'
              ? 'bg-purple-600 text-white shadow-sm font-black'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Moon className="w-3.5 h-3.5 text-amber-300" />
          <span>داكن</span>
        </button>
      </div>
    </div>
  );
};

/**
 * Rich interactive card for SettingsTab
 */
export const ThemeSettingsSection: React.FC = () => {
  const { theme, setTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <div
      className={`rounded-2xl border p-4 space-y-3 transition-all ${
        isDark
          ? 'bg-slate-900/80 border-purple-500/20 shadow-md'
          : 'bg-white border-slate-200 shadow-sm'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className={`w-8 h-8 rounded-xl flex items-center justify-center border transition-colors ${
              isDark
                ? 'bg-purple-900/40 border-purple-500/30 text-purple-300'
                : 'bg-amber-100 border-amber-300 text-amber-700'
            }`}
          >
            {isDark ? <Moon className="w-4 h-4 text-amber-300" /> : <Sun className="w-4 h-4 text-amber-600" />}
          </div>
          <div>
            <h3
              className={`text-sm font-bold ${
                isDark ? 'text-white' : 'text-slate-900'
              }`}
            >
              مظهر التطبيق (الوضع الداكن والفاتح)
            </h3>
            <p
              className={`text-xs ${
                isDark ? 'text-slate-400' : 'text-slate-500'
              }`}
            >
              اختر المظهر الأنسب لراحتك البصرية أثناء استخدام المنصة
            </p>
          </div>
        </div>

        <span
          className={`text-[11px] px-2.5 py-0.5 rounded-full font-bold border ${
            isDark
              ? 'bg-purple-950/80 border-purple-500/40 text-purple-300'
              : 'bg-amber-50 border-amber-300 text-amber-700'
          }`}
        >
          {isDark ? 'الوضع الليلي مفعّل 🌙' : 'الوضع النهاري مفعّل ☀️'}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
        {/* Light Mode Card */}
        <button
          type="button"
          onClick={() => setTheme('light')}
          className={`p-3 rounded-xl border text-right transition-all cursor-pointer flex items-start gap-3 relative ${
            !isDark
              ? 'bg-amber-50/70 border-amber-400 ring-2 ring-amber-400/30 shadow-sm'
              : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-300'
          }`}
        >
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center border flex-shrink-0 ${
              !isDark
                ? 'bg-white border-amber-300 text-amber-600 shadow-sm'
                : 'bg-slate-900 border-slate-700 text-slate-400'
            }`}
          >
            <Sun className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <span
                className={`text-xs font-bold ${
                  !isDark ? 'text-slate-900' : 'text-slate-200'
                }`}
              >
                الوضع الفاتح (النهاري)
              </span>
              {!isDark && (
                <span className="flex items-center gap-1 text-[10px] text-amber-700 font-bold bg-amber-200/60 px-1.5 py-0.5 rounded-md">
                  <Check className="w-3 h-3 text-amber-700" />
                  مُفعّل
                </span>
              )}
            </div>
            <p
              className={`text-[11px] mt-0.5 leading-snug ${
                !isDark ? 'text-slate-600' : 'text-slate-400'
              }`}
            >
              خلفية ناصعة ومريحة للقراءة في الإضاءة القوية والعمل أثناء النهار
            </p>
          </div>
        </button>

        {/* Dark Mode Card */}
        <button
          type="button"
          onClick={() => setTheme('dark')}
          className={`p-3 rounded-xl border text-right transition-all cursor-pointer flex items-start gap-3 relative ${
            isDark
              ? 'bg-purple-950/50 border-purple-500 ring-2 ring-purple-500/30 shadow-sm'
              : 'bg-slate-50 border-slate-200 hover:border-slate-300 text-slate-700'
          }`}
        >
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center border flex-shrink-0 ${
              isDark
                ? 'bg-purple-900/80 border-purple-400 text-amber-300 shadow-sm'
                : 'bg-slate-200 border-slate-300 text-slate-600'
            }`}
          >
            <Moon className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <span
                className={`text-xs font-bold ${
                  isDark ? 'text-white' : 'text-slate-900'
                }`}
              >
                الوضع الداكن (الليلي)
              </span>
              {isDark && (
                <span className="flex items-center gap-1 text-[10px] text-purple-200 font-bold bg-purple-900/60 px-1.5 py-0.5 rounded-md">
                  <Check className="w-3 h-3 text-amber-300" />
                  مُفعّل
                </span>
              )}
            </div>
            <p
              className={`text-[11px] mt-0.5 leading-snug ${
                isDark ? 'text-purple-200/80' : 'text-slate-500'
              }`}
            >
              ألوان هادئة داكنة مريحة للعين في الإضاءة الخافتة وتساعد في توفير بطارية الهاتف
            </p>
          </div>
        </button>
      </div>
    </div>
  );
};
