import React, { useEffect, useMemo, useState } from 'react';
import { X, Radio, Clock, CheckCircle2, ChevronLeft } from 'lucide-react';
import { ScheduleSlot } from '../types';
import { getMinutesFromTime } from '../services/conflictService';
import { formatTime12h } from '../utils/timeZone';
import { useBackHandler } from '../services/backHandler';

const DAY_NAMES = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

interface Props {
  schedules: ScheduleSlot[];
  teacherName?: string;
  onClose: () => void;
}

function fmtMin(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0 && m > 0) return `${h} س و ${m} د`;
  if (h > 0) return `${h} ساعة`;
  return `${m} دقيقة`;
}

/** Full-screen timetable that follows the real clock: shows the class running NOW and the next one. */
export const ScheduleFullscreen: React.FC<Props> = ({ schedules, teacherName, onClose }) => {
  const [now, setNow] = useState(() => new Date());
  const [pickedDay, setPickedDay] = useState<number | null>(null); // null = automatic (today)

  useBackHandler(true, onClose, 'schedule_fullscreen');

  // Live clock (every 15s is plenty for minute-level info).
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 15000);
    return () => clearInterval(t);
  }, []);

  // Real full-screen + keep the screen awake while open (best effort: not every browser allows it).
  useEffect(() => {
    let wake: any = null;
    try {
      void document.documentElement.requestFullscreen?.().catch(() => {});
    } catch {
      /* ignore */
    }
    try {
      (navigator as any).wakeLock?.request('screen').then((w: any) => (wake = w)).catch(() => {});
    } catch {
      /* ignore */
    }
    return () => {
      try {
        if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
      } catch {
        /* ignore */
      }
      try {
        wake?.release?.();
      } catch {
        /* ignore */
      }
    };
  }, []);

  const today = now.getDay();
  const day = pickedDay ?? today;
  const isToday = day === today;
  const nowMin = now.getHours() * 60 + now.getMinutes();

  const items = useMemo(
    () =>
      schedules
        .filter((s) => s.dayOfWeek === day && s.time)
        .map((s) => ({ s, start: getMinutesFromTime(s.time), end: getMinutesFromTime(s.time) + (s.duration || 60) }))
        .sort((a, b) => a.start - b.start),
    [schedules, day]
  );

  const current = isToday ? items.find((i) => nowMin >= i.start && nowMin < i.end) : undefined;
  const next = isToday ? items.find((i) => i.start > nowMin) : undefined;
  const clock = new Intl.DateTimeFormat('ar-EG', { hour: 'numeric', minute: '2-digit', hour12: true }).format(now);
  const dateText = new Intl.DateTimeFormat('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' }).format(now);

  return (
    <div className="fixed inset-0 z-[70] bg-slate-950 text-white flex flex-col" dir="rtl">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-purple-900/40 bg-slate-900/80">
        <div>
          <div className="text-3xl font-black font-mono tracking-tight">{clock}</div>
          <div className="text-xs text-slate-400 font-bold">{dateText}{teacherName ? ` • أ. ${teacherName}` : ''}</div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
          aria-label="إغلاق"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Day tabs (automatic = today) */}
      <div className="flex gap-1.5 overflow-x-auto px-3 py-2 border-b border-slate-800">
        {DAY_NAMES.map((name, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => setPickedDay(idx === today ? null : idx)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap border cursor-pointer ${
              day === idx
                ? 'bg-purple-600 border-purple-400 text-white'
                : 'bg-slate-900 border-slate-700 text-slate-400'
            }`}
          >
            {name}
            {idx === today ? ' • اليوم' : ''}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* NOW / NEXT hero */}
        {isToday && current && (
          <div className="rounded-3xl border-2 border-emerald-400/70 bg-emerald-950/60 p-5 space-y-3 shadow-lg shadow-emerald-950/50">
            <div className="flex items-center gap-2 text-emerald-300 text-sm font-black">
              <Radio className="w-4 h-4 animate-pulse" />
              <span>الحصة الجارية دلوقتي</span>
            </div>
            <div className="text-3xl font-black leading-tight">{current.s.studentName}</div>
            <div className="text-sm text-emerald-100/90 font-bold">
              {formatTime12h(current.s.time)} → {formatTime12h(`${Math.floor(current.end / 60) % 24}:${String(current.end % 60).padStart(2, '0')}`)}
              {current.s.locationOrLink ? ` • ${current.s.locationOrLink}` : ''}
            </div>
            <div className="h-2.5 rounded-full bg-emerald-950 overflow-hidden">
              <div
                className="h-full bg-emerald-400 transition-all"
                style={{ width: `${Math.min(100, Math.max(0, ((nowMin - current.start) / (current.end - current.start)) * 100))}%` }}
              />
            </div>
            <div className="text-xs text-emerald-200 font-bold">فاضل {fmtMin(current.end - nowMin)} على انتهائها</div>
          </div>
        )}

        {isToday && !current && next && (
          <div className="rounded-3xl border-2 border-amber-400/60 bg-amber-950/40 p-5 space-y-2">
            <div className="flex items-center gap-2 text-amber-300 text-sm font-black">
              <Clock className="w-4 h-4" />
              <span>مفيش حصة دلوقتي — الحصة الجاية</span>
            </div>
            <div className="text-3xl font-black leading-tight">{next.s.studentName}</div>
            <div className="text-sm text-amber-100/90 font-bold">
              الساعة {formatTime12h(next.s.time)} • بعد {fmtMin(next.start - nowMin)}
            </div>
          </div>
        )}

        {isToday && !current && !next && (
          <div className="rounded-3xl border border-slate-700 bg-slate-900/60 p-6 text-center text-slate-300 font-bold">
            {items.length === 0 ? 'مفيش حصص النهاردة 🌿' : 'خلصت كل حصص النهاردة 🎉'}
          </div>
        )}

        {isToday && current && next && (
          <div className="flex items-center gap-2 text-xs text-amber-200 font-bold bg-amber-950/30 border border-amber-500/30 rounded-2xl px-3 py-2">
            <ChevronLeft className="w-4 h-4" />
            <span>بعدها: {next.s.studentName} الساعة {formatTime12h(next.s.time)}</span>
          </div>
        )}

        {/* Full list of the day */}
        <div className="space-y-2">
          <h3 className="text-xs font-black text-slate-400">حصص {DAY_NAMES[day]} ({items.length})</h3>
          {items.length === 0 && !isToday && <p className="text-sm text-slate-500">مفيش حصص في اليوم ده.</p>}
          {items.map(({ s, start, end }) => {
            const state = !isToday ? 'later' : nowMin >= end ? 'done' : nowMin >= start ? 'now' : 'later';
            return (
              <div
                key={s.id}
                className={`rounded-2xl border p-3 flex items-center justify-between gap-3 ${
                  state === 'now'
                    ? 'border-emerald-400 bg-emerald-950/40'
                    : state === 'done'
                    ? 'border-slate-800 bg-slate-900/40 opacity-60'
                    : 'border-slate-700 bg-slate-900/70'
                }`}
              >
                <div className="min-w-0">
                  <div className="text-sm font-black truncate">{s.studentName}</div>
                  <div className="text-[11px] text-slate-400 font-bold">
                    {formatTime12h(s.time)} • {s.duration || 60} دقيقة{s.locationOrLink ? ` • ${s.locationOrLink}` : ''}
                  </div>
                </div>
                {state === 'done' && <CheckCircle2 className="w-5 h-5 text-slate-500 shrink-0" />}
                {state === 'now' && <span className="text-[11px] font-black text-emerald-300 shrink-0">الآن</span>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
