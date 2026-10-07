import React, { useState } from 'react';
import { Shield, FileText, X, CheckCircle, Lock, Users, Database, Trash2, Download, Bot, Bell, KeyRound, AlertTriangle } from 'lucide-react';

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
                {activeTab === 'privacy' ? 'سياسة الخصوصية وحماية البيانات' : 'شروط الخدمة والاستخدام'}
              </h2>
              <p className="text-[11px] text-slate-400">منصة سند المعلم • التزام مهني وقانوني لحماية البيانات التعليمية</p>
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
                  ميثاق حماية وخصوصية البيانات التعليمية
                </h3>
                <p className="text-[11px] leading-relaxed">
                  تلتزم منصة «سند المعلم» بأعلى معايير حماية الخصوصية والأمان الرقمي للبيانات التي يديرها المعلم عبر التطبيق.
                </p>
              </div>

              <div className="space-y-3">
                <div className="rounded-2xl bg-slate-800/40 border border-slate-800 p-3.5 space-y-1.5">
                  <h4 className="font-bold text-white text-xs flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-purple-400" />
                    1. بيانات المعلم والطلاب والأنشطة
                  </h4>
                  <p className="text-[11px] text-slate-300">
                    تشمل البيانات المسجلة: بيانات المعلم (الاسم، البريد الإلكتروني، رقم الهاتف، العملة)، وبيانات الطلاب (الأسماء، جهات اتصال أولياء الأمور، المواعيد)، بالإضافة إلى سجلات الحضور والغياب، الدرجات، الملاحظات والتقارير التربوية. تُستخدم هذه البيانات حصرياً لتنظيم جدول المعلم ومتابعة طلابه.
                  </p>
                </div>

                <div className="rounded-2xl bg-slate-800/40 border border-slate-800 p-3.5 space-y-1.5">
                  <h4 className="font-bold text-white text-xs flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5 text-emerald-400" />
                    2. التخزين وقواعد بيانات Firebase Firestore
                  </h4>
                  <p className="text-[11px] text-slate-300">
                    تُحفظ البيانات في خوادم Google Cloud و Firebase Firestore المحمية بقواعد أمان صارمة (Firestore Security Rules)، وتُشفر البيانات أثناء النقل (TLS 1.3) وأثناء التخزين (AES-256). كل معلم يمتلك نطاق بيانات معزول ولا يمكن لأي معلم آخر الاطلاع على بياناته أو سجلات طلابه.
                  </p>
                </div>

                <div className="rounded-2xl bg-slate-800/40 border border-slate-800 p-3.5 space-y-1.5">
                  <h4 className="font-bold text-white text-xs flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                    3. المصادقة وحماية الحساب (Firebase Authentication)
                  </h4>
                  <p className="text-[11px] text-slate-300">
                    تتم عمليات تسجيل الدخول والتحقق الآمن عبر خدمة Firebase Authentication الموثوقة، مع استخدام رموز التحقق المشفرة والأذونات المبنية على الأدوار لحماية حسابك من أي وصول غير مصرح به.
                  </p>
                </div>

                <div className="rounded-2xl bg-slate-800/40 border border-slate-800 p-3.5 space-y-1.5">
                  <h4 className="font-bold text-white text-xs flex items-center gap-1.5">
                    <Bot className="w-3.5 h-3.5 text-blue-400" />
                    4. استخدام الذكاء الاصطناعي (AI Assistant)
                  </h4>
                  <p className="text-[11px] text-slate-300">
                    عند استخدام المساعد الذكي لإعداد الخطط الدراسية أو الاختبارات أو استشارات الدروس، تُرسل الاستفسارات بشكل آمن لمعالجة الطلب فقط، ولا تُستخدم بياناتك الشخصية أو بيانات طلابك في تدريب النماذج العامة.
                  </p>
                </div>

                <div className="rounded-2xl bg-slate-800/40 border border-slate-800 p-3.5 space-y-1.5">
                  <h4 className="font-bold text-white text-xs flex items-center gap-1.5">
                    <Bell className="w-3.5 h-3.5 text-teal-400" />
                    5. التنبيهات والإشعارات الفورية (Web Push & Local Reminders)
                  </h4>
                  <p className="text-[11px] text-slate-300">
                    تعتمد خدمة التذكير على فحص محلي مجاني في المتصفح، بالإضافة إلى رموز FCM المشفرة لإرسال تذكيرات الحصص على شاشة هاتفك عند تفعيلها. لا يتم إرسال أي إعلانات أو إشعارات غير متعلقة بجدول حصصك.
                  </p>
                </div>

                <div className="rounded-2xl bg-slate-800/40 border border-slate-800 p-3.5 space-y-1.5">
                  <h4 className="font-bold text-white text-xs flex items-center gap-1.5">
                    <Download className="w-3.5 h-3.5 text-indigo-400" />
                    6. تصدير البيانات (Right to Portability)
                  </h4>
                  <p className="text-[11px] text-slate-300">
                    يحق للمعلم تصدير كافة بياناته وسجلات طلابه وحصصه في أي وقت بصيغتي JSON و Excel/CSV دون أي قيود، لضمان استقلالية البيانات وسهولة نقلها.
                  </p>
                </div>

                <div className="rounded-2xl bg-slate-800/40 border border-slate-800 p-3.5 space-y-1.5">
                  <h4 className="font-bold text-white text-xs flex items-center gap-1.5">
                    <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                    7. حذف الحساب والبيانات نهائياً (Right to Erasure)
                  </h4>
                  <p className="text-[11px] text-slate-300">
                    يوفر التطبيق خيار «حذف الحساب نهائياً» الذي يتيح للمعلم إزالة كافة بياناته وسجلات طلابه ومواعيده وملفاته من قاعدة البيانات بصورة فورية ونهائية.
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
                  باستخدامك لمنصة «سند المعلم»، فإنك تقر وتوافق على الالتزام بالشروط والأحكام التالية:
                </p>
              </div>

              <div className="space-y-3">
                <div className="rounded-2xl bg-slate-800/40 border border-slate-800 p-3.5 space-y-1.5">
                  <h4 className="font-bold text-white text-xs">1. الاستخدام المسموح والغرض التعليمي</h4>
                  <p className="text-[11px] text-slate-300">
                    المنصة مخصصة للأغراض التعليمية والإدارية والتنظيمية للمعلمين لإدارة المواعيد والدروس والطلاب والتقارير.
                  </p>
                </div>

                <div className="rounded-2xl bg-slate-800/40 border border-slate-800 p-3.5 space-y-1.5">
                  <h4 className="font-bold text-white text-xs">2. مسؤولية المستخدم عن البيانات</h4>
                  <p className="text-[11px] text-slate-300">
                    يتحمل المعلم كامل المسؤولية عن دقة وصحة البيانات التي يُدخلها في التطبيق (كبيانات الطلاب، وأرقام هواتف أولياء الأمور، والحصص المالية)، والالتزام بالحصول على الموافقات اللازمة لتسجيل جهات الاتصال الخاصة بطلابه.
                  </p>
                </div>

                <div className="rounded-2xl bg-slate-800/40 border border-slate-800 p-3.5 space-y-1.5">
                  <h4 className="font-bold text-white text-xs flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                    3. تنبيهات الذكاء الاصطناعي وحدود الاعتماد عليه
                  </h4>
                  <p className="text-[11px] text-slate-300">
                    يعمل المساعد الذكي كأداة مساعدة للمعلم. قد يُنتج الذكاء الاصطناعي معلومات غير دقيقة أو بحاجة إلى مراجعة وتدقيق؛ لذا يجب عدم الاعتماد عليه كمصدر وحيد لاتخاذ قرارات تقييمية حساسة أو مصيرية للطلاب دون مراجعة المعلم المتخصص.
                  </p>
                </div>

                <div className="rounded-2xl bg-slate-800/40 border border-slate-800 p-3.5 space-y-1.5">
                  <h4 className="font-bold text-white text-xs">4. حدود المسؤولية واستمرارية الخدمة</h4>
                  <p className="text-[11px] text-slate-300">
                    نبذل أقصى جهد لضمان استقرار التطبيق وتوفير التنبيهات الدقيقة، ولا تتحمل المنصة أي مسؤولية عن انقطاع الإنترنت لدى المستخدم أو أعطال شبكات الاتصال أو حظر الإشعارات من إعدادات جهاز المستخدم.
                  </p>
                </div>

                <div className="rounded-2xl bg-slate-800/40 border border-slate-800 p-3.5 space-y-1.5">
                  <h4 className="font-bold text-white text-xs">5. شروط الاشتراكات وفترة التجربة</h4>
                  <p className="text-[11px] text-slate-300">
                    تمنح المنصة فترة تجريبية مجانية لجميع المعلمين الجدد لمدة 7 أيام. بعد انتهاء الفترة التجريبية، يتطلب استمرار الوصول إلى الميزات الكاملة تفعيل خطة اشتراك معتمدة.
                  </p>
                </div>

                <div className="rounded-2xl bg-slate-800/40 border border-slate-800 p-3.5 space-y-1.5">
                  <h4 className="font-bold text-white text-xs">6. إنهاء الحساب</h4>
                  <p className="text-[11px] text-slate-300">
                    يحق للمعلم التوقف عن استخدام المنصة أو حذف حسابه وبياناته في أي وقت عبر قسم الإعدادات.
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
            <span>متوافق مع أفضل الممارسات الأمنية والتربوية</span>
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

