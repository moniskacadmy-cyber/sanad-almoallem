import React, { useState } from 'react';
import { usePWAInstall } from './usePWAInstall';
import { Download, Smartphone, X } from 'lucide-react';

export const PWAInstallButton: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already running as an installed PWA, hide the button
  if (isInstalled) {
    return null;
  }

  // Chromium / Android / Desktop flow
  if (isInstallable) {
    return (
      <button
        onClick={install}
        className={
          compact
            ? "flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow hover:from-purple-500 hover:to-indigo-500 transition active:scale-95 cursor-pointer"
            : "w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-purple-900/30 hover:brightness-110 active:scale-98 transition cursor-pointer"
        }
      >
        <Download className={compact ? "w-3.5 h-3.5" : "w-4 h-4"} />
        <span>تثبيت التطبيق على هاتفك</span>
      </button>
    );
  }

  // iOS Safari flow
  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className={
            compact
              ? "flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-purple-950/60 border border-purple-500/30 text-purple-300 hover:bg-purple-900/50 transition cursor-pointer"
              : "w-full flex items-center justify-center gap-2 rounded-xl border border-purple-500/40 bg-purple-950/50 px-4 py-3 text-sm font-semibold text-purple-200 hover:bg-purple-900/60 transition cursor-pointer"
          }
        >
          <Smartphone className={compact ? "w-3.5 h-3.5" : "w-4 h-4 text-purple-400"} />
          <span>تثبيت على آيفون / آيباد</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950  p-4">
            <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-purple-500/30 p-5 shadow-2xl text-right">
              <div className="flex items-center justify-between border-b border-purple-900/50 pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <Smartphone className="w-5 h-5 text-purple-400" />
                  <h3 className="text-base font-bold text-white">طريقة التثبيت على الآيفون</h3>
                </div>
                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <ol className="space-y-3 text-xs leading-relaxed text-slate-300">
                <li className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-purple-600/30 text-purple-300 flex items-center justify-center text-xs font-bold">1</span>
                  <span>افتح هذا الموقع في متصفح <strong>Safari</strong> على جهازك.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-purple-600/30 text-purple-300 flex items-center justify-center text-xs font-bold">2</span>
                  <span>اضغط على زر المشاركة <strong>Share</strong> (الأيقونة ذات السهم للأعلى في أسفل الشاشة).</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-purple-600/30 text-purple-300 flex items-center justify-center text-xs font-bold">3</span>
                  <span>مرر للأسفل واختر <strong>"إضافة إلى الصفحة الرئيسية" (Add to Home Screen)</strong>.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-purple-600/30 text-purple-300 flex items-center justify-center text-xs font-bold">4</span>
                  <span>اضغط <strong>"إضافة" (Add)</strong> وسيعمل التطبيق كبرنامج أصلي بدون شريط المتصفح!</span>
                </li>
              </ol>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full rounded-xl bg-purple-600 py-2.5 text-xs font-bold text-white hover:bg-purple-500 transition cursor-pointer"
              >
                فهمت ذلك
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
