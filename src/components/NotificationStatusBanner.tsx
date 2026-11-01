import React, { useCallback, useEffect, useState } from 'react';
import { BellOff, BellRing, RefreshCw } from 'lucide-react';
import { requestAndSaveFCMToken } from '../firebase';

type Status = 'checking' | 'ok' | 'default' | 'denied' | 'unsupported' | 'not_registered';

function readPermission(): Status {
  const native = typeof window !== 'undefined' ? (window as any).SanadAndroid : undefined;
  if (native && typeof native.hasNotificationPermission === 'function') {
    try {
      return native.hasNotificationPermission() ? 'ok' : 'denied';
    } catch {
      return 'denied';
    }
  }
  if (typeof Notification === 'undefined') return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  if (Notification.permission === 'default') return 'default';
  return 'ok';
}

/**
 * Visible warning when phone notifications cannot work: blocked by the browser/OS, never allowed,
 * unsupported (e.g. iPhone Safari outside the installed app), or allowed but this device is not registered.
 */
export const NotificationStatusBanner: React.FC<{ signedIn: boolean }> = ({ signedIn }) => {
  const [status, setStatus] = useState<Status>('checking');
  const [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState('');
  const [hidden, setHidden] = useState(false);

  const verify = useCallback(async () => {
    const perm = readPermission();
    if (perm !== 'ok') {
      setStatus(perm);
      return;
    }
    try {
      const r = await requestAndSaveFCMToken(false);
      if (r.success) {
        setStatus('ok');
        setDetail('');
      } else {
        setStatus(r.error === 'preview_url' ? 'ok' : 'not_registered');
        setDetail(r.error || '');
      }
    } catch (e: any) {
      setStatus('not_registered');
      setDetail(e?.message || '');
    }
  }, []);

  useEffect(() => {
    if (!signedIn) return;
    void verify();
    // Re-check when the teacher comes back from the browser / phone settings.
    const onVisible = () => {
      if (document.visibilityState === 'visible') void verify();
    };
    document.addEventListener('visibilitychange', onVisible);
    let permStatus: PermissionStatus | null = null;
    try {
      navigator.permissions
        ?.query({ name: 'notifications' as PermissionName })
        .then((p) => {
          permStatus = p;
          p.onchange = () => void verify();
        })
        .catch(() => {});
    } catch {
      /* not supported */
    }
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      if (permStatus) permStatus.onchange = null;
    };
  }, [signedIn, verify]);

  const enable = async () => {
    setBusy(true);
    try {
      const r = await requestAndSaveFCMToken(true);
      setDetail(r.success ? '' : r.error || '');
    } finally {
      setBusy(false);
      void verify();
    }
  };

  if (!signedIn || hidden || status === 'checking' || status === 'ok') return null;

  const base = 'mx-4 mt-3 rounded-2xl border p-3 text-right space-y-2';

  if (status === 'denied') {
    return (
      <div className={`${base} bg-rose-950/60 border-rose-500/50`} dir="rtl" role="alert">
        <div className="flex items-center gap-2 text-rose-200 text-xs font-extrabold">
          <BellOff className="w-4 h-4" />
          <span>الإشعارات متقفلة على جهازك — مش هتوصلك تذكيرات الحصص</span>
        </div>
        <ol className="text-[11px] text-rose-100/90 leading-relaxed list-decimal pr-5 space-y-0.5">
          <li>اضغط على 🔒 (أو ⓘ) جنب اللينك فوق ← إعدادات الموقع.</li>
          <li>غيّر "الإشعارات" لـ "سماح".</li>
          <li>على الأندرويد كمان: إعدادات الهاتف ← التطبيقات ← (Chrome أو سند المعلم) ← الإشعارات ← شغّلها.</li>
          <li>ارجع للتطبيق — هيتعرف لوحده.</li>
        </ol>
        <button type="button" onClick={() => void verify()} className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-bold cursor-pointer">
          خلصت، افحص تاني
        </button>
      </div>
    );
  }

  if (status === 'default') {
    return (
      <div className={`${base} bg-amber-950/50 border-amber-500/50`} dir="rtl" role="alert">
        <div className="flex items-center gap-2 text-amber-200 text-xs font-extrabold">
          <BellRing className="w-4 h-4" />
          <span>فعّل الإشعارات عشان توصلك تذكيرات الحصص حتى والتطبيق مقفول</span>
        </div>
        <button type="button" disabled={busy} onClick={enable} className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-slate-900 text-[11px] font-black cursor-pointer">
          {busy ? 'جارٍ التفعيل...' : 'تفعيل الإشعارات 🔔'}
        </button>
      </div>
    );
  }

  if (status === 'unsupported') {
    return (
      <div className={`${base} bg-amber-950/50 border-amber-500/50`} dir="rtl" role="alert">
        <div className="text-amber-200 text-xs font-extrabold">المتصفح ده مش بيدعم إشعارات الهاتف</div>
        <p className="text-[11px] text-amber-100/90 leading-relaxed">
          على الآيفون: افتح اللينك في Safari ← زرار المشاركة ← "إضافة إلى الشاشة الرئيسية"، وافتح التطبيق من الأيقونة وفعّل الإشعارات. على الأندرويد استخدم Chrome أو تطبيق سند المعلم.
        </p>
        <button type="button" onClick={() => setHidden(true)} className="text-[11px] font-bold text-amber-300 cursor-pointer">إخفاء</button>
      </div>
    );
  }

  return (
    <div className={`${base} bg-orange-950/50 border-orange-500/50`} dir="rtl" role="alert">
      <div className="flex items-center gap-2 text-orange-200 text-xs font-extrabold">
        <RefreshCw className="w-4 h-4" />
        <span>الإشعارات مسموحة بس الجهاز ده لسه مش مسجّل عندنا</span>
      </div>
      {detail && <p className="text-[10px] text-orange-100/80 leading-relaxed">{detail}</p>}
      <button type="button" disabled={busy} onClick={enable} className="px-3 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-400 disabled:opacity-60 text-slate-900 text-[11px] font-black cursor-pointer">
        {busy ? 'جارٍ التسجيل...' : 'سجّل الجهاز دلوقتي'}
      </button>
    </div>
  );
};
