import React, { useState, useRef } from 'react';
import { TeacherProfile, Student, ScheduleSlot, LibraryItem, BackupData, ReminderLog, ReminderSettings } from '../types';
import { updateTeacherProfile, auth, fetchAllStudentLessons, importFullTeacherBackup } from '../firebase';
import { signOut } from 'firebase/auth';
import { PWAInstallButton } from '../PWAInstallButton';
import confetti from 'canvas-confetti';
import {
  getStoredReminderSettings,
  storeReminderSettings,
  requestBrowserNotificationPermission,
  showBrowserNotification,
  playNotificationChime,
  checkRemindersApi,
  fetchCronStatusApi,
  triggerTestReminderApi,
} from '../services/reminderService';
import {
  User,
  Shield,
  CreditCard,
  Download,
  Upload,
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
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  FileJson,
  RefreshCw,
  FileUp,
  Clock,
  MessageCircle,
  Check,
  ExternalLink,
  Volume2,
  VolumeX,
  Copy,
  Send,
  DollarSign,
  TrendingUp,
  ChevronLeft,
} from 'lucide-react';

interface SettingsTabProps {
  profile: TeacherProfile;
  students: Student[];
  schedules: ScheduleSlot[];
  libraryItems: LibraryItem[];
  isAdmin?: boolean;
  onOpenUpgradeModal: () => void;
  onOpenAdminDashboard?: () => void;
  onOpenFinancialDashboard?: () => void;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({
  profile,
  students,
  schedules,
  libraryItems,
  isAdmin,
  onOpenUpgradeModal,
  onOpenAdminDashboard,
  onOpenFinancialDashboard,
}) => {
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [editName, setEditName] = useState(profile.name);
  const [editWhatsapp, setEditWhatsapp] = useState(profile.whatsapp);
  const [editSubject, setEditSubject] = useState(profile.subject);
  const [editCurrency, setEditCurrency] = useState(profile.currency || 'ج.م');
  const [savingProfile, setSavingProfile] = useState(false);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  // Backup & Import state
  const [isExporting, setIsExporting] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importBackupData, setImportBackupData] = useState<BackupData | null>(null);
  const [importFileName, setImportFileName] = useState<string>('');
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Admin Passcode Modal State
  const [showAdminPinModal, setShowAdminPinModal] = useState(false);
  const [adminPinInput, setAdminPinInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);

  // Automated Class Reminders State (15-min Cron Job)
  const [reminderSettings, setReminderSettings] = useState<ReminderSettings>(() => getStoredReminderSettings());
  const [browserPermission, setBrowserPermission] = useState<string>(() => {
    return typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'denied';
  });
  const [isCheckingReminders, setIsCheckingReminders] = useState(false);
  const [reminderCheckNotice, setReminderCheckNotice] = useState<string | null>(null);
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [cronLogs, setCronLogs] = useState<ReminderLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Test Reminder Modal State
  const [showTestModal, setShowTestModal] = useState(false);
  const [testStudentName, setTestStudentName] = useState<string>('');
  const [testStudentPhone, setTestStudentPhone] = useState<string>('');
  const [testClassTime, setTestClassTime] = useState<string>('16:00');
  const [testLocation, setTestLocation] = useState<string>('');
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testSuccessData, setTestSuccessData] = useState<any | null>(null);

  const handleUpdateReminderSetting = (key: keyof ReminderSettings, val: any) => {
    const updated = { ...reminderSettings, [key]: val };
    setReminderSettings(updated);
    storeReminderSettings(updated);
  };

  const handleRequestNotificationPermission = async () => {
    const perm = await requestBrowserNotificationPermission();
    setBrowserPermission(perm);
    if (perm === 'granted') {
      showBrowserNotification('سند المعلم 🔔', 'تم تفعيل إشعارات الحصص التلقائية بنجاح!');
      playNotificationChime();
    }
  };

  const handleManualCheckReminders = async () => {
    setIsCheckingReminders(true);
    setReminderCheckNotice(null);
    try {
      const res = await checkRemindersApi({
        teacher: profile,
        schedules,
        students,
        minutesBefore: reminderSettings.minutesBefore || 15,
      });

      if (res.matchedReminders && res.matchedReminders.length > 0) {
        if (reminderSettings.soundEnabled) {
          playNotificationChime();
        }
        showBrowserNotification(
          '🔔 تذكير بحصة قادمة!',
          `لديك ${res.matchedReminders.length} تذكير لحصص تبدأ بعد ${reminderSettings.minutesBefore} دقيقة.`
        );
        setReminderCheckNotice(
          `تم الفحص بنجاح! تم العثور على (${res.matchedReminders.length}) حصة قادمة بعد ${reminderSettings.minutesBefore} دقيقة وتجهيز رسائل الواتساب.`
        );
      } else {
        setReminderCheckNotice(
          `تم الفحص بنجاح. لا توجد حصص مجدولة تبدأ خلال الـ ${reminderSettings.minutesBefore} دقيقة القادمة حالياً.`
        );
      }
      setTimeout(() => setReminderCheckNotice(null), 6000);
    } catch (e: any) {
      setReminderCheckNotice('حدث خطأ أثناء فحص جدول الحصص.');
    } finally {
      setIsCheckingReminders(false);
    }
  };

  const handleOpenLogsModal = async () => {
    setShowLogsModal(true);
    setLoadingLogs(true);
    try {
      const status = await fetchCronStatusApi();
      setCronLogs(status.recentLogs || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleSendTestReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testStudentName.trim()) return;
    setIsSendingTest(true);
    try {
      const res = await triggerTestReminderApi({
        studentName: testStudentName.trim(),
        teacherName: profile.name,
        subject: profile.subject,
        classTime: testClassTime,
        studentWhatsapp: testStudentPhone.trim(),
        teacherWhatsapp: profile.whatsapp,
        locationOrLink: testLocation.trim(),
      });
      setTestSuccessData(res);
      if (reminderSettings.soundEnabled) {
        playNotificationChime();
      }
    } catch (err: any) {
      alert(err.message || 'فشل إرسال التذكير التجريبي');
    } finally {
      setIsSendingTest(false);
    }
  };

  const handleVerifyAdminPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPinInput.trim() === '2882026') {
      setShowAdminPinModal(false);
      setAdminPinInput('');
      setPinError(null);
      if (onOpenAdminDashboard) {
        onOpenAdminDashboard();
      }
    } else {
      setPinError('رمز الدخول غير صحيح');
      setAdminPinInput('');
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim() || !editWhatsapp.trim()) return;
    setSavingProfile(true);
    try {
      await updateTeacherProfile(profile.id, {
        name: editName.trim(),
        whatsapp: editWhatsapp.trim(),
        subject: editSubject.trim(),
        currency: editCurrency.trim(),
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

  // Export full backup as JSON (including all students, schedules, lessons, and library items)
  const handleExportJSON = async () => {
    setIsExporting(true);
    setExportNotice('جارٍ تجميع بيانات الطلاب والمواعيد وسجل الحصص...');
    try {
      const allLessons = await fetchAllStudentLessons(profile.id, students);
      const totalLessonsCount = Object.values(allLessons).reduce((acc, curr) => acc + curr.length, 0);

      const backupData: BackupData = {
        version: 1,
        exportedAt: new Date().toISOString(),
        app: 'Sanad Al-Moallem سند المعلم',
        profile,
        students,
        schedules,
        lessons: allLessons,
        libraryItems,
      };

      const jsonStr = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sanad_backup_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);

      setExportNotice(
        `تم تصدير النسخة الاحتياطية بنجاح! (${students.length} طالب • ${schedules.length} موعد • ${totalLessonsCount} حصة)`
      );
      confetti({ particleCount: 50, spread: 60, origin: { y: 0.8 } });
      setTimeout(() => setExportNotice(null), 4000);
    } catch (err) {
      console.error('Error exporting full backup:', err);
      setExportNotice('حدث خطأ أثناء تصدير البيانات، يرجى المحاولة مرة أخرى.');
    } finally {
      setIsExporting(false);
    }
  };

  // Handle file select for JSON import
  const handleFileSelectForImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFileName(file.name);
    setImportError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);

        // Basic verification
        if (!parsed || (typeof parsed !== 'object')) {
          throw new Error('الملف لا يحتوي على بيانات صالحة.');
        }

        if (!Array.isArray(parsed.students) && !Array.isArray(parsed.schedules) && !parsed.profile) {
          throw new Error('تنسيق الملف غير متوافق مع نسخ سند المعلم الاحتياطية.');
        }

        setImportBackupData(parsed as BackupData);
        setShowImportModal(true);
      } catch (err: any) {
        setImportError(err.message || 'فشل في قراءة ملف النسخة الاحتياطية.');
        setShowImportModal(true);
      }
    };

    reader.onerror = () => {
      setImportError('تعذر فتح الملف، يرجى التحقق من أذونات الملف.');
      setShowImportModal(true);
    };

    reader.readAsText(file);
    // Reset file input so same file can be re-selected if needed
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Confirm and execute the data restore
  const handleConfirmImport = async () => {
    if (!importBackupData) return;
    setIsImporting(true);
    setImportError(null);

    try {
      const summary = await importFullTeacherBackup(profile.id, importBackupData);
      setShowImportModal(false);
      setImportBackupData(null);
      setExportNotice(
        `تمت استعادة البيانات بنجاح! تم استيراد ${summary.studentsCount} طالب، و${summary.schedulesCount} موعد، و${summary.lessonsCount} حصة.`
      );
      confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
      setTimeout(() => setExportNotice(null), 5000);
    } catch (err: any) {
      console.error('Error importing backup:', err);
      setImportError(err.message || 'حدث خطأ أثناء استعادة البيانات.');
    } finally {
      setIsImporting(false);
    }
  };

  // Export Students as CSV
  const handleExportStudentsCSV = () => {
    const headers = ['الاسم', 'رقم الواتساب', 'المادة', 'نوع الحصة', 'سعر الساعة (ج.م)', 'حالة الدفع'];
    const rows = students.map((s) => [
      `"${s.name}"`,
      `"${s.whatsapp || ''}"`,
      `"${s.subject}"`,
      `"${s.classType === 'online' ? 'أونلاين' : s.classType === 'trial' ? 'حصة تجريبية' : s.classType === 'center' ? 'سنتر' : 'حضور شخصي'}"`,
      s.hourlyRate || (s.monthlyFee ? Math.round(s.monthlyFee / 4) : 100),
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
              setEditCurrency(profile.currency || 'ج.م');
              setShowEditProfile(true);
            }}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
            title="تعديل الملف الشخصي"
          >
            <Edit2 className="w-4 h-4" />
          </button>
        </div>

        <div className="pt-2 border-t border-slate-800 grid grid-cols-3 gap-2 text-xs text-slate-300">
          <div className="flex items-center gap-1.5 col-span-1">
            <Mail className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            <span className="truncate">{profile.email}</span>
          </div>
          <div className="flex items-center gap-1.5 col-span-1">
            <Phone className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            <span dir="ltr">{profile.whatsapp}</span>
          </div>
          <div className="flex items-center gap-1.5 col-span-1 justify-end">
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-950/80 border border-purple-500/30 text-purple-300 font-bold whitespace-nowrap">
              العملة: {profile.currency || 'ج.م'}
            </span>
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

      {/* Admin Panel Option */}
      <div className="rounded-2xl bg-gradient-to-r from-purple-950/70 via-slate-900 to-indigo-950/60 border border-purple-500/30 p-4 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-300 flex items-center justify-center border border-amber-500/30 shadow-inner">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">لوحة الإدارة (Admin Panel)</h3>
              <p className="text-xs text-purple-200/80">إدارة المعلمين وتفعيل وتمديد الاشتراكات</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowAdminPinModal(true)}
            className="px-3.5 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black transition cursor-pointer shadow-md shadow-amber-500/20 flex items-center gap-1.5 active:scale-98"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>دخول</span>
          </button>
        </div>
      </div>

      {/* Financial Summary & Earnings Dashboard Entry */}
      {onOpenFinancialDashboard && (
        <div
          onClick={onOpenFinancialDashboard}
          className="rounded-2xl bg-gradient-to-r from-emerald-950/70 via-slate-900 to-teal-950/70 border border-emerald-500/40 p-4 space-y-3 cursor-pointer hover:border-emerald-400 transition shadow-xl group"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow group-hover:scale-105 transition flex-shrink-0">
                <DollarSign className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-white">الملخص المالي والأرباح</h3>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 border border-emerald-500/40 text-emerald-300 font-bold">
                    نظام سعر الساعة 💰
                  </span>
                </div>
                <p className="text-xs text-emerald-200/80 mt-0.5">
                  أرباح الشهر، إجمالي ساعات التدريس، المستحقات المعلقة، وتصفية حساب الطلاب
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 text-xs font-bold text-emerald-300 group-hover:translate-x-[-2px] transition flex-shrink-0">
              <span>فتح لوحة الأرباح</span>
              <ChevronLeft className="w-4 h-4" />
            </div>
          </div>
        </div>
      )}

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

      {/* Data Backup & Restore Card */}
      <div className="rounded-2xl bg-gradient-to-r from-purple-950/40 via-slate-900 to-indigo-950/40 border border-purple-500/30 p-4 space-y-3.5 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-purple-600/20 text-purple-300 flex items-center justify-center border border-purple-500/30">
              <FileJson className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">النسخ الاحتياطي واستعادة البيانات</h3>
              <p className="text-[11px] text-purple-200/80">تصدير واستيراد ملفات JSON الشاملة</p>
            </div>
          </div>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed">
          بياناتك ملكك دائماً! يمكنك تصدير نسخة احتياطية كاملة من بياناتك (الطلاب، المواعيد، سجل الحصص) كملف JSON محلي، مع إمكانية استيراد الملف لاحقاً لاستعادة البيانات في أي وقت.
        </p>

        {/* Hidden File Input for JSON import */}
        <input
          type="file"
          ref={fileInputRef}
          accept=".json,application/json"
          onChange={handleFileSelectForImport}
          className="hidden"
        />

        <div className="grid grid-cols-2 gap-2">
          {/* Export JSON Button */}
          <button
            type="button"
            disabled={isExporting}
            onClick={handleExportJSON}
            className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition cursor-pointer shadow-md disabled:opacity-50"
          >
            {isExporting ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            <span>{isExporting ? 'جارٍ التصدير...' : 'تصدير نسخة (JSON)'}</span>
          </button>

          {/* Import JSON Button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition cursor-pointer shadow-md active:scale-98"
          >
            <Upload className="w-4 h-4" />
            <span>استيراد واستعادة (JSON)</span>
          </button>
        </div>

        {/* Export CSV for Excel */}
        <button
          type="button"
          onClick={handleExportStudentsCSV}
          className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition cursor-pointer"
        >
          <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
          <span>تصدير قائمة الطلاب كملف Excel (CSV)</span>
        </button>
      </div>

      {/* Automated Class Reminders Card (Cron Job 15-min) */}
      <div className="rounded-2xl bg-gradient-to-r from-purple-950/50 via-slate-900 to-indigo-950/50 border border-purple-500/30 p-4 space-y-4 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-md flex-shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">التذكير التلقائي بالحصص (قبل 15 دقيقة)</h3>
              </div>
              <p className="text-[11px] text-purple-200/80 mt-0.5">
                فحص دوري كل 15 دقيقة عبر دالة Cron Job لإرسال رسائل واتساب وإشعارات للوالدين والمعلمين
              </p>
            </div>
          </div>
          <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 flex-shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Cron Job نشط</span>
          </span>
        </div>

        {/* Status Notice */}
        {reminderCheckNotice && (
          <div className="p-3 rounded-xl bg-purple-950/80 border border-purple-500/40 text-purple-200 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-amber-300 flex-shrink-0" />
            <span>{reminderCheckNotice}</span>
          </div>
        )}

        {/* Master Toggle */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800">
          <div>
            <span className="text-xs font-bold text-white block">خدمة التذكير التلقائي</span>
            <span className="text-[11px] text-slate-400">تشغيل فحص الجدول وإرسال الرسائل قبل الحصة</span>
          </div>
          <button
            type="button"
            onClick={() => handleUpdateReminderSetting('enabled', !reminderSettings.enabled)}
            className={`w-12 h-6 flex items-center rounded-full p-1 transition cursor-pointer ${
              reminderSettings.enabled ? 'bg-emerald-600 justify-end' : 'bg-slate-700 justify-start'
            }`}
          >
            <span className="bg-white w-4 h-4 rounded-full shadow-md transform transition" />
          </button>
        </div>

        {reminderSettings.enabled && (
          <div className="space-y-3 pt-1 border-t border-purple-900/30">
            {/* Notification & WhatsApp Options */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {/* WhatsApp to Parents */}
              <div
                onClick={() => handleUpdateReminderSetting('notifyParent', !reminderSettings.notifyParent)}
                className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition ${
                  reminderSettings.notifyParent
                    ? 'bg-emerald-950/40 border-emerald-500/40 text-white'
                    : 'bg-slate-950/40 border-slate-800 text-slate-400'
                }`}
              >
                <div className="flex items-center gap-2">
                  <MessageCircle className="w-4 h-4 text-emerald-400" />
                  <span>تذكير واتساب لولي الأمر</span>
                </div>
                <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                  reminderSettings.notifyParent ? 'border-emerald-400 bg-emerald-500 text-white' : 'border-slate-600'
                }`}>
                  {reminderSettings.notifyParent && <Check className="w-3 h-3 stroke-[3]" />}
                </div>
              </div>

              {/* Teacher In-app / Web Notification */}
              <div
                onClick={() => handleUpdateReminderSetting('notifyTeacher', !reminderSettings.notifyTeacher)}
                className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition ${
                  reminderSettings.notifyTeacher
                    ? 'bg-purple-950/40 border-purple-500/40 text-white'
                    : 'bg-slate-950/40 border-slate-800 text-slate-400'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-purple-400" />
                  <span>إشعار متصفح للمعلم</span>
                </div>
                <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                  reminderSettings.notifyTeacher ? 'border-purple-400 bg-purple-500 text-white' : 'border-slate-600'
                }`}>
                  {reminderSettings.notifyTeacher && <Check className="w-3 h-3 stroke-[3]" />}
                </div>
              </div>
            </div>

            {/* Time Before Class Selector */}
            <div className="p-3 rounded-xl bg-slate-950/50 border border-slate-800 space-y-2">
              <label className="block text-xs font-semibold text-slate-300">
                توقيت إرسال التذكير قبل موعد الحصة:
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[10, 15, 30].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => handleUpdateReminderSetting('minutesBefore', mins)}
                    className={`py-1.5 rounded-lg text-xs font-bold transition cursor-pointer border ${
                      reminderSettings.minutesBefore === mins
                        ? 'bg-purple-600 border-purple-400 text-white shadow'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {mins} دقيقة {mins === 15 ? '⭐' : ''}
                  </button>
                ))}
              </div>
            </div>

            {/* Sound Toggle */}
            <div className="flex items-center justify-between p-2 rounded-xl bg-slate-950/40 border border-slate-800/80 text-xs">
              <div className="flex items-center gap-2 text-slate-300">
                {reminderSettings.soundEnabled ? (
                  <Volume2 className="w-4 h-4 text-amber-300" />
                ) : (
                  <VolumeX className="w-4 h-4 text-slate-500" />
                )}
                <span>تشغيل نغمة تنبيه صوتية (Chime)</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  const newVal = !reminderSettings.soundEnabled;
                  handleUpdateReminderSetting('soundEnabled', newVal);
                  if (newVal) playNotificationChime();
                }}
                className={`text-[11px] px-2.5 py-1 rounded-lg border font-bold transition cursor-pointer ${
                  reminderSettings.soundEnabled
                    ? 'bg-amber-950/50 border-amber-500/40 text-amber-300'
                    : 'bg-slate-800 border-slate-700 text-slate-400'
                }`}
              >
                {reminderSettings.soundEnabled ? 'مفعل 🔊' : 'صامت 🔇'}
              </button>
            </div>
          </div>
        )}

        {/* Action Buttons Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
          {/* Manual Run Check Now */}
          <button
            type="button"
            disabled={isCheckingReminders}
            onClick={handleManualCheckReminders}
            className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition cursor-pointer shadow-md disabled:opacity-50"
            title="فحص فوري لجدول الحصص القادمة"
          >
            {isCheckingReminders ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Clock className="w-3.5 h-3.5" />
            )}
            <span>{isCheckingReminders ? 'جارٍ الفحص...' : 'فحص الآن ⚡'}</span>
          </button>

          {/* Browser Permission */}
          <button
            type="button"
            onClick={handleRequestNotificationPermission}
            className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
              browserPermission === 'granted'
                ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
            }`}
            title="إذن إشعارات المتصفح والنظام"
          >
            <Bell className="w-3.5 h-3.5 text-amber-400" />
            <span>{browserPermission === 'granted' ? 'الإشعارات مفعلة ✅' : 'طلب إذن الإشعار'}</span>
          </button>

          {/* Test Reminder Modal Button */}
          <button
            type="button"
            onClick={() => {
              setTestSuccessData(null);
              // Pre-fill with first student if available
              if (students.length > 0) {
                setTestStudentName(students[0].name);
                setTestStudentPhone(students[0].whatsapp || '');
              } else {
                setTestStudentName('طالب تجريبي');
                setTestStudentPhone(profile.whatsapp || '');
              }
              setShowTestModal(true);
            }}
            className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold transition cursor-pointer"
          >
            <span>تجربة رسالة 🧪</span>
          </button>

          {/* View Logs Button */}
          <button
            type="button"
            onClick={handleOpenLogsModal}
            className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold transition cursor-pointer"
          >
            <span>سجل التذكيرات 📜</span>
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

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">العملة المفضلة</label>
                <select
                  value={editCurrency}
                  onChange={(e) => setEditCurrency(e.target.value)}
                  required
                  className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-400"
                >
                  <option value="ج.م">ج.م (جنيه مصري)</option>
                  <option value="ر.س">ر.س (ريال سعودي)</option>
                  <option value="د.إ">د.إ (درهم إماراتي)</option>
                  <option value="د.ك">د.ك (دينار كويتي)</option>
                  <option value="د.أ">د.أ (دينار أردني)</option>
                  <option value="ر.ق">ر.ق (ريال قطري)</option>
                  <option value="ر.ع">ر.ع (ريال عماني)</option>
                  <option value="ب.د">ب.د (دينار بحريني)</option>
                  <option value="$">$ (دولار أمريكي)</option>
                </select>
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

      {/* Admin Passcode Modal */}
      {showAdminPinModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 text-right">
          <div className="w-full max-w-sm bg-gradient-to-b from-slate-900 to-slate-950 border border-purple-500/40 rounded-3xl p-6 shadow-2xl relative space-y-4">
            <div className="flex items-center justify-between border-b border-purple-900/40 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center border border-amber-500/30">
                  <ShieldAlert className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-white">دخول لوحة الإدارة</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowAdminPinModal(false);
                  setPinError(null);
                  setAdminPinInput('');
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              يرجى إدخال رمز المرور السري للتحقق والدخول إلى لوحة إدارة المعلمين والاشتراكات:
            </p>

            {pinError && (
              <div className="p-3 rounded-2xl bg-rose-950/90 border border-rose-500/50 text-rose-200 text-xs font-bold flex items-center gap-2 animate-bounce">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
                <span>{pinError}</span>
              </div>
            )}

            <form onSubmit={handleVerifyAdminPin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  رمز المرور السري (Admin Passcode)
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    autoFocus
                    required
                    value={adminPinInput}
                    onChange={(e) => {
                      setAdminPinInput(e.target.value);
                      if (pinError) setPinError(null);
                    }}
                    placeholder="••••••••"
                    className="w-full text-center tracking-widest text-base font-black rounded-xl bg-slate-950 border border-purple-500/40 px-3 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-3 top-3 text-slate-400 hover:text-white transition cursor-pointer"
                    title={showPassword ? 'إخفاء الرمز' : 'إظهار الرمز'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs transition cursor-pointer shadow-lg shadow-amber-600/30 flex items-center justify-center gap-2 active:scale-98"
              >
                <Lock className="w-4 h-4" />
                <span>تحقق ودخول لوحة الإدارة</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* JSON Import & Restore Confirmation Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 text-right">
          <div className="w-full max-w-md bg-slate-900 border border-emerald-500/40 rounded-3xl p-6 shadow-2xl relative space-y-4">
            <div className="flex items-center justify-between border-b border-purple-900/40 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center border border-emerald-500/30">
                  <Upload className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-white">استعادة البيانات من نسخة احتياطية</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowImportModal(false);
                  setImportBackupData(null);
                  setImportError(null);
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {importError ? (
              <div className="space-y-3">
                <div className="p-3.5 rounded-2xl bg-rose-950/80 border border-rose-500/40 text-rose-200 text-xs space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-rose-400" />
                    <span>فشل استيراد الملف:</span>
                  </div>
                  <p>{importError}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowImportModal(false)}
                  className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition cursor-pointer"
                >
                  إغلاق
                </button>
              </div>
            ) : importBackupData ? (
              <div className="space-y-4">
                <div className="bg-slate-950/70 p-3 rounded-2xl border border-slate-800 space-y-1 text-xs">
                  <div className="text-slate-400">
                    اسم الملف: <strong className="text-purple-300 font-mono" dir="ltr">{importFileName}</strong>
                  </div>
                  {importBackupData.exportedAt && (
                    <div className="text-slate-400">
                      تاريخ إنشاء النسخة: <strong className="text-slate-200">
                        {new Intl.DateTimeFormat('ar-EG', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(importBackupData.exportedAt))}
                      </strong>
                    </div>
                  )}
                </div>

                {/* Summary of items in backup */}
                <div>
                  <h4 className="text-xs font-bold text-slate-300 mb-2">محتويات النسخة الاحتياطية المكتشفة:</h4>
                  <div className="grid grid-cols-2 gap-2 text-center text-xs">
                    <div className="p-2.5 rounded-xl bg-slate-950 border border-purple-500/30">
                      <span className="text-[10px] text-slate-400 block">الطلاب</span>
                      <span className="font-bold text-white text-sm font-mono">
                        {importBackupData.students?.length || 0} طالب
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-950 border border-purple-500/30">
                      <span className="text-[10px] text-slate-400 block">المواعيد الأسبوعية</span>
                      <span className="font-bold text-amber-300 text-sm font-mono">
                        {importBackupData.schedules?.length || 0} موعد
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-950 border border-purple-500/30">
                      <span className="text-[10px] text-slate-400 block">سجل الحصص السابقة</span>
                      <span className="font-bold text-emerald-400 text-sm font-mono">
                        {Object.values(importBackupData.lessons || {}).reduce((acc, curr) => acc + (curr?.length || 0), 0)} حصة
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-950 border border-purple-500/30">
                      <span className="text-[10px] text-slate-400 block">المكتبة والمصادر</span>
                      <span className="font-bold text-purple-300 text-sm font-mono">
                        {importBackupData.libraryItems?.length || 0} عنصر
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-amber-950/40 border border-amber-500/30 text-amber-200 text-[11px] leading-relaxed">
                  ⚠️ <strong>تنبيه:</strong> سيتم استيراد وحفظ كافة السجلات المذكورة أعلاه في قاعدة بياناتك السحابية دون التأثير على اشتراكك الحالي.
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    disabled={isImporting}
                    onClick={handleConfirmImport}
                    className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition cursor-pointer shadow-lg shadow-emerald-950/50 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isImporting ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    <span>{isImporting ? 'جارٍ الاستعادة والحفظ...' : 'تأكيد الاستعادة واستيراد البيانات 🚀'}</span>
                  </button>
                  <button
                    type="button"
                    disabled={isImporting}
                    onClick={() => {
                      setShowImportModal(false);
                      setImportBackupData(null);
                    }}
                    className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition cursor-pointer"
                  >
                    إلغاء
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Test Reminder Modal */}
      {showTestModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 text-right">
          <div className="w-full max-w-md bg-slate-900 border border-purple-500/40 rounded-3xl p-6 shadow-2xl relative space-y-4">
            <div className="flex items-center justify-between border-b border-purple-900/40 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-purple-600/20 text-purple-300 flex items-center justify-center border border-purple-500/30">
                  <MessageCircle className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-white">تجربة إرسال تذكير الحصة</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowTestModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              قم بتجربة نموذج رسالة التذكير التي سيتم إرسالها للوالدين والمعلمين قبل الحصة بـ 15 دقيقة:
            </p>

            <form onSubmit={handleSendTestReminder} className="space-y-3">
              {students.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    اختر طالباً من قائمتك لتعبئة البيانات تلقائياً:
                  </label>
                  <select
                    onChange={(e) => {
                      const sel = students.find((s) => s.id === e.target.value);
                      if (sel) {
                        setTestStudentName(sel.name);
                        setTestStudentPhone(sel.whatsapp || '');
                      }
                    }}
                    className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-400"
                  >
                    <option value="">-- اختر طالباً --</option>
                    {students.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.whatsapp || 'بدون هاتف'})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">اسم الطالب</label>
                <input
                  type="text"
                  required
                  value={testStudentName}
                  onChange={(e) => setTestStudentName(e.target.value)}
                  placeholder="مثال: يوسف أحمد"
                  className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  رقم واتساب ولي الأمر (للتجربة)
                </label>
                <input
                  type="tel"
                  dir="ltr"
                  value={testStudentPhone}
                  onChange={(e) => setTestStudentPhone(e.target.value)}
                  placeholder="01xxxxxxxxx"
                  className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-400 text-right"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">وقت الحصة</label>
                  <input
                    type="time"
                    value={testClassTime}
                    onChange={(e) => setTestClassTime(e.target.value)}
                    className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">رابط أو مكان الحصة</label>
                  <input
                    type="text"
                    value={testLocation}
                    onChange={(e) => setTestLocation(e.target.value)}
                    placeholder="رابط Meet أو عنوان"
                    className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-400"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSendingTest}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition cursor-pointer shadow-lg shadow-emerald-950/40 flex items-center justify-center gap-2"
              >
                {isSendingTest ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                <span>تجهيز ومعاينة التذكير التجريبي ⚡</span>
              </button>
            </form>

            {/* Test Output Preview */}
            {testSuccessData && (
              <div className="space-y-3 pt-2 border-t border-purple-900/40">
                <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-300">📱 رسالة ولي الأمر المقترحة:</span>
                    <a
                      href={testSuccessData.parentReminder?.whatsappUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold flex items-center gap-1 transition"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>فتح واتساب 💬</span>
                    </a>
                  </div>
                  <pre className="text-[11px] text-slate-200 whitespace-pre-wrap font-sans bg-slate-950/70 p-2.5 rounded-lg border border-slate-800 leading-relaxed">
                    {testSuccessData.parentReminder?.message}
                  </pre>
                </div>

                <div className="p-3 rounded-xl bg-purple-950/60 border border-purple-500/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-purple-300">🔔 إشعار المعلم:</span>
                    <a
                      href={testSuccessData.teacherReminder?.whatsappUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-2 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-[11px] font-bold flex items-center gap-1 transition"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>فتح لواتساب المعلم</span>
                    </a>
                  </div>
                  <pre className="text-[11px] text-slate-200 whitespace-pre-wrap font-sans bg-slate-950/70 p-2.5 rounded-lg border border-slate-800 leading-relaxed">
                    {testSuccessData.teacherReminder?.message}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Logs Modal */}
      {showLogsModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 text-right">
          <div className="w-full max-w-lg bg-slate-900 border border-purple-500/40 rounded-3xl p-6 shadow-2xl relative space-y-4">
            <div className="flex items-center justify-between border-b border-purple-900/40 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-purple-600/20 text-purple-300 flex items-center justify-center border border-purple-500/30">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">سجل التذكيرات الآلية (Cron Job Logs)</h3>
                  <p className="text-[10px] text-slate-400">التذكيرات التي تم تجهيزها وإرسالها مؤخراً</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowLogsModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {loadingLogs ? (
              <div className="py-12 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
                <RefreshCw className="w-6 h-6 animate-spin text-purple-400" />
                <span className="text-xs">جارٍ تحميل سجل التذكيرات...</span>
              </div>
            ) : cronLogs.length === 0 ? (
              <div className="py-10 text-center text-slate-400 bg-slate-950/40 rounded-2xl border border-slate-800 p-4 space-y-2">
                <Clock className="w-8 h-8 text-purple-400 mx-auto opacity-60" />
                <p className="text-xs font-bold text-slate-200">لا توجد سجلات تذكير حالية</p>
                <p className="text-[11px] text-slate-400">
                  تعمل دالة Cron Job كل 15 دقيقة تلقائياً. عند اقتراب موعد أي حصة ستظهر التذكيرات هنا مباشرة.
                </p>
              </div>
            ) : (
              <div className="max-h-96 overflow-y-auto space-y-2.5 pr-1">
                {cronLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3 rounded-2xl bg-slate-950/70 border border-purple-500/20 space-y-2 text-xs hover:border-purple-500/40 transition"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          log.target === 'parent'
                            ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-500/40'
                            : 'bg-purple-950/70 text-purple-300 border border-purple-500/40'
                        }`}>
                          {log.target === 'parent' ? 'ولي أمر 👨‍👩‍👧' : 'معلم 👨‍🏫'}
                        </span>
                        <span className="font-bold text-white">{log.studentName}</span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400">
                        الساعة {log.classTime}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-300 bg-slate-900/90 p-2 rounded-xl border border-slate-800 leading-relaxed font-sans">
                      {log.messageText}
                    </p>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10px] text-slate-500">
                        {log.recipientPhone}
                      </span>
                      {log.whatsappUrl && (
                        <a
                          href={log.whatsappUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold flex items-center gap-1 transition"
                        >
                          <MessageCircle className="w-3 h-3" />
                          <span>فتح محادثة واتساب</span>
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
