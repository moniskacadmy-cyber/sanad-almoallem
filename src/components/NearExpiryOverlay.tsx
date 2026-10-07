import React from 'react';
import { TeacherProfile } from '../types';
import { Clock, MessageCircle, AlertTriangle, ArrowRight, ShieldCheck, Sparkles } from 'lucide-react';

interface NearExpiryOverlayProps {
  profile: TeacherProfile;
  daysLeft: number;
  onDismiss: () => void;
}

export const NearExpiryOverlay: React.FC<NearExpiryOverlayProps> = ({
  profile,
  daysLeft,
  onDismiss,
}) => {
  const handleWhatsAppRenew = () => {
    const periodText = daysLeft === 0 ? 'اليوم' : `خلال ${daysLeft} ${daysLeft === 1 ? 'يوم' : 'أيام'}`;
    const message = encodeURIComponent(
      `مرحباً، أود تجديد اشتراكي في تطبيق "سند المعلم":\n` +
      `👤 اسم المعلم: ${profile.name}\n` +
      `📧 البريد: ${profile.email}\n` +
      `📱 واتساب: ${profile.whatsapp}\n` +
      `⏳ الحالة: ينتهي الاشتراك ${periodText}\n` +
      `أرجو إرسال باقات التجديد المتاحة وطرق الدفع. شكراً!`
    );
    window.open(`https://wa.me/201025967471?text=${message}`, '_blank');
  };

  const getDaysFormattedText = () => {
    if (daysLeft <= 0) return 'أقل من 24 ساعة (اليوم)';
    if (daysLeft === 1) return 'يوم واحد فقط';
    if (daysLeft === 2) return 'يومان فقط';
    return `${daysLeft} أيام`;
  };

  return (
    <div className="fixed inset-0 z-40 bg-slate-950  flex items-center justify-center p-4 text-right animate-fade-in">
      <div className="w-full max-w-sm bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border border-amber-500/40 rounded-3xl p-6 shadow-2xl relative space-y-4">
        {/* Glow effect */}
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-32 h-32 bg-amber-500/15 rounded-full blur-2xl pointer-events-none" />

        {/* Top Icon Badge */}
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-600 via-amber-500 to-yellow-400 flex items-center justify-center shadow-lg shadow-amber-500/30 border border-amber-300/40">
            <Clock className="w-8 h-8 text-slate-950 animate-pulse" />
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[11px] font-bold">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>تنبيه: اقتراب موعد انتهاء الاشتراك</span>
          </div>

          <h2 className="text-lg font-black text-white">
            متبقي {getDaysFormattedText()}
          </h2>
          <p className="text-xs text-slate-300 leading-relaxed max-w-xs">
            أهلاً أ. <strong className="text-amber-300">{profile.name}</strong>، نود تذكيرك بأن اشتراكك في سند المعلم سينتهي قريباً. سارع بالتجديد لضمان استمرار وصولك لحصصك وطلابك بلا توقف.
          </p>
        </div>

        {/* Assurance Box */}
        <div className="rounded-2xl bg-slate-950/70 border border-purple-500/20 p-3 flex items-center gap-2.5">
          <ShieldCheck className="w-6 h-6 text-emerald-400 flex-shrink-0" />
          <p className="text-[11px] text-slate-300 leading-tight">
            بيانات طلابك وحصصك والمدفوعات محفوظة بأمان ومستمرة معك فور التجديد.
          </p>
        </div>

        {/* Actions */}
        <div className="space-y-2 pt-1">
          {/* Green WhatsApp Renewal Button */}
          <button
            type="button"
            onClick={handleWhatsAppRenew}
            className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-emerald-500 via-emerald-400 to-green-500 hover:from-emerald-400 hover:to-green-400 text-slate-950 font-black text-xs transition cursor-pointer shadow-xl shadow-emerald-500/30 flex items-center justify-center gap-2 active:scale-98"
          >
            <MessageCircle className="w-5 h-5 fill-slate-950" />
            <span>تجديد الاشتراك عبر واتساب</span>
          </button>

          {/* Dismiss button */}
          <button
            type="button"
            onClick={onDismiss}
            className="w-full py-2.5 px-4 rounded-2xl bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5"
          >
            <span>متابعة استخدام التطبيق مؤقتاً</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
