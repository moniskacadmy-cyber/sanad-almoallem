import React, { useEffect, useState } from 'react';
import { CalendarPlus, Copy, Link2Off, RefreshCw } from 'lucide-react';
import { createCalendarFeed, getCalendarFeed, googleAddByUrl, revokeCalendarFeed, type CalendarFeedLinks } from '../services/calendarApi';

/** Private subscription link for Google / iPhone calendar. No Google sign-in => no "unverified app" warning. */
export const CalendarSyncPanel: React.FC = () => {
  const [links, setLinks] = useState<CalendarFeedLinks | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    getCalendarFeed().then(setLinks).catch(() => setLinks({ url: null }));
  }, []);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setNotice('');
    try {
      await fn();
    } catch (e: any) {
      setNotice(`❌ ${e?.message || 'حصلت مشكلة، جرّب تاني.'}`);
    } finally {
      setBusy(false);
    }
  };

  const copy = () =>
    run(async () => {
      if (!links?.https) return;
      await navigator.clipboard.writeText(links.https);
      setNotice('✅ اتنسخ الرابط.');
    });

  return (
    <div className="rounded-2xl bg-slate-900 border border-blue-500/30 p-4 space-y-3 text-right" dir="rtl">
      <div className="flex items-center gap-2 text-blue-200 text-sm font-extrabold">
        <CalendarPlus className="w-4 h-4" />
        <span>اشترك في جدولك من تقويم الفون 📅</span>
      </div>
      <p className="text-[11px] text-slate-400 leading-relaxed">
        حصصك كلها بتظهر في Google Calendar أو تقويم الآيفون وبتتحدّث تلقائياً لما تغيّر في التطبيق. من غير تسجيل دخول بجوجل ومن غير أي تحذيرات أمان.
      </p>

      {!links?.url ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => run(async () => setLinks(await createCalendarFeed()))}
          className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-xs font-bold cursor-pointer"
        >
          {busy ? 'جارٍ الإنشاء...' : 'إنشاء رابط الاشتراك'}
        </button>
      ) : (
        <div className="space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <a
              href={googleAddByUrl(links.webcal || '')}
              target="_blank"
              rel="noopener noreferrer"
              className="py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold text-center cursor-pointer"
            >
              إضافة لـ Google Calendar
            </a>
            <a
              href={links.webcal}
              className="py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold text-center cursor-pointer"
            >
              إضافة لتقويم الآيفون 🍎
            </a>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={copy} className="flex-1 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-[11px] font-bold flex items-center justify-center gap-1.5 cursor-pointer">
              <Copy className="w-3.5 h-3.5" /> نسخ الرابط
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => run(async () => setLinks(await createCalendarFeed()))}
              className="flex-1 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-[11px] font-bold flex items-center justify-center gap-1.5 cursor-pointer"
              title="الرابط القديم هيبطّل يشتغل"
            >
              <RefreshCw className="w-3.5 h-3.5" /> رابط جديد
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => run(async () => { await revokeCalendarFeed(); setLinks({ url: null }); setNotice('تم إلغاء الرابط.'); })}
              className="flex-1 py-2 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-300 text-[11px] font-bold flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Link2Off className="w-3.5 h-3.5" /> إلغاء
            </button>
          </div>
          <ul className="text-[10px] text-slate-500 leading-relaxed list-disc pr-4 space-y-0.5">
            <li>الرابط سرّي، متشاركوش مع حد. لو اتسرّب اضغط "رابط جديد".</li>
            <li>جوجل بيحدّث الاشتراك كل كام ساعة، والآيفون أسرع.</li>
            <li>التقويم بيعرض الحصص بس، والتعديل بيتم من التطبيق.</li>
          </ul>
        </div>
      )}
      {notice && <p className="text-[11px] font-bold text-amber-200">{notice}</p>}
    </div>
  );
};
