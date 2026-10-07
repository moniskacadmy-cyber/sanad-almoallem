import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';
import {
  auth,
  checkIsAdmin,
  subscribeToTeacherProfile,
  subscribeToStudents,
  subscribeToSchedules,
  subscribeToLibrary,
  runOrphanCleanup,
  registerTeacher,
  firebaseInitError,
  signOutTeacher,
  listenToForegroundFCM,
  requestAndSaveFCMToken,
} from './firebase';
import {
  TeacherProfile,
  Student,
  ScheduleSlot,
  LibraryItem,
} from './types';
import { AuthModal } from './components/AuthModal';
import { LockScreen } from './components/LockScreen';
import { HomeTab } from './components/HomeTab';
import { AdminSecretGate } from './components/AdminSecretGate';
import { NearExpiryOverlay } from './components/NearExpiryOverlay';
import { OfflineIndicator } from './OfflineIndicator';
import { AIAssistantChat } from './components/AIAssistantChat';
import { LoadingFallback } from './components/LoadingFallback';

// Code-split heavy screen tabs with React.lazy to accelerate initial load time
const StudentsTab = React.lazy(() => import('./components/StudentsTab').then((m) => ({ default: m.StudentsTab })));
const ScheduleTab = React.lazy(() => import('./components/ScheduleTab').then((m) => ({ default: m.ScheduleTab })));
const LibraryTab = React.lazy(() => import('./components/LibraryTab').then((m) => ({ default: m.LibraryTab })));
const SettingsTab = React.lazy(() => import('./components/SettingsTab').then((m) => ({ default: m.SettingsTab })));
const FinancialDashboard = React.lazy(() => import('./components/FinancialDashboard').then((m) => ({ default: m.FinancialDashboard })));
const AdminDashboard = React.lazy(() => import('./components/AdminDashboard').then((m) => ({ default: m.AdminDashboard })));
import {
  Home,
  Users,
  Calendar,
  BookOpen,
  Settings,
  Loader2,
  Clock,
  MessageCircle,
  Bell,
  X,
  AlertCircle,
  ChevronRight,
  LogOut,
  Sun,
  Moon,
} from 'lucide-react';
import {
  getStoredReminderSettings,
  showBrowserNotification,
  playNotificationChime,
  checkLocalUpcomingSchedules,
  sendEndOfDaySummaryNotification,
} from './services/reminderService';
import {
  pushAppHistoryState,
  useBackHandler,
  handleTopmostBack,
  exitApplication,
  getIsExitingApp,
} from './services/backHandler';

export default function App() {
  if (firebaseInitError) {
    return (
      <LoadingFallback
        message="خلل في إعدادات الاتصال بـ Firebase"
        subMessage="تعذر تهيئة قاعدة البيانات والمصادقة. يرجى التأكد من صحة المفاتيح (VITE_FIREBASE_API_KEY) في ملف البيئة .env"
        error={firebaseInitError.message}
        timeoutMs={0}
      />
    );
  }

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<TeacherProfile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [loadingTimeout, setLoadingTimeout] = useState(false);
  const [profileLoadingTimeout, setProfileLoadingTimeout] = useState(false);

  // Safety net timer: Ensure loadingAuth never hangs indefinitely
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoadingTimeout(true);
      // Force exit loading mode if auth listener hasn't responded after 6 seconds
      setLoadingAuth(false);
    }, 6000);
    return () => clearTimeout(timer);
  }, []);

  // Safety net timer for teacher profile loading
  useEffect(() => {
    if (!currentUser || profile) {
      setProfileLoadingTimeout(false);
      return;
    }
    const timer = setTimeout(() => {
      setProfileLoadingTimeout(true);
    }, 5000);
    return () => clearTimeout(timer);
  }, [currentUser, profile]);

  // Routing State (/ or /admin)
  const [currentPath, setCurrentPath] = useState<string>(() => {
    return typeof window !== 'undefined' ? window.location.pathname : '/';
  });

  // Admin Dashboard View State (opened via Settings tab PIN or direct route)
  const [showAdminView, setShowAdminView] = useState(false);

  // Near Expiry Warning Dismiss State
  const [dismissNearExpiry, setDismissNearExpiry] = useState(false);

  // Active Tab for teacher application
  const [activeTab, setActiveTab] = useState<number>(0);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showExitConfirmModal, setShowExitConfirmModal] = useState(false);
  const [showFinancialDashboard, setShowFinancialDashboard] = useState(false);

  // Theme state (dark / light)
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sanad_theme_mode');
      if (saved === 'light' || saved === 'dark') return saved;
    }
    return 'dark'; // Default to dark mode
  });

  // Apply theme to document element
  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'light') {
      root.classList.add('light');
      root.classList.remove('dark');
    } else {
      root.classList.add('dark');
      root.classList.remove('light');
    }
    localStorage.setItem('sanad_theme_mode', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Collections state for current teacher
  const [students, setStudents] = useState<Student[]>([]);
  const [schedules, setSchedules] = useState<ScheduleSlot[]>([]);
  const [libraryItems, setLibraryItems] = useState<LibraryItem[]>([]);

  // Automated 15-Minute Class Reminders Alert Banner State
  const [activeReminderAlert, setActiveReminderAlert] = useState<{
    studentName: string;
    classTime: string;
    whatsappUrl?: string;
    studentPhone?: string;
    subject?: string;
  } | null>(null);

  // Register top-level modals & subviews on back handler stack
  useBackHandler(showExitConfirmModal, () => setShowExitConfirmModal(false), 'exit_confirm_modal', false);
  useBackHandler(showUpgradeModal, () => setShowUpgradeModal(false), 'upgrade_modal');
  useBackHandler(showFinancialDashboard, () => setShowFinancialDashboard(false), 'financial_dashboard');
  useBackHandler(showAdminView, () => setShowAdminView(false), 'admin_view');
  useBackHandler(!!activeReminderAlert, () => setActiveReminderAlert(null), 'active_reminder_alert', false);

  // Push initial history state on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.history.replaceState({ app: 'sanad-almoallem', tab: 0 }, '', window.location.pathname);
      pushAppHistoryState({ tab: 0 });
    }
  }, []);

  // Listen to Foreground Web Push Messages (Toast + Browser Notification + Sound)
  useEffect(() => {
    const unsub = listenToForegroundFCM((payload) => {
      const title = payload.notification?.title || payload.data?.title || 'سند المعلم 🔔';
      const body = payload.notification?.body || payload.data?.body || 'لديك تذكير جديد بجدول الحصص!';
      const studentName = payload.data?.studentName || 'طالب';
      const classTime = payload.data?.time || '';
      const subject = payload.data?.subject || 'المادة';

      playNotificationChime();
      showBrowserNotification(title, body);
      setActiveReminderAlert({
        studentName,
        classTime,
        subject,
        studentPhone: '',
      });
    });

    return () => {
      if (unsub) unsub();
    };
  }, []);

  // Synchronize browser history / popstate & Smart Back Button handling
  useEffect(() => {
    const handlePopState = () => {
      if (getIsExitingApp()) return;
      setCurrentPath(window.location.pathname);

      // 1. If any modal or popup registered on the back stack is open, close it first
      if (handleTopmostBack()) {
        pushAppHistoryState({ tab: activeTab });
        return;
      }

      // 2. If Financial Dashboard is open, return to Main Dashboard
      if (showFinancialDashboard) {
        setShowFinancialDashboard(false);
        pushAppHistoryState({ tab: 0 });
        return;
      }

      // 3. If Admin view is open, return to Main Dashboard
      if (showAdminView) {
        setShowAdminView(false);
        pushAppHistoryState({ tab: 0 });
        return;
      }

      // 4. If Upgrade modal is open, close it
      if (showUpgradeModal) {
        setShowUpgradeModal(false);
        pushAppHistoryState({ tab: activeTab });
        return;
      }

      // 5. If user is in any sub-tab other than 'الرئيسية' (Tab 0) (Students, Schedule, Library, Settings),
      // redirect them back to the Main Dashboard (Tab 0) instead of exiting
      if (activeTab !== 0) {
        setActiveTab(0);
        pushAppHistoryState({ tab: 0 });
        return;
      }

      // 6. If user is ALREADY at the Main Dashboard (Tab 0) and pressed Back:
      // Show confirmation dialog: "هل تريد الخروج من التطبيق؟"
      setShowExitConfirmModal(true);
      pushAppHistoryState({ modal: 'exit_confirm' });
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [activeTab, showAdminView, showUpgradeModal, showExitConfirmModal, showFinancialDashboard]);

  const handleSelectTab = (idx: number) => {
    if (idx === activeTab) return;
    setActiveTab(idx);
    pushAppHistoryState({ tab: idx });
  };

  const handleConfirmExit = () => {
    setShowExitConfirmModal(false);
    exitApplication();
  };

  const handleCancelExit = () => {
    setShowExitConfirmModal(false);
  };

  const navigateTo = (path: string) => {
    if (window.location.pathname !== path) {
      pushAppHistoryState({ path });
    }
    setCurrentPath(path);
  };

  // Listen to Auth State
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      try {
        setCurrentUser(user);
        if (user) {
          try {
            const adminStatus = await checkIsAdmin(user);
            setIsAdmin(adminStatus);
          } catch (e) {
            console.warn('checkIsAdmin error:', e);
            setIsAdmin(false);
          }
          requestAndSaveFCMToken(false).catch((e) => console.warn('FCM token silent sync notice:', e));
        } else {
          setProfile(null);
          setIsAdmin(false);
        }
      } catch (err) {
        console.error('Error in onAuthStateChanged listener:', err);
      } finally {
        setLoadingAuth(false);
      }
    });
    return () => unsub();
  }, []);

  // Listen to Teacher Profile (with auto-provision fallback)
  useEffect(() => {
    if (!currentUser) {
      setProfile(null);
      return;
    }

    let isMounted = true;

    const unsub = subscribeToTeacherProfile(
      currentUser.uid,
      async (p) => {
        if (!isMounted) return;
        if (p) {
          setProfile(p);
        } else {
          // If profile doc does not exist yet for signed-in user, auto-provision
          try {
            console.log('Teacher profile document missing for user, auto-creating...');
            const newP = await registerTeacher({
              name: currentUser.displayName || currentUser.email?.split('@')[0] || 'المعلم',
              email: currentUser.email || '',
              whatsapp: '',
              subject: 'عام',
              existingUser: currentUser,
            });
            if (isMounted) setProfile(newP);
          } catch (createErr) {
            console.warn('Auto profile creation error:', createErr);
            if (isMounted) setProfile(null);
          }
        }
      },
      (err) => {
        console.error('Error in teacher profile subscription', err);
      }
    );

    return () => {
      isMounted = false;
      unsub();
    };
  }, [currentUser]);

  // Listen to Students, Schedules, and Library
  useEffect(() => {
    if (!currentUser || !profile) {
      setStudents([]);
      setSchedules([]);
      setLibraryItems([]);
      return;
    }

    const unsubStudents = subscribeToStudents(currentUser.uid, (data) => setStudents(data));
    const unsubSchedules = subscribeToSchedules(currentUser.uid, (data) => setSchedules(data));
    const unsubLibrary = subscribeToLibrary(currentUser.uid, (data) => setLibraryItems(data));

    return () => {
      unsubStudents();
      unsubSchedules();
      unsubLibrary();
    };
  }, [currentUser, profile?.id]);

  // Run database automatic cleanup script for orphaned schedules and lessons (IIFE triggered)
  useEffect(() => {
    if (!currentUser || !profile || students.length === 0) return;
    runOrphanCleanup(currentUser.uid, students.map(s => s.id));
  }, [currentUser, profile?.id, students]);

  // In-Memory Local Reminder Evaluation (Zero network requests, calculated locally from loaded schedules)
  const [alertedSlots, setAlertedSlots] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (!profile || !schedules || schedules.length === 0) return;
    const settings = getStoredReminderSettings();
    if (!settings.enabled) return;

    let isMounted = true;

    const performLocalCheck = () => {
      try {
        const { dueReminders } = checkLocalUpcomingSchedules({
          schedules,
          students,
          teacherName: profile.name,
          teacherWhatsapp: profile.whatsapp,
          minutesBefore: settings.minutesBefore || 15,
          alertedSlots,
        });

        if (isMounted && dueReminders.length > 0) {
          const first = dueReminders[0];
          setAlertedSlots((prev) => new Set([...prev, first.slotKey]));
          setActiveReminderAlert({
            studentName: first.studentName,
            classTime: first.classTime,
            whatsappUrl: first.whatsappUrl,
            studentPhone: first.studentPhone,
            subject: first.subject,
          });

          // Automatically open WhatsApp API link with populated class details if enabled
          if (settings.autoOpenWhatsApp && first.whatsappUrl) {
            try {
              window.open(first.whatsappUrl, '_blank');
            } catch (e) {
              console.warn('Auto open WhatsApp link was blocked:', e);
            }
          }

          if (settings.soundEnabled) {
            playNotificationChime();
          }
          if (settings.notifyTeacher) {
            showBrowserNotification(
              '🔔 تذكير بحصة قادمة!',
              `حصة الطالب/ـة ${first.studentName} تبدأ بعد ${settings.minutesBefore || 15} دقيقة (الساعة ${first.classTime}).`
            );
          }
        }

        // Automatic End-of-Day Summary check
        if (settings.endOfDaySummaryEnabled !== false && isMounted) {
          const nowTime = new Date();
          const currentHour = nowTime.getHours();
          const currentMinute = nowTime.getMinutes();
          const [targetHour, targetMin] = (settings.endOfDaySummaryTime || '21:00')
            .split(':')
            .map(Number);
          const currentTotalMinutes = currentHour * 60 + currentMinute;
          const targetTotalMinutes = (targetHour || 21) * 60 + (targetMin || 0);

          if (currentTotalMinutes >= targetTotalMinutes) {
            sendEndOfDaySummaryNotification({
              teacher: profile,
              schedules,
              students,
              force: false,
            });
          }
        }
      } catch (err) {
        console.warn('Local reminder evaluation notice:', err);
      }
    };

    // Initial check
    performLocalCheck();

    // Check periodically every 60 seconds locally in memory
    const timer = setInterval(performLocalCheck, 60 * 1000);
    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, [profile?.id, schedules, students, alertedSlots]);

  // Direct URL access: /admin (Protected by AdminSecretGate)
  if (currentPath === '/admin') {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex justify-center">
        <OfflineIndicator />
        <div className="w-full max-w-[460px] min-h-screen bg-slate-950 border-x border-purple-950/40 flex flex-col relative shadow-2xl p-4">
          <AdminSecretGate
            currentUser={currentUser}
            isAdmin={isAdmin}
            onBackToApp={() => navigateTo('/')}
          />
        </div>
      </div>
    );
  }

  // Admin Dashboard View (activated from Settings Tab or LockScreen for verified admins)
  if (showAdminView) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex justify-center">
        <OfflineIndicator />
        <div className="w-full max-w-[460px] min-h-screen bg-slate-950 border-x border-purple-950/40 flex flex-col relative shadow-2xl p-4">
          <AdminDashboard onBackToApp={() => setShowAdminView(false)} />
        </div>
      </div>
    );
  }

  // Loading Screen
  if (loadingAuth) {
    return (
      <LoadingFallback
        message="جارٍ تحميل سند المعلم..."
        subMessage="جاري الاتصال بالسيرفر وتحضير بيانات التطبيق"
        timeoutMs={5000}
      />
    );
  }

  // Not Logged In
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#070314] flex flex-col justify-center items-center p-4">
        <OfflineIndicator />
        <AuthModal onSuccess={() => {}} />
      </div>
    );
  }

  // If user signed in but profile document is not loaded or created yet
  if (!profile) {
    return (
      <div className="min-h-screen bg-[#070314] flex flex-col justify-center items-center p-4 text-center text-white dir-rtl" dir="rtl">
        <OfflineIndicator />
        {!profileLoadingTimeout ? (
          <LoadingFallback
            message="جارٍ تجهيز بيانات المعلم..."
            subMessage="جاري إعداد حسابك وشخصنة البيانات الإدارية"
            timeoutMs={4000}
          />
        ) : (
          <div className="w-full max-w-sm space-y-4">
            <AuthModal onSuccess={() => {}} />
          </div>
        )}
      </div>
    );
  }

  // Expiration & Remaining Days Calculation (Safe timestamp resolver)
  const effectiveExpiry = profile.subscriptionEndDate || profile.subscriptionExpiresAt || profile.trialEndDate;
  let expiryDate: Date | null = null;
  if (effectiveExpiry) {
    if (typeof effectiveExpiry.toDate === 'function') {
      expiryDate = effectiveExpiry.toDate();
    } else if (typeof effectiveExpiry._seconds === 'number') {
      expiryDate = new Date(effectiveExpiry._seconds * 1000);
    } else if (typeof effectiveExpiry.seconds === 'number') {
      expiryDate = new Date(effectiveExpiry.seconds * 1000);
    } else {
      const d = new Date(effectiveExpiry);
      if (!isNaN(d.getTime())) expiryDate = d;
    }
  }

  const now = new Date();
  const isSubscriptionExpired = !expiryDate || expiryDate <= now || profile.isActive === false || profile.subscriptionStatus === 'expired';
  const diffMs = expiryDate ? expiryDate.getTime() - now.getTime() : 0;
  const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const isNearExpiry = !isSubscriptionExpired && daysLeft <= 3 && daysLeft >= 0;

  // Complete Lockout Upon Expiration (Expired Access Block)
  if (isSubscriptionExpired) {
    return (
      <div className="min-h-screen bg-[#070314] flex flex-col items-center justify-center p-4">
        <OfflineIndicator />
        <LockScreen
          profile={profile}
          isAdmin={isAdmin}
          onSignOut={() => signOutTeacher(auth)}
          onOpenAdmin={() => setShowAdminView(true)}
        />
      </div>
    );
  }

  const tabs = [
    { label: 'الرئيسية', icon: Home },
    { label: 'الطلاب', icon: Users, badge: students.length },
    { label: 'المواعيد', icon: Calendar, badge: schedules.length },
    { label: 'مكتبتي', icon: BookOpen },
    { label: 'الإعدادات', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex justify-center">
      <OfflineIndicator />

      {/* Near Expiry Overlay Alert (3 days or less) */}
      {isNearExpiry && !dismissNearExpiry && (
        <NearExpiryOverlay
          profile={profile}
          daysLeft={daysLeft}
          onDismiss={() => setDismissNearExpiry(true)}
        />
      )}

      {/* Mobile-first centered frame (up to 460px) */}
      <div className="w-full max-w-[460px] min-h-screen bg-slate-950 border-x border-purple-950/40 flex flex-col relative shadow-2xl">
        {/* Top App Header */}
        <header className="sticky top-0 z-40 bg-slate-950  border-b border-purple-900/30 px-3.5 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {activeTab !== 0 ? (
              <button
                type="button"
                onClick={() => handleSelectTab(0)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-purple-900/50 hover:bg-purple-800/70 border border-purple-500/40 text-xs font-bold text-purple-200 hover:text-white transition cursor-pointer shadow-sm active:scale-95"
                title="الرجوع للواجهة الرئيسية (Main Dashboard)"
              >
                <ChevronRight className="w-4 h-4 text-amber-300" />
                <span>الرئيسية</span>
              </button>
            ) : (
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-700 to-indigo-600 flex items-center justify-center shadow text-amber-300 font-bold">
                <BookOpen className="w-4 h-4" />
              </div>
            )}
            <div>
              <h1 className="text-sm font-extrabold text-white tracking-wide">
                سند المعلم
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div
              onClick={() => setShowUpgradeModal(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-900/40 border border-purple-500/30 text-[11px] font-bold text-purple-200 cursor-pointer hover:bg-purple-900/70 transition"
              title="ترقية أو تجديد الاشتراك"
            >
              <span>{profile.subscriptionStatus === 'active' ? 'مشترك 💎' : 'تجريبي 🎁'}</span>
            </div>

            {/* Theme Mode Toggle Button */}
            <button
              type="button"
              onClick={toggleTheme}
              className="p-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-amber-300 hover:text-amber-200 transition cursor-pointer"
              title={theme === 'dark' ? 'التبديل للوضع الفاتح ☀️' : 'التبديل للوضع الداكن 🌙'}
            >
              {theme === 'dark' ? <Sun className="w-4.5 h-4.5" /> : <Moon className="w-4.5 h-4.5 text-purple-400" />}
            </button>

            {/* Exit Application Trigger Button (Shows confirmation modal on Main Dashboard) */}
            <button
              type="button"
              onClick={() => setShowExitConfirmModal(true)}
              className="p-1.5 rounded-xl bg-slate-900 hover:bg-rose-950/60 border border-slate-800 hover:border-rose-500/40 text-slate-400 hover:text-rose-300 transition cursor-pointer"
              title="خروج من التطبيق"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Active Class 15-Minute Reminder Banner */}
        {activeReminderAlert && (
          <div className="bg-gradient-to-r from-emerald-950 via-teal-950 to-slate-900 border-b border-emerald-500/50 px-3.5 py-2.5 flex items-center justify-between text-xs text-white shadow-xl">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center border border-emerald-500/40 flex-shrink-0 animate-bounce">
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <p className="font-bold text-emerald-300">
                  حصة {activeReminderAlert.studentName} تبدأ بعد 15 دقيقة! ⏰
                </p>
                <p className="text-[10px] text-slate-300">
                  الساعة {activeReminderAlert.classTime} {activeReminderAlert.subject ? `• ${activeReminderAlert.subject}` : ''}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {activeReminderAlert.whatsappUrl && (
                <a
                  href={activeReminderAlert.whatsappUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-2.5 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] transition flex items-center gap-1 shadow"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>تذكير واتساب 💬</span>
                </a>
              )}
              <button
                type="button"
                onClick={() => setActiveReminderAlert(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white transition cursor-pointer"
                title="إخفاء التنبيه"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Persistent Warning Bar for Near Expiry (when popup was dismissed) */}
        {isNearExpiry && dismissNearExpiry && (
          <div className="bg-gradient-to-r from-amber-950/90 via-slate-900 to-amber-950/90 border-b border-amber-500/40 px-3.5 py-2 flex items-center justify-between text-xs font-bold text-amber-200 shadow-md">
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 animate-pulse" />
              <span>متبقي {daysLeft === 0 ? 'أقل من يوم' : daysLeft === 1 ? 'يوم واحد' : `${daysLeft} أيام`} على انتهاء الاشتراك</span>
            </div>
            <a
              href={`https://wa.me/201025967471?text=${encodeURIComponent(
                `مرحباً، أود تجديد اشتراكي في سند المعلم للمعلم: ${profile.name} (${profile.email})`
              )}`}
              target="_blank"
              rel="noreferrer"
              className="px-2.5 py-1 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-[11px] transition flex items-center gap-1 shadow"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>تجديد واتساب</span>
            </a>
          </div>
        )}

        {/* Main Body Content */}
        <main className="flex-1 p-4 pb-20 overflow-y-auto">
          <React.Suspense
            fallback={
              <div className="flex flex-col items-center justify-center min-h-[40vh] text-purple-400 gap-3">
                <Loader2 className="w-7 h-7 animate-spin text-purple-400" />
                <span className="text-xs font-bold text-slate-300">جارٍ تحميل القسم...</span>
              </div>
            }
          >
            {showFinancialDashboard ? (
              <FinancialDashboard
                profile={profile}
                students={students}
                onBackToApp={() => setShowFinancialDashboard(false)}
                onOpenStudentDetails={() => {
                  setShowFinancialDashboard(false);
                  setActiveTab(1);
                }}
              />
            ) : (
              <>
                {activeTab === 0 && (
                  <HomeTab
                    profile={profile}
                    students={students}
                    schedules={schedules}
                    onNavigateToTab={(t) => setActiveTab(t)}
                    onOpenUpgradeModal={() => setShowUpgradeModal(true)}
                    onOpenFinancialDashboard={() => setShowFinancialDashboard(true)}
                  />
                )}
                {activeTab === 1 && (
                  <StudentsTab
                    profile={profile}
                    students={students}
                    schedules={schedules}
                  />
                )}
                {activeTab === 2 && (
                  <ScheduleTab
                    profile={profile}
                    students={students}
                    schedules={schedules}
                  />
                )}
                {activeTab === 3 && (
                  <LibraryTab profile={profile} libraryItems={libraryItems} />
                )}
                {activeTab === 4 && (
                  <SettingsTab
                    profile={profile}
                    students={students}
                    schedules={schedules}
                    libraryItems={libraryItems}
                    isAdmin={isAdmin}
                    onOpenUpgradeModal={() => setShowUpgradeModal(true)}
                    onOpenAdminDashboard={() => setShowAdminView(true)}
                    onOpenFinancialDashboard={() => setShowFinancialDashboard(true)}
                  />
                )}
              </>
            )}
          </React.Suspense>
        </main>

        {/* Bottom Tab Navigation Bar */}
        <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[460px] z-40 bg-slate-950  border-t border-purple-900/40 px-2 py-1.5 flex items-center justify-around shadow-2xl">
          {tabs.map((tab, idx) => {
            const Icon = tab.icon;
            const isActive = activeTab === idx;
            return (
              <button
                key={tab.label}
                onClick={() => handleSelectTab(idx)}
                className={`flex-1 flex flex-col items-center justify-center py-1.5 px-1 rounded-2xl transition cursor-pointer relative ${
                  isActive
                    ? 'text-purple-300 font-bold'
                    : 'text-slate-400 hover:text-slate-200 font-medium'
                }`}
              >
                <div
                  className={`p-1 rounded-xl transition ${
                    isActive ? 'bg-purple-600/30 text-amber-300 scale-110' : ''
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-[10px] mt-0.5">{tab.label}</span>

                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className="absolute top-1 left-2.5 px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-purple-600 text-white border border-purple-400/40 shadow">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Floating AI Assistant Chat Window */}
        {currentUser && profile && (
          <AIAssistantChat
            profile={profile}
            students={students}
            schedules={schedules}
            onOpenUpgradeModal={() => setShowUpgradeModal(true)}
          />
        )}

        {/* Voluntary Upgrade Modal */}
        {showUpgradeModal && (
          <LockScreen
            profile={profile}
            isVoluntary={true}
            onClose={() => setShowUpgradeModal(false)}
          />
        )}

        {/* Exit Application Confirmation Modal */}
        {showExitConfirmModal && (
          <div
            className="fixed inset-0 z-50 overflow-y-auto bg-slate-950  flex items-center justify-center p-4 text-right"
            dir="rtl"
          >
            <div className="w-full max-w-sm bg-gradient-to-b from-slate-900 to-slate-950 border border-purple-500/40 rounded-3xl p-6 shadow-2xl relative space-y-4 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-300 flex items-center justify-center border border-amber-500/30 flex-shrink-0">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">هل تريد الخروج من التطبيق؟</h3>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    هل أنت متأكد أنك تريد الخروج؟
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  autoFocus
                  onClick={handleCancelExit}
                  className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition cursor-pointer shadow-lg shadow-purple-950/50 active:scale-98"
                >
                  البقاء في التطبيق
                </button>
                <button
                  type="button"
                  onClick={handleConfirmExit}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-rose-950/80 hover:text-rose-200 text-slate-300 font-bold text-xs border border-slate-700 hover:border-rose-500/50 transition cursor-pointer active:scale-98"
                >
                  نعم، خروج
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
