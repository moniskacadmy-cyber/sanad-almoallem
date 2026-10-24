import React, { useEffect, useState, useMemo } from 'react';
import { Bell, Clock, MessageCircle, X } from 'lucide-react';

export interface ActiveReminderAlertData {
  studentName: string;
  classTime: string;
  whatsappUrl?: string;
  studentPhone?: string;
  subject?: string;
  targetTime?: Date | number;
}

interface ActiveReminderAlertProps {
  alert: ActiveReminderAlertData;
  onClose: () => void;
}

/**
 * Parses classTime string (e.g. "14:30", "09:00", "4:15 PM") into a Date object for today.
 */
function parseClassTimeToDate(classTimeStr: string, targetTime?: Date | number): Date {
  if (targetTime) {
    return targetTime instanceof Date ? targetTime : new Date(targetTime);
  }

  const now = new Date();
  if (!classTimeStr) {
    return new Date(now.getTime() + 15 * 60 * 1000);
  }

  const match = classTimeStr.match(/(\d{1,2}):(\d{2})/);
  if (!match) {
    return new Date(now.getTime() + 15 * 60 * 1000);
  }

  let hours = Number.parseInt(match[1], 10);
  const minutes = Number.parseInt(match[2], 10);

  // Handle 12-hour AM/PM modifiers if present
  if (/pm|م/i.test(classTimeStr) && hours < 12) {
    hours += 12;
  } else if (/am|ص/i.test(classTimeStr) && hours === 12) {
    hours = 0;
  }

  const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0, 0);

  // If the time is more than 6 hours in the past, it might be set for the next day
  if (now.getTime() - target.getTime() > 6 * 60 * 60 * 1000) {
    target.setDate(target.getDate() + 1);
  }

  return target;
}

function calculateCountdown(target: Date) {
  const diffMs = target.getTime() - Date.now();
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec <= 0) {
    return {
      totalSeconds: 0,
      minutes: 0,
      seconds: 0,
      isStarted: true,
    };
  }

  return {
    totalSeconds: diffSec,
    minutes: Math.floor(diffSec / 60),
    seconds: diffSec % 60,
    isStarted: false,
  };
}

export const ActiveReminderAlert: React.FC<ActiveReminderAlertProps> = ({ alert, onClose }) => {
  const targetDate = React.useMemo(
    () => parseClassTimeToDate(alert.classTime, alert.targetTime),
    [alert.classTime, alert.targetTime]
  );

  const [countdown, setCountdown] = useState(() => calculateCountdown(targetDate));

  useEffect(() => {
    const tick = () => {
      setCountdown(calculateCountdown(targetDate));
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [targetDate]);

  const { minutes, seconds, isStarted } = countdown;

  return (
    <div className="bg-gradient-to-r from-emerald-950 via-teal-950 to-slate-900 border-b border-emerald-500/50 px-3.5 py-2.5 flex items-center justify-between text-xs text-white shadow-xl transition-all select-none">
      <div className="flex items-center gap-2.5 min-w-0">
        <div
          className={`w-8 h-8 rounded-xl flex items-center justify-center border flex-shrink-0 transition-all ${
            isStarted
              ? 'bg-rose-500/20 text-rose-300 border-rose-500/50 animate-bounce'
              : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
          }`}
        >
          <Bell className="w-4 h-4" />
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-bold text-emerald-200">
              حصة <span className="text-white font-extrabold">{alert.studentName}</span>
            </p>
            {isStarted ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-950/90 border border-rose-500/60 text-rose-300 shadow animate-pulse">
                <span>حان موعد الحصة الآن! 🔔</span>
              </span>
            ) : (
              <span className="text-[11px] text-emerald-300 font-semibold">
                تبدأ بعد{' '}
                <span className="text-amber-300 font-bold font-mono">
                  {minutes} دقيقة و {seconds} ثانية
                </span>{' '}
                ⏰
              </span>
            )}
          </div>

          <p className="text-[10px] text-slate-300 flex items-center gap-1.5 mt-0.5">
            <span>الساعة {alert.classTime}</span>
            {alert.subject && (
              <>
                <span>•</span>
                <span className="text-purple-300 font-medium">{alert.subject}</span>
              </>
            )}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Dynamic Countdown Digital Pill */}
        <div
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl border shadow-inner ${
            isStarted
              ? 'bg-rose-950/80 border-rose-500/50 text-rose-300 animate-pulse'
              : 'bg-slate-900/90 border-amber-500/40 text-amber-300'
          }`}
          title={isStarted ? 'حان موعد بدء الحصة' : `متبقي على موعد الحصة: ${minutes} دقيقة و ${seconds} ثانية`}
        >
          <Clock className={`w-3.5 h-3.5 ${isStarted ? 'text-rose-400' : 'text-amber-400 animate-pulse'}`} />
          <span className="font-mono text-xs font-black tracking-wider tabular-nums" dir="ltr">
            {isStarted
              ? '00:00'
              : `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`}
          </span>
        </div>

        {/* WhatsApp Reminder Button */}
        {alert.whatsappUrl && (
          <a
            href={alert.whatsappUrl}
            target="_blank"
            rel="noreferrer"
            className="px-2.5 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] transition flex items-center gap-1 shadow cursor-pointer active:scale-95"
            title="إرسال رسالة تذكير عبر واتساب"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">تذكير واتساب</span>
            <span className="sm:hidden">واتساب</span>
          </a>
        )}

        {/* Dismiss Button */}
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition cursor-pointer"
          title="إخفاء التنبيه"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
