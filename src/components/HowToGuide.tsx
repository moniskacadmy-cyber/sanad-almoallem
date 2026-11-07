import React from 'react';
import { SettingsGroup } from './SettingsGroup';

interface GuideItem {
  icon: string;
  title: string;
  where: string;
  steps: string[];
  tip?: string;
}

const GUIDE: GuideItem[] = [
  {
    icon: '👤',
    title: 'إضافة طالب',
    where: 'تبويب «الطلاب»',
    steps: [
      'اضغط «إضافة طالب».',
      'اكتب الاسم والمادة وسعر الحصة، واختر ولد أو بنت.',
      'أضف مواعيد الطالب الأسبوعية (اختياري).',
      'اضغط «حفظ».',
    ],
    tip: 'اختيار ولد/بنت بيخلّي الرسائل تتكتب بالصيغة الصح تلقائياً.',
  },
  {
    icon: '📝',
    title: 'تسجيل حصة',
    where: 'الرئيسية',
    steps: [
      'اضغط «تسجيل حصة» واختر الطالب.',
      'اكتب «ما تم شرحه» لو حابب (اختياري).',
      'افتح قسم التقييم وسجّل مستوى الطالب وملاحظاتك.',
      'اضغط «حفظ» — الرصيد المتبقي والمستحقات بتتحسب لوحدها.',
    ],
  },
  {
    icon: '🗓️',
    title: 'الجدول والشاشة الكاملة',
    where: 'تبويب «الجدول»',
    steps: [
      'شوف مواعيد كل الطلاب مقسّمة على أيام الأسبوع.',
      'اضغط زر الشاشة الكاملة لعرض الحصة الحالية والتالية.',
      'الشاشة بتتغيّر لوحدها مع الساعة.',
    ],
  },
  {
    icon: '💬',
    title: 'رسائل واتساب والقوالب',
    where: 'تبويب «الطلاب» ← زر التذكير',
    steps: [
      'اضغط زر التذكير عند الطالب.',
      'اختر النوع: موعد، مستحقات، مدفوع مقدماً، مخصصة، أو ترحيب بالمجموعة.',
      'عدّل النص أو اختر الموعد والساعة يدوياً.',
      'اضغط «حفظ القالب» لطالب واحد أو للكل، ثم أرسل على واتساب.',
    ],
  },
  {
    icon: '🔔',
    title: 'الإشعارات',
    where: 'الإعدادات ← الإشعارات والتذكيرات',
    steps: [
      'فعّل الإشعارات واسمح بها لما المتصفح يسألك.',
      'اضغط زر الاختبار عشان تتأكد إن التنبيه وصل.',
      'ثبّت التطبيق على الموبايل لما يظهر لك الشريط.',
    ],
    tip: 'على الآيفون لازم تثبّت التطبيق الأول (iOS 16.4 أو أحدث) وإلا الإشعارات مش هتشتغل.',
  },
  {
    icon: '📅',
    title: 'تقويم الموبايل',
    where: 'الإعدادات ← تقويم الفون',
    steps: [
      'أنشئ رابط الاشتراك وانسخه.',
      'اشترك فيه من Google Calendar أو تقويم الآيفون.',
      'أي تعديل في الجدول بيتحدّث لوحده (ممكن ياخد وقت).',
    ],
    tip: 'التقويم للقراءة فقط. مش بيرنّ كمنبّه.',
  },
  {
    icon: '📚',
    title: 'مكتبتي',
    where: 'شريط التنقل السفلي ← «مكتبتي»',
    steps: [
      'ارفع ملف PDF أو صورة.',
      'اسأل المساعد الذكي عن محتوى الملفات (تلخيص، أسئلة، شرح).',
    ],
  },
  {
    icon: '🌐',
    title: 'الصفحة العامة ورابط ولي الأمر',
    where: 'الإعدادات ← صفحتي العامة',
    steps: [
      'انسخ رابط صفحتك العامة وشاركه مع الطلاب.',
      'انسخ رابط ولي الأمر وابعته على واتساب لمتابعة الحصص والتقييمات.',
    ],
  },
];

/** In-app "how do I use this app" guide, shown inside Settings. */
export const HowToGuide: React.FC = () => (
  <SettingsGroup icon="❓" title="كيف أستخدم التطبيق" hint="شرح سريع لكل ميزة خطوة بخطوة">
    <div className="space-y-3" dir="rtl">
      {GUIDE.map((g) => (
        <details
          key={g.title}
          className="group rounded-2xl border border-slate-700/60 bg-slate-950/40 p-3"
        >
          <summary className="flex items-center gap-2 cursor-pointer list-none text-sm font-bold text-white">
            <span className="text-lg">{g.icon}</span>
            <span className="flex-1">{g.title}</span>
            <span className="text-[10px] font-normal text-slate-400">{g.where}</span>
          </summary>
          <ol className="mt-3 list-decimal pr-5 space-y-1.5 text-xs text-slate-300 leading-6">
            {g.steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
          {g.tip && (
            <p className="mt-3 rounded-xl bg-purple-500/10 border border-purple-500/25 p-2 text-[11px] text-purple-200">
              💡 {g.tip}
            </p>
          )}
        </details>
      ))}
    </div>
  </SettingsGroup>
);
