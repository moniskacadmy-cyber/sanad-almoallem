import React, { useState } from 'react';
import { TeacherProfile, Student, ScheduleSlot, LibraryItem } from '../types';
import { updateTeacherProfile, auth } from '../firebase';
import { signOut } from 'firebase/auth';
import { PWAInstallButton } from '../PWAInstallButton';
import {
  User,
  Shield,
  CreditCard,
  Download,
  LogOut,
  Bell,
  Sparkles,
  Phone,
  Mail,
  BookOpen,
  Edit2,
  X,
  FileSpreadsheet,
  CheckCircle2,
  ShieldAlert,
  Smartphone,
} from 'lucide-react';

interface SettingsTabProps {
  profile: TeacherProfile;
  students: Student[];
  schedules: ScheduleSlot[];
  libraryItems: LibraryItem[];
  isAdmin?: boolean;
  onOpenUpgradeModal: () => void;
  onOpenAdminDashboard?: () => void;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({
  profile,
  students,
  schedules,
  libraryItems,
  isAdmin,
  onOpenUpgradeModal,
  onOpenAdminDashboard,
}) => {
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [editName, setEditName] = useState(profile.name);
  const [editWhatsapp, setEditWhatsapp] = useState(profile.whatsapp);
  const [editSubject, setEditSubject] = useState(profile.subject);
  const [savingProfile, setSavingProfile] = useState(false);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim() || !editWhatsapp.trim()) return;
    setSavingProfile(true);
    try {
      await updateTeacherProfile(profile.id, {
        name: editName.trim(),
        whatsapp: editWhatsapp.trim(),
        subject: editSubject.trim(),
      });
      setShowEditProfile(false);
    } catch (err) {
      console.error('Error updating profile', err);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSignOut = async () => {
    if (window.confirm('هل تريد بالتأكيد تسجيل الخروج من حسابك؟')) {
      await signOut(auth);
    }
  };

  // Export full backup as JSON
  const handleExportJSON = () => {
    const backupData = {
      profile,
      students,
      schedules,
      libraryItems,
      exportedAt: new Date().toISOString(),
      app: 'Sanad Al-Moallem سند المعلم',
    };
    const jsonStr = JSON.stringify(backupData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sanad_teacher_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setExportNotice('تم تصدير ملف النسخة الاحتياطية بنجاح!');
    setTimeout(() => setExportNotice(null), 3000);
  };

  // Export Students as CSV
  const handleExportStudentsCSV = () => {
    const headers = ['الاسم', 'رقم الواتساب', 'المادة', 'نوع الحصة', 'المصروفات الشهرية', 'حالة الدفع'];
    const rows = students.map((s) => [
      `"${s.name}"`,
      `"${s.whatsapp}"`,
      `"${s.subject}"`,
      `"${s.classType === 'online' ? 'أونلاين' : s.classType === 'center' ? 'سنتر' : 'برايفيت'}"`,
      s.monthlyFee,
      `"${s.paymentStatus === 'paid' ? 'دفع' : 'لم يدفع'}"`,
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sanad_students_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setExportNotice('تم تصدير جدول الطلاب (Excel CSV) بنجاح!');
    setTimeout(() => setExportNotice(null), 3000);
  };

  const getSubscriptionInfo = () => {
    if (!profile.subscriptionExpiresAt) return { title: 'غير محدد', color: 'text-slate-400' };
    const expiry = profile.subscriptionExpiresAt.toDate
      ? profile.subscriptionExpiresAt.toDate()
      : new Date(profile.subscriptionExpiresAt);
    const diffDays = Math.ceil((expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

    if (profile.subscriptionStatus === 'active') {
      return {
        title: 'مشترك نشط 💎',
        sub: `صالح حتى ${new Intl.DateTimeFormat('ar-EG', { dateStyle: 'long' }).format(expiry)} (${diffDays} يوم متبقي)`,
        badgeBg: 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300',
      };
    }
    if (diffDays <= 0 || profile.subscriptionStatus === 'expired') {
      return {
        title: 'الاشتراك منتهي ⚠️',
        sub: 'يرجى التجديد للمتابعة',
        badgeBg: 'bg-rose-950/60 border-rose-500/40 text-rose-300',
      };
    }
    return {
      title: 'فترة تجريبية مجانية 🎁',
      sub: `متبقي ${diffDays} ${diffDays === 1 ? 'يوم' : 'أيام'} (ينتهي في ${new Intl.DateTimeFormat('ar-EG', { dateStyle: 'medium' }).format(expiry)})`,
      badgeBg: 'bg-purple-950/70 border-purple-500/40 text-purple-300',
    };
  };

  const subInfo = getSubscriptionInfo();

  return (
    <div className="space-y-4 pb-20">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-white">الإعدادات والحساب</h2>
        <p className="text-xs text-slate-400">إدارة الملف الشخصي، حالة الاشتراك والنسخ الاحتياطي</p>
      </div>

      {exportNotice && (
        <div className="p-3 rounded-2xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span>{exportNotice}</span>
        </div>
      )}

      {/* Teacher Profile Card */}
      <div className="rounded-2xl bg-slate-900/80 border border-purple-500/20 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-purple-800 to-indigo-600 flex items-center justify-center text-white font-bold text-base shadow">
              {profile.name.charAt(0)}
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">{profile.name}</h3>
              <p className="text-xs text-purple-300">مادة: {profile.subject}</p>
            </div>
          </div>

          <button
            onClick={() => {
              setEditName(profile.name);
              setEditWhatsapp(profile.whatsapp);
              setEditSubject(profile.subject);
              setShowEditProfile(true);
            }}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
            title="تعديل الملف الشخصي"
          >
            <Edit2 className="w-4 h-4" />
          </button>
        </div>

        <div className="pt-2 border-t border-slate-800 grid grid-cols-2 gap-2 text-xs text-slate-300">
          <div className="flex items-center gap-1.5">
            <Mail className="w-3.5 h-3.5 text-slate-400" />
            <span className="truncate">{profile.email}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Phone className="w-3.5 h-3.5 text-slate-400" />
            <span dir="ltr">{profile.whatsapp}</span>
          </div>
        </div>
      </div>

      {/* Subscription Card */}
      <div className="rounded-2xl bg-slate-900/80 border border-purple-500/20 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-purple-400" />
            <h3 className="text-sm font-bold text-white">حالة الاشتراك</h3>
          </div>
          <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${subInfo.badgeBg}`}>
            {subInfo.title}
          </span>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed">{subInfo.sub}</p>

        <button
          onClick={onOpenUpgradeModal}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 py-2.5 px-4 text-xs font-bold text-white shadow-md hover:brightness-110 active:scale-98 transition cursor-pointer"
        >
          <Sparkles className="w-4 h-4 text-amber-300" />
          <span>تجديد أو ترقية الباقة الآن</span>
        </button>
      </div>

      {/* PWA Install Component */}
      <div className="rounded-2xl bg-slate-900/80 border border-purple-500/20 p-4 space-y-2">
        <div className="flex items-center gap-2">
          <Smartphone className="w-4 h-4 text-purple-400" />
          <h3 className="text-sm font-bold text-white">تثبيت التطبيق على جهازك (PWA)</h3>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed">
          ثبّت "سند المعلم" على الشاشة الرئيسية لهاتفك للوصول السريع بدون كتابة الرابط والعمل أسرع.
        </p>
        <PWAInstallButton />
      </div>

      {/* Data Export Card */}
      <div className="rounded-2xl bg-slate-900/80 border border-purple-500/20 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Download className="w-4 h-4 text-purple-400" />
          <h3 className="text-sm font-bold text-white">تصدير وحفظ البيانات</h3>
        </div>
        <p className="text-xs text-slate-300">
          بياناتك ملكك دائماً! يمكنك تحميل نسخة احتياطية من كل سجلاتك في أي وقت.
        </p>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handleExportStudentsCSV}
            className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-purple-300 text-xs font-semibold border border-slate-700 transition cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>تصدير الطلاب (Excel)</span>
          </button>
          <button
            onClick={handleExportJSON}
            className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-purple-300 text-xs font-semibold border border-slate-700 transition cursor-pointer"
          >
            <Download className="w-4 h-4 text-indigo-400" />
            <span>نسخة احتياطية (JSON)</span>
          </button>
        </div>
      </div>

      {/* Sign Out Button */}
      <button
        onClick={handleSignOut}
        className="w-full flex items-center justify-center gap-2 rounded-2xl bg-rose-950/40 hover:bg-rose-950/60 border border-rose-500/30 py-3 text-xs font-bold text-rose-300 transition active:scale-98 cursor-pointer"
      >
        <LogOut className="w-4 h-4" />
        <span>تسجيل الخروج من الحساب</span>
      </button>

      {/* App Footer */}
      <div className="text-center pt-2 text-[11px] text-slate-500">
        <p>سند المعلم • الإصدار 1.0.0 (PWA)</p>
        <p className="mt-0.5">الدعم الفني والاشتراكات: 01025967471</p>
      </div>

      {/* Edit Profile Modal */}
      {showEditProfile && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-slate-900 border border-purple-500/30 rounded-3xl p-5 shadow-2xl text-right">
            <div className="flex items-center justify-between border-b border-purple-900/40 pb-3 mb-4">
              <h3 className="text-base font-bold text-white">تعديل الملف الشخصي</h3>
              <button
                onClick={() => setShowEditProfile(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">اسم المعلم</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                  className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">رقم الواتساب</label>
                <input
                  type="tel"
                  value={editWhatsapp}
                  onChange={(e) => setEditWhatsapp(e.target.value)}
                  required
                  dir="ltr"
                  className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-400 text-right"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">المادة الرئيسية</label>
                <input
                  type="text"
                  value={editSubject}
                  onChange={(e) => setEditSubject(e.target.value)}
                  required
                  className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-400"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="w-full rounded-xl bg-purple-600 hover:bg-purple-500 py-2.5 text-xs font-bold text-white transition cursor-pointer"
                >
                  {savingProfile ? 'جارٍ الحفظ...' : 'حفظ التغييرات'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
