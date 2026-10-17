import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  RefreshCw,
  Trash2,
  AlertCircle,
  ShieldAlert,
  Sparkles,
  CheckCircle2,
  Wifi,
  Users,
} from 'lucide-react';

interface LoadingFallbackProps {
  message?: string;
  subMessage?: string;
  error?: string | null;
  timeoutMs?: number;
  onRetry?: () => void;
  onResetCache?: () => void;
}

const TEACHER_TIPS = [
  '💡 نصيحة: يمكنك إرسال إشعارات وتذكيرات الحصص للطلاب وأولياء الأمور بنقرة واحدة عبر الواتساب!',
  '💡 نصيحة: ينبهك النظام تلقائياً قبل موعد الحصة بـ 15 دقيقة حتى لو كان التطبيق مغلقاً.',
  '💡 نصيحة: يمكنك الاستعانة بمساعد الذكاء الاصطناعي لإعداد الاختبارات والمذكرات الدراسية فوراً.',
  '💡 نصيحة: يمكنك متابعة تحصيل الاشتراكات والمدفوعات من لوحة الحسابات المالية.',
];

export const LoadingFallback: React.FC<LoadingFallbackProps> = ({
  message = 'جارٍ تحميل سند المعلم...',
  subMessage,
  error = null,
  timeoutMs = 6000,
  onRetry,
  onResetCache,
}) => {
  const [progress, setProgress] = useState(12);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [tipIndex, setTipIndex] = useState(0);
  const [showTimeoutControls, setShowTimeoutControls] = useState(false);

  // Time-of-day greeting
  const [greeting, setGreeting] = useState('أهلاً بك معلمنا القدير!');

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) {
      setGreeting('صباح الخير معلمنا القدير! ☀️');
    } else if (hour >= 12 && hour < 17) {
      setGreeting('طاب يومك معلمنا العزيز! 🌤️');
    } else {
      setGreeting('مساء الخير والتوفيق معلمنا الفاضل! 🌙');
    }
  }, []);

  // Simulated smooth progress incrementer & step progression
  useEffect(() => {
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 95) return 95; // Hold at 95% until complete
        const bump = Math.floor(Math.random() * 8) + 4;
        return Math.min(95, prev + bump);
      });
    }, 300);

    return () => clearInterval(progressInterval);
  }, []);

  // Sync step index and rotating tips with progress percentage
  useEffect(() => {
    if (progress < 30) {
      setCurrentStepIndex(0);
    } else if (progress < 65) {
      setCurrentStepIndex(1);
    } else if (progress < 88) {
      setCurrentStepIndex(2);
    } else {
      setCurrentStepIndex(3);
    }
  }, [progress]);

  // Rotate tips every 3 seconds
  useEffect(() => {
    const tipInterval = setInterval(() => {
      setTipIndex((prev) => (prev + 1) % TEACHER_TIPS.length);
    }, 3200);
    return () => clearInterval(tipInterval);
  }, []);

  // Timeout controls trigger
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowTimeoutControls(true);
    }, timeoutMs);
    return () => clearTimeout(timer);
  }, [timeoutMs]);

  const handleDefaultReload = () => {
    if (onRetry) {
      onRetry();
    } else {
      window.location.reload();
    }
  };

  const handleDefaultResetCache = () => {
    if (onResetCache) {
      onResetCache();
    } else {
      try {
        localStorage.clear();
        sessionStorage.clear();
        if ('caches' in window) {
          caches.keys().then((names) => {
            for (const name of names) {
              caches.delete(name);
            }
          });
        }
      } catch (e) {
        console.warn('Failed to clear storage:', e);
      }
      window.location.href = '/';
    }
  };

  const steps = [
    { title: 'بدء الاتصال بالخدمة السحابية', icon: Wifi },
    { title: 'مزامنة الطلاب وجدول الحصص اليومية', icon: Users },
    { title: 'تحضير المساعد الذكي والمكتبة', icon: Sparkles },
    { title: 'اكتمل التجهيز وجاري فتح الواجهة', icon: CheckCircle2 },
  ];

  const CurrentStepIcon = steps[currentStepIndex].icon;

  return (
    <div
      className="min-h-screen bg-[#070314] text-slate-100 flex flex-col items-center justify-center p-4 dir-rtl text-center select-none"
      dir="rtl"
    >
      <div className="w-full max-w-sm bg-gradient-to-b from-slate-900/95 via-slate-950/95 to-slate-950 border border-purple-500/30 rounded-3xl p-6 shadow-2xl relative space-y-5 animate-in fade-in duration-300">
        
        {/* Time-based Greeting & Brand Header */}
        <div className="flex flex-col items-center justify-center">
          <div className="relative mb-3.5">
            {/* Pulsing Outer Glow Ring */}
            <div className="absolute -inset-2 rounded-2xl bg-gradient-to-tr from-purple-600 via-indigo-500 to-amber-400 opacity-60 blur-md animate-pulse" />
            {/* Inner Brand Card */}
            <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-tr from-purple-800 to-indigo-700 border border-purple-400/40 flex items-center justify-center shadow-2xl">
              <BookOpen className="w-8 h-8 text-amber-300" />
            </div>
          </div>

          <span className="text-[11px] font-extrabold text-amber-300 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 mb-2">
            {greeting}
          </span>

          <h2 className="text-base font-black text-white tracking-wide">{message}</h2>
          <p className="text-xs text-slate-400 mt-0.5 leading-relaxed max-w-xs">
            {subMessage || steps[currentStepIndex].title}
          </p>
        </div>

        {/* Interactive Progress Bar & Percentage Indicator */}
        <div className="space-y-2 bg-slate-950/70 border border-purple-900/40 p-3.5 rounded-2xl">
          <div className="flex items-center justify-between text-xs font-bold px-1">
            <div className="flex items-center gap-1.5 text-purple-300">
              <CurrentStepIcon className="w-4 h-4 text-amber-400 animate-pulse" />
              <span className="text-[11px] text-slate-200">{steps[currentStepIndex].title}</span>
            </div>
            <span className="font-mono text-xs text-amber-300">{progress}%</span>
          </div>

          {/* Progress Track */}
          <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden p-0.5 border border-purple-900/50 shadow-inner">
            <div
              className="h-full rounded-full bg-gradient-to-r from-purple-600 via-indigo-500 to-amber-400 transition-all duration-300 shadow-md shadow-purple-500/50"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Step Dots */}
          <div className="flex items-center justify-between px-2 pt-1">
            {steps.map((s, idx) => (
              <div
                key={s.title}
                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                  idx <= currentStepIndex
                    ? 'bg-amber-400 scale-125 shadow-sm shadow-amber-400/80'
                    : 'bg-slate-800'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Rotating Teacher Micro-tips Box */}
        <div className="min-h-[44px] bg-purple-950/30 border border-purple-500/20 rounded-2xl p-2.5 flex items-center justify-center text-center transition-all duration-300">
          <p className="text-[11px] font-medium text-slate-300 leading-relaxed animate-in fade-in key={tipIndex}">
            {TEACHER_TIPS[tipIndex]}
          </p>
        </div>

        {/* Display explicit initialization error if provided */}
        {error && (
          <div className="p-3 bg-rose-950/70 border border-rose-500/40 rounded-2xl text-xs text-rose-200 flex items-start gap-2.5 text-right">
            <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
            <span className="leading-snug">{error}</span>
          </div>
        )}

        {/* Timeout / Recovery Controls */}
        {(showTimeoutControls || error) && (
          <div className="pt-2 space-y-2 animate-in fade-in zoom-in-95 duration-200 border-t border-purple-900/40">
            <p className="text-[11px] text-amber-300 font-bold">
              {error ? 'يرجى اختيار إجراء للتعافي:' : 'استغرق التحميل وقتاً أطول من المعتاد؟'}
            </p>

            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                onClick={handleDefaultReload}
                className="w-full py-2.5 px-3 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition shadow-lg shadow-purple-950/50 flex items-center justify-center gap-2 cursor-pointer active:scale-98"
              >
                <RefreshCw className="w-3.5 h-3.5 text-amber-300" />
                <span>إعادة تحميل التطبيق</span>
              </button>

              <button
                type="button"
                onClick={handleDefaultResetCache}
                className="w-full py-2.5 px-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 font-bold text-xs transition flex items-center justify-center gap-2 cursor-pointer active:scale-98"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                <span>تفريغ المؤقت وتنشيط الاتصال</span>
              </button>
            </div>
          </div>
        )}

        {/* Footer Badge */}
        <div className="pt-0.5 flex items-center justify-center gap-1.5 text-[10px] text-slate-400">
          <ShieldAlert className="w-3.5 h-3.5 text-purple-400" />
          <span>سند المعلم • نظام الاستجابة والتحميل الذكي</span>
        </div>
      </div>
    </div>
  );
};
