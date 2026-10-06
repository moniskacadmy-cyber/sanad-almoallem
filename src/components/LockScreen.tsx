import React, { useState } from 'react';
import { TeacherProfile, SubscriptionPlan } from '../types';
import { Lock, ShieldCheck, CheckCircle2, MessageCircle, Sparkles, X, Shield } from 'lucide-react';

interface LockScreenProps {
  profile: TeacherProfile;
  isAdmin?: boolean;
  isVoluntary?: boolean; // opened from settings to upgrade voluntarily
  onClose?: () => void;
  onSignOut?: () => void;
  onOpenAdmin?: () => void;
}

export const LockScreen: React.FC<LockScreenProps> = ({
  profile,
  isAdmin = false,
  isVoluntary = false,
  onClose,
  onSignOut,
  onOpenAdmin,
}) => {
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan>('six_months');

  const plans = [
    {
      id: 'monthly' as SubscriptionPlan,
      name: 'الباقة الشهرية',
      price: '50 ج.م',
      period: 'لكل شهر',
      badge: null,
      desc: 'مرونة كاملة للتجديد شهرياً',
    },
    {
      id: 'six_months' as SubscriptionPlan,
      name: 'باقة 6 شهور',
      price: '250 ج.م',
      period: 'لفصل دراسي كامل',
      badge: 'الأكثر توفيراً ✨',
      desc: 'وفر 50 ج.م مقارنة بالتجديد الشهري',
    },
    {
      id: 'yearly' as SubscriptionPlan,
      name: 'الباقة السنوية',
      price: '450 ج.م',
      period: 'لعام كامل (12 شهر)',
      badge: 'أفضل قيمة 👑',
      desc: 'وفر 150 ج.م واستمتع بعام دراسي كامل',
    },
  ];

  const getPlanArabicTitle = (plan: SubscriptionPlan) => {
    switch (plan) {
      case 'monthly':
        return 'الباقة الشهرية (50 ج.م)';
      case 'six_months':
        return 'باقة 6 شهور (250 ج.م)';
      case 'yearly':
        return 'الباقة السنوية (450 ج.م)';
      default:
        return 'اشتراك جديد';
    }
  };

  const handleWhatsAppActivation = () => {
    const planTitle = getPlanArabicTitle(selectedPlan);
    const message = encodeURIComponent(
      `مرحباً، أريد تفعيل اشتراك في تطبيق "سند المعلم":\n` +
      `👤 اسم المعلم: ${profile.name}\n` +
      `📧 البريد: ${profile.email}\n` +
      `📱 واتساب: ${profile.whatsapp}\n` +
      `📚 المادة: ${profile.subject}\n` +
      `💎 الباقة المختارة: ${planTitle}\n` +
      `مع خالص الشكر!`
    );
    const waUrl = `https://wa.me/201025967471?text=${message}`;
    window.open(waUrl, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950 flex flex-col items-center justify-start p-4 py-8">
      <div className="w-full max-w-[460px] bg-slate-900/90 border border-purple-500/30 rounded-3xl p-5 shadow-2xl relative text-right">
        {isVoluntary && onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 left-4 p-2 rounded-full bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* Header Icon */}
        <div className="flex flex-col items-center text-center mt-2 mb-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-purple-800 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-900/50 mb-3 border border-purple-400/30">
            {isVoluntary ? (
              <Sparkles className="w-8 h-8 text-amber-300" />
            ) : profile.isActive === false ? (
              <Lock className="w-8 h-8 text-rose-400 animate-pulse" />
            ) : (
              <Lock className="w-8 h-8 text-amber-400 animate-pulse" />
            )}
          </div>
          <h2 className="text-xl font-bold text-white">
            {isVoluntary
              ? 'ترقية وتجديد الاشتراك'
              : profile.isActive === false
              ? 'تم إيقاف تفعيل الحساب مؤقتاً'
              : 'انتهت فترة اشتراك / تجربة التطبيق'}
          </h2>
          <p className="text-xs text-purple-200/80 mt-1 max-w-xs leading-relaxed">
            {isVoluntary
              ? 'اختر الباقة المناسبة لك واستمتع بجميع مميزات سند المعلم بلا انقطاع'
              : profile.isActive === false
              ? 'يرجى التواصل مع إدارة سند المعلم عبر واتساب لتفعيل اشتراكك واستعادة الوصول لبياناتك.'
              : 'شكراً لاستخدامك "سند المعلم"! للاستمرار في تنظيم حصصك وطلابك، يرجى تجديد الاشتراك:'}
          </p>
        </div>

        {/* Data Safety Notice */}
        <div className="mb-5 rounded-2xl bg-purple-950/60 border border-purple-500/30 p-3 flex items-center gap-3">
          <ShieldCheck className="w-7 h-7 text-emerald-400 flex-shrink-0" />
          <div className="text-right">
            <p className="text-xs font-bold text-emerald-300">بياناتك وطلابك محفوظة 100%</p>
            <p className="text-[11px] text-slate-300 leading-tight mt-0.5">
              جميع سجلات الحصص والطلاب والمدفوعات محفوظة بأمان ومستعدة فور التفعيل.
            </p>
          </div>
        </div>

        {/* Plans List */}
        <div className="space-y-2.5 mb-5">
          {plans.map((p) => {
            const isSelected = selectedPlan === p.id;
            return (
              <div
                key={p.id}
                onClick={() => setSelectedPlan(p.id)}
                className={`relative rounded-2xl p-3.5 border transition cursor-pointer flex items-center justify-between ${
                  isSelected
                    ? 'bg-purple-900/40 border-purple-400 shadow-md shadow-purple-900/30'
                    : 'bg-slate-800/40 border-slate-700/60 hover:border-slate-600'
                }`}
              >
                {p.badge && (
                  <span className="absolute -top-2.5 left-4 px-2 py-0.5 rounded-full text-[10px] font-bold bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow">
                    {p.badge}
                  </span>
                )}

                <div className="flex items-center gap-3">
                  <div
                    className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                      isSelected
                        ? 'border-purple-400 bg-purple-600 text-white'
                        : 'border-slate-500'
                    }`}
                  >
                    {isSelected && <CheckCircle2 className="w-3.5 h-3.5" />}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">{p.name}</h3>
                    <p className="text-[11px] text-slate-400">{p.desc}</p>
                  </div>
                </div>

                <div className="text-left">
                  <span className="text-base font-extrabold text-amber-300">{p.price}</span>
                  <p className="text-[10px] text-slate-400">{p.period}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* WhatsApp Activation Button */}
        <button
          onClick={handleWhatsAppActivation}
          className="w-full flex items-center justify-center gap-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white py-3.5 px-4 font-bold text-sm shadow-lg shadow-emerald-900/40 active:scale-98 transition cursor-pointer"
        >
          <MessageCircle className="w-5 h-5" />
          <span>تفعيل عبر الواتساب الآن (فوري)</span>
        </button>

        <p className="text-center text-[11px] text-slate-400 mt-2.5">
          سيتم فتح محادثة مباشرة مع الدعم بالرقم <span dir="ltr" className="text-purple-300 font-mono font-bold">01025967471</span> لتفعيل حسابك فورياً.
        </p>

        {/* Feature Highlights */}
        <div className="mt-5 pt-4 border-t border-purple-900/40 grid grid-cols-2 gap-2 text-[11px] text-purple-200">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
            <span>تنظيم غير محدود للطلاب</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
            <span>تقارير واتساب سريعة</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
            <span>مكتبة نماذج تحضير جاهزة</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
            <span>تتبع الحضور والمدفوعات</span>
          </div>
        </div>

        {/* Sign Out Option if locked */}
        {!isVoluntary && onSignOut && (
          <div className="mt-5 text-center space-y-2">
            <button
              onClick={onSignOut}
              className="text-xs text-slate-400 hover:text-rose-400 underline transition cursor-pointer"
            >
              تسجيل الخروج من هذا الحساب
            </button>
            {isAdmin && onOpenAdmin && (
              <div>
                <button
                  type="button"
                  onClick={onOpenAdmin}
                  className="text-[11px] text-slate-500 hover:text-amber-400 transition cursor-pointer flex items-center justify-center gap-1 mx-auto"
                >
                  <Shield className="w-3 h-3" />
                  <span>دخول المشرف (Admin)</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
