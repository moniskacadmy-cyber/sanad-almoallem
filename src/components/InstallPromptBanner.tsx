import React, { useState } from 'react';
import { X } from 'lucide-react';
import { usePWAInstall } from '../usePWAInstall';
import { PWAInstallButton } from '../PWAInstallButton';

const DISMISS_KEY = 'sanad_install_banner_dismissed_at';
const DISMISS_DAYS = 7;

function recentlyDismissed(): boolean {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY) || 0);
    return at > 0 && Date.now() - at < DISMISS_DAYS * 86400_000;
  } catch {
    return false;
  }
}

/**
 * One clear step for every new user: install the app to the home screen. An installed app is what makes
 * phone notifications reliable (and is the ONLY way they work on iPhone). Hidden once installed / inside the Android app.
 */
export const InstallPromptBanner: React.FC<{ signedIn: boolean }> = ({ signedIn }) => {
  const { isInstalled, isInstallable, isIOS } = usePWAInstall();
  const [hidden, setHidden] = useState(recentlyDismissed);

  const inNativeApp = typeof window !== 'undefined' && !!(window as any).SanadAndroid;
  if (!signedIn || isInstalled || hidden || inNativeApp) return null;

  const dismiss = () => {
    setHidden(true);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="mx-4 mt-3 rounded-2xl border border-purple-500/40 bg-purple-950/50 p-3 space-y-2 text-right relative" dir="rtl">
      <button type="button" onClick={dismiss} aria-label="إخفاء" className="absolute left-2 top-2 p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer">
        <X className="w-4 h-4" />
      </button>
      <p className="text-xs font-extrabold text-purple-100 pl-6">📲 ثبّت التطبيق على موبايلك — أسهل وأسرع، وإشعارات الحصص بتوصلك أحسن</p>
      <PWAInstallButton />
      {!isInstallable && !isIOS && (
        <p className="text-[11px] text-purple-200/80 leading-relaxed">
          من قايمة المتصفح (⋮) اختار <b>"تثبيت التطبيق"</b> أو <b>"إضافة إلى الشاشة الرئيسية"</b>. ولو فاتح من جوه تطبيق (فيسبوك/واتساب)، افتح اللينك في Chrome الأول.
        </p>
      )}
      {isIOS && (
        <p className="text-[11px] text-purple-200/80 leading-relaxed">
          على الآيفون الإشعارات مش بتشتغل غير بعد التثبيت، ولازم تفتح من Safari.
        </p>
      )}
    </div>
  );
};
