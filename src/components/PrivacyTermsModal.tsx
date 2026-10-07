import React, { useState } from 'react';
import { Shield, FileText, X, CheckCircle, Lock, Users, Database, Trash2, Download } from 'lucide-react';

interface PrivacyTermsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'privacy' | 'terms';
}

export const PrivacyTermsModal: React.FC<PrivacyTermsModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'privacy',
}) => {
  const [activeTab, setActiveTab] = useState<'privacy' | 'terms'>(initialTab);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 flex items-center justify-center p-4 text-right" dir="rtl">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-purple-500/30 rounded-3xl p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-purple-900/40 pb-3 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-purple-900/40 border border-purple-500/30 text-purple-300">
              {activeTab === 'privacy' ? <Shield className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                {activeTab === 'privacy' ? 'سياسة الخصوصية وحماية بيانات الطلاب' : 'شروط الخدمة والاستخدام'}
              </h2>
              <p className="text-[11px] text-slate-400">منصة سند المعلم • التزام قانوني وتربوي لحماية البيانات</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
            aria-label="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-800 pb-2 flex-shrink-0">
          <button
            onClick={() => setActiveTab('privacy')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'privacy'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/40'
                : 'bg-slate-800/60 text-slate-400 hover:text-white'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>سياسة الخصوصية والبيانات</span>
          </button>
          <button
            onClick={() => setActiveTab('terms')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'terms'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/40'
                : 'bg-slate-800/60 text-slate-400 hover:text-white'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>شروط الاستخدام والاشتراكات</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="overflow-y-auto space-y-4 text-xs text-slate-300 leading-relaxed pr-1 flex-1">
          {activeTab === 'privacy' ? (
            <div className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-purple-950/40 border border-purple-500/30 text-purple-200">
                <h3 className="font-bold text-sm mb-1 flex items-center gap-1.5 text-white">
                  <Lock className="w-4 h-4 text-purple-400" />
                  ميثاق حماية بيانات الطلاب والقُصّر (Students & Minors Data Protection)
                </h3>
                <p className="text-[11px] leading-relaxed">
                  تدرك منصة «سند المعلم» الحساسية الفائقة لبيانات الطلاب وأولياء الأمور. صُمم التطبيق ليكون مساحة خاصة بالمعلم فقط لإدارة مواعيده ودروسه، ونلتزم التزاماً صارماً بالقوانين المنظمة لخصوصية القُصّر:
                </p>
              </div>

              <div className="space-y-3">
                <div className="rounded-2xl bg-slate-800/40 border border-slate-800 p-3.5 space-y-1.5">
                  <h4 className="font-bold text-white text-xs flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-purple-400" />
                    1. عدم مشاركة أو بيع البيانات إطلاقاً
                  </h4>
                  <p className="text-[11px] text-slate-300">
                    لا نقوم ببيع أو تأجير أو مشاركة أي بيانات شخصية تخص الطلاب أو أولياء أمورهم أو المعلمين مع أي جهة إعلانية أو تجارية أو أطراف ثالثة لأي غرض كان.
                  </p>
                </div>

                <div className="rounded-2xl bg-slate-800/40 border border-slate-800 p-3.5 space-y-1.5">
                  <h4 className="font-bold text-white text-xs flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5 text-emerald-400" />
                    2. ملكية البيانات وعلاقة المعلم بالطلاب
                  </h4>
                  <p className="text-[11px] text-slate-300">
                    يعتبر المعلم هو المتحكم الحصري في البيانات (Data Controller). تقتصر معالجة المنصة للبيانات على توفير خدمات الحفظ والتنظيم والتنبيهات المباشرة للحصص بطلب وتوجيه من المعلم نفسه.
                  </p>
                </div>

                <div className="rounded-2xl bg-slate-800/40 border border-slate-800 p-3.5 space-y-1.5">
                  <h4 className="font-bold text-white text-xs flex items-center gap-1.5">
                    <Download className="w-3.5 h-3.5 text-blue-400" />
                    3. الحق في تصدير البيانات (Right to Portability)
                  </h4>
                  <p className="text-[11px] text-slate-300">
                    يحق للمعلم تصدير كافة بياناته وسجلات طلابه وحصصه في أي وقت بصيغتي JSON و Excel/CSV دون أي قيود، مما يضمن حرية المعلم في نقل بياناته بالكامل.
                  </p>
                </div>

                <div className="rounded-2xl bg-slate-800/40 border border-slate-800 p-3.5 space-y-1.5">
                  <h4 className="font-bold text-white text-xs flex items-center gap-1.5">
                    <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                    4. الحق في النسيان والحذف الشامل (Right to Erasure)
                  </h4>
                  <p className="text-[11px] text-slate-300">
                    يحتوي التطبيق على خيار «حذف حسابي وبياناتي نهائياً» يتيح للمعلم إزالة كافة بياناته وسجلات طلابه وملفاته واشتراكه من خوادم السيرفر وقاعدة البيانات وقوائم التنبيهات بصورة نهائية وفورية.
                  </p>
                </div>

                <div className="rounded-2xl bg-slate-800/40 border border-slate-800 p-3.5 space-y-1.5">
                  <h4 className="font-bold text-white text-xs flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-amber-400" />
                    5. التشفير وإخفاء الهوية في السجلات (PII Masking)
                  </h4>
                  <p className="text-[11px] text-slate-300">
                    تُشفر كافة البيانات أثناء النقل (TLS 1.3) وأثناء التخزين (AES-256). كما تطبق خوادم النظام إخفاءً آلياً لكافة أرقام الهواتف والبريد الإلكتروني من سجلات التشغيل (Server Logs) لضمان عدم تسريب أي معلومة تعريفية.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 text-indigo-200">
                <h3 className="font-bold text-sm mb-1 flex items-center gap-1.5 text-white">
                  <FileText className="w-4 h-4 text-indigo-400" />
                  شروط الاستخدام والاشتراكات التعليمية
                </h3>
                <p className="text-[11px] leading-relaxed">
                  باستخدامك لمنصة «سند المعلم»، فإنك تقر وتوافق على الالتزام بالشروط والبنود التالية:
                </p>
              </div>

              <div className="space-y-3">
                <div className="rounded-2xl bg-slate-800/40 border border-slate-800 p-3.5 space-y-1.5">
                  <h4 className="font-bold text-white text-xs">1. الحساب والاستخدام المسموح</h4>
                  <p className="text-[11px] text-slate-300">
                    الحساب مخصص للمعلم لإدارة أنشطته التعليمية الفردية أو الجماعية. يلتزم المعلم بالحفاظ على سرية حسابه وبيانات دخوله، ويتحمل كامل المسؤولية عن دقة وصحة البيانات المسجلة.
                  </p>
                </div>

                <div className="rounded-2xl bg-slate-800/40 border border-slate-800 p-3.5 space-y-1.5">
                  <h4 className="font-bold text-white text-xs">2. الاشتراكات والدفع والتجربة المجانية</h4>
                  <p className="text-[11px] text-slate-300">
                    تمنح المنصة فترة تجريبية مجانية لجميع المعلمين الجدد لمدة 7 أيام. بعد انتهاء الفترة التجريبية، يتطلب استمرار الوصول إلى الميزات الكاملة تفعيل خطة اشتراك معتمدة (شهرية أو سنوية).
                  </p>
                </div>

                <div className="rounded-2xl bg-slate-800/40 border border-slate-800 p-3.5 space-y-1.5">
                  <h4 className="font-bold text-white text-xs">3. النسخ الاحتياطي واستمرارية الخدمة</h4>
                  <p className="text-[11px] text-slate-300">
                    تعتمد المنصة آليات النسخ الاحتياطي اليومي وتقنية الاسترجاع المستمر (PITR). ومع ذلك يُنصح المعلم دائماً بالاحتفاظ بنسخة احتياطية محلية من خلال ميزة تصدير البيانات المتوفرة في الإعدادات.
                  </p>
                </div>

                <div className="rounded-2xl bg-slate-800/40 border border-slate-800 p-3.5 space-y-1.5">
                  <h4 className="font-bold text-white text-xs">4. إنهاء الحساب وإلغاء الاشتراك</h4>
                  <p className="text-[11px] text-slate-300">
                    يمكن للمعلم إلغاء اشتراكه أو حذف حسابه نهائياً في أي وقت بضغطة زر واحدة من لوحة الإعدادات، وسيتم مسح بياناته بالكامل فور تأكيد الطلب.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-800 flex items-center justify-between flex-shrink-0">
          <span className="text-[11px] text-emerald-400 flex items-center gap-1 font-medium">
            <CheckCircle className="w-3.5 h-3.5" />
            <span>متوافق مع أفضل الممارسات الأمنية والقانونية</span>
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition cursor-pointer"
          >
            فهمت وموافق
          </button>
        </div>
      </div>
    </div>
  );
};
