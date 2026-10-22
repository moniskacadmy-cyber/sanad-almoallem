import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { onAuthStateChanged, User, signOut, getRedirectResult } from 'firebase/auth';
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
} from './firebase';
import {
  TeacherProfile,
  Student,
  ScheduleSlot,
  LibraryItem,
  isInDoNotDisturbPeriod,
} from './types';
import { AuthModal } from './components/AuthModal';
import { LockScreen } from './components/LockScreen';
import { HomeTab } from './components/HomeTab';
import { AdminSecretGate } from './components/AdminSecretGate';
import { NearExpiryOverlay } from './components/NearExpiryOverlay';
import { OfflineIndicator } from './OfflineIndicator';
import { AIAssistantChat } from './components/AIAssistantChat';
import { LoadingFallback } from './components/LoadingFallback';
import { Sidebar } from './components/Sidebar';
import { ThemeToggleCompact } from './components/ThemeToggle';
import { OnboardingModal } from './components/OnboardingModal';
import { ActiveReminderAlert, ActiveReminderAlertData } from './components/ActiveReminderAlert';
import { getStoredNotificationPrefs } from './components/NotificationCenter';

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
  Menu,
  Bot,
  Sparkles,
} from 'lucide-react';
import {
  getStoredReminderSettings,
  showBrowserNotification,
  playNotificationChime,
  checkRemindersApi,
  sendEndOfDaySummaryNotification,
} from './services/reminderService';
import { requestAndSaveFCMToken } from './firebase';
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

  const { t } = useTranslation();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<TeacherProfile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminChecked, setAdminChecked] = useState(false);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [profileLoadingTimeout, setProfileLoadingTimeout] = useState(false);
  const [profileLoadError, setProfileLoadError] = useState<string | null>(null);

  // Safety net timer: Ensure loadingAuth never hangs indefinitely
  useEffect(() => {
    const timer = setTimeout(() => {
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
  const [exitToastMessage, setExitToastMessage] = useState<string | null>(null);
  const lastBackPressTimeRef = useRef<number>(0);
  const [showFinancialDashboard, setShowFinancialDashboard] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Sidebar navigation drawer state
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeSidebarItem, setActiveSidebarItem] = useState('reminders');

  useEffect(() => {
    if (profile && profile.role !== 'admin' && !profile.onboardingCompleted) {
      setShowOnboarding(true);
    }
  }, [profile]);

  const handleSidebarSelect = (itemId: string) => {
    setActiveSidebarItem(itemId);
    if (itemId === 'home') {
      setActiveTab(0);
      setShowFinancialDashboard(false);
      setShowAdminView(false);
    } else if (itemId === 'students') {
      setActiveTab(1);
      setShowFinancialDashboard(false);
      setShowAdminView(false);
    } else if (itemId === 'appointments') {
      setActiveTab(2);
      setShowFinancialDashboard(false);
      setShowAdminView(false);
    } else if (itemId === 'classes') {
      setActiveTab(3);
      setShowFinancialDashboard(false);
      setShowAdminView(false);
    } else if (itemId === 'profits' || itemId === 'expenses' || itemId === 'reports') {
      setShowFinancialDashboard(true);
      setShowAdminView(false);
    } else if (itemId === 'reminders' || itemId === 'notifications' || itemId === 'settings') {
      setActiveTab(4);
      setShowFinancialDashboard(false);
      setShowAdminView(false);
    }
  };

  // Collections state for current teacher
  const [students, setStudents] = useState<Student[]>([]);
  const [schedules, setSchedules] = useState<ScheduleSlot[]>([]);
  const [libraryItems, setLibraryItems] = useState<LibraryItem[]>([]);

  // Automated Class Reminders Alert Banner State
  const [activeReminderAlert, setActiveReminderAlert] = useState<ActiveReminderAlertData | null>(null);

  // AI Assistant Chat state (Header Icon trigger)
  const [isAIAssistantOpen, setIsAIAssistantOpen] = useState(false);

  // Register top-level modals & subviews on back handler stack
  useBackHandler(isSidebarOpen, () => setIsSidebarOpen(false), 'sidebar_drawer');
  useBackHandler(showOnboarding, () => setShowOnboarding(false), 'onboarding_modal');
  useBackHandler(showUpgradeModal, () => setShowUpgradeModal(false), 'upgrade_modal');
  useBackHandler(showFinancialDashboard, () => setShowFinancialDashboard(false), 'financial_dashboard');
  useBackHandler(showAdminView, () => setShowAdminView(false), 'admin_view');
  useBackHandler(isAIAssistantOpen, () => setIsAIAssistantOpen(false), 'ai_assistant_modal');
  useBackHandler(!!activeReminderAlert, () => setActiveReminderAlert(null), 'active_reminder_alert', false);

  // Push initial history state on mount & Request browser notification permission
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.history.replaceState({ app: 'sanad-almoallem', tab: 0 }, '', window.location.pathname);
      pushAppHistoryState({ tab: 0 });

      // Ask for native notification permission immediately upon app startup
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().then((perm) => {
          if (perm === 'granted') {
            showBrowserNotification(
              'سند المعلم 🔔',
              'تم تفعيل إشعارات الهاتف والنظام بنجاح لحصصك المجدولة!'
            );
            playNotificationChime();
          }
        });
      }
    }
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
      const now = Date.now();
      if (now - lastBackPressTimeRef.current < 2000) {
        return; // default exit behavior
      }
      lastBackPressTimeRef.current = now;
      setExitToastMessage('اضغط مرة أخرى للخروج');
      setTimeout(() => setExitToastMessage(null), 2000);
      pushAppHistoryState({ tab: 0 });
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [activeTab, showAdminView, showUpgradeModal, showFinancialDashboard]);

  const handleSelectTab = (idx: number) => {
    if (idx === activeTab) return;
    setActiveTab(idx);
    pushAppHistoryState({ tab: idx });
  };



  const navigateTo = (path: string) => {
    if (window.location.pathname !== path) {
      pushAppHistoryState({ path });
    }
    setCurrentPath(path);
  };

  // Listen to Auth State
  useEffect(() => {
    // Process any redirect sign-in results gracefully (e.g. mobile or COOP fallbacks)
    getRedirectResult(auth).catch((e) => {
      console.warn('Redirect auth result warning:', e?.message || e);
    });

    const unsub = onAuthStateChanged(auth, (user) => {
      try {
        setCurrentUser(user);
        setLoadingAuth(false);
        if (user) {
          setAdminChecked(false);
          checkIsAdmin(user)
            .then((adminStatus) => {
              setIsAdmin(adminStatus);
            })
            .catch((e) => {
              console.warn('checkIsAdmin error:', e);
              setIsAdmin(false);
            })
            .finally(() => {
              setAdminChecked(true);
            });

          requestAndSaveFCMToken()
            .then((result) => {
              if (!result.success) console.warn('FCM notification registration:', result.error);
            })
            .catch((e) => console.warn('FCM token error:', e));
        } else {
          setProfile(null);
          setIsAdmin(false);
          setAdminChecked(true);
        }
      } catch (err) {
        console.error('Error in onAuthStateChanged listener:', err);
        setLoadingAuth(false);
      }
    });
    return () => unsub();
  }, []);

  // Listen to Teacher Profile (with auto-provision fallback)
  useEffect(() => {
    if (!currentUser) {
      setProfile(null);
      setProfileLoadError(null);
      return;
    }

    let isMounted = true;

    const unsub = subscribeToTeacherProfile(
      currentUser.uid,
      async (p) => {
        if (!isMounted) return;
        if (p) {
          setProfile(p);
          setProfileLoadError(null);
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
            if (isMounted) {
              setProfile(newP);
              setProfileLoadError(null);
            }
          } catch (createErr: any) {
            console.warn('Auto profile creation error:', createErr);
            if (isMounted) {
              setProfile(null);
              setProfileLoadError(createErr?.message || 'تعذر إنشاء ملف المعلم في Firestore.');
            }
          }
        }
      },
      (err) => {
        console.error('Error in teacher profile subscription', err);
        if (isMounted) {
          setProfileLoadError(err?.message || 'تعذر قراءة ملف المعلم من Firestore.');
        }
      }
    );

    return () => {
      isMounted = false;
      unsub();
    };
  }, [currentUser]);

  // Listen to Students, Schedules, and Library
  useEffect(() => {
    if (!currentUser) {
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
  }, [currentUser?.uid]);

  // Run database automatic cleanup script for orphaned schedules and lessons (IIFE triggered)
  useEffect(() => {
    if (!currentUser || !profile || students.length === 0) return;
    runOrphanCleanup(currentUser.uid, students.map(s => s.id));
  }, [currentUser, profile?.id, students]);

  // Automated 15-Minute Class Reminders Periodic Check
  useEffect(() => {
    if (!profile || !schedules || schedules.length === 0) return;
    const settings = getStoredReminderSettings();
    if (!settings.enabled) return;

    let isMounted = true;

    const performCheck = async () => {
      if (isInDoNotDisturbPeriod(profile?.doNotDisturb)) return;
      try {
        const res = await checkRemindersApi({
          teacher: profile,
          schedules,
          students,
          minutesBefore: settings.minutesBefore || 15,
        });

        const notifPrefs = getStoredNotificationPrefs(profile);

        if (isMounted && res.matchedReminders && res.matchedReminders.length > 0 && notifPrefs.classReminders !== false) {
          const first = res.matchedReminders[0];
          const now = new Date();
          const [hStr, mStr] = (first.classTime || '').split(':');
          const target = new Date();
          if (hStr !== undefined && mStr !== undefined) {
            target.setHours(parseInt(hStr, 10), parseInt(mStr, 10), 0, 0);
            if (now.getTime() - target.getTime() > 6 * 60 * 60 * 1000) {
              target.setDate(target.getDate() + 1);
            }
          } else {
            target.setTime(now.getTime() + (settings.minutesBefore || 15) * 60 * 1000);
          }

          if (notifPrefs.inAppBanner !== false) {
            setActiveReminderAlert({
              studentName: first.studentName,
              classTime: first.classTime,
              whatsappUrl: first.whatsappUrl,
              studentPhone: first.recipientPhone,
              subject: first.subject,
              targetTime: target,
            });
          }

          // Automatically open WhatsApp API link with populated class details if enabled
          if ((settings.autoOpenWhatsApp || notifPrefs.whatsappAlerts) && first.whatsappUrl) {
            try {
              window.open(first.whatsappUrl, '_blank');
            } catch (e) {
              console.warn('Auto open WhatsApp link was blocked:', e);
            }
          }

          if (settings.soundEnabled && notifPrefs.soundChime !== false) {
            playNotificationChime();
          }
          if (settings.notifyTeacher && notifPrefs.browserPush !== false) {
            showBrowserNotification(
              '🔔 تذكير بحصة قادمة!',
              `حصة الطالب/ـة ${first.studentName} تبدأ بعد ${settings.minutesBefore || 15} دقيقة (الساعة ${first.classTime}).`
            );
          }
        }

        // Automatic End-of-Day Summary check
        if (settings.endOfDaySummaryEnabled !== false && notifPrefs.dailySummaryReport !== false && isMounted) {
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
        console.warn('Background reminder check error:', err);
      }
    };

    // Initial check
    performCheck();

    // Check periodically every 60 seconds
    const timer = setInterval(performCheck, 60 * 1000);
    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, [profile?.id, schedules, students]);

  // Direct URL access: /admin (Protected by AdminSecretGate)
  if (currentPath === '/admin') {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex justify-center">
        <OfflineIndicator />
        <div className="w-full max-w-[460px] min-h-screen bg-slate-950/95 border-x border-purple-950/40 flex flex-col relative shadow-2xl p-4">
          <AdminSecretGate
            currentUser={currentUser}
            isAdmin={isAdmin}
            adminChecked={adminChecked}
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
        <div className="w-full max-w-[460px] min-h-screen bg-slate-950/95 border-x border-purple-950/40 flex flex-col relative shadow-2xl p-4">
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
          <div className="w-full max-w-sm space-y-4 rounded-2xl border border-amber-500/30 bg-slate-900/90 p-5">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 text-amber-300">
              <AlertCircle className="h-6 w-6" />
            </div>
            <h2 className="text-base font-bold text-white">تم تسجيل الدخول، لكن تعذر تحميل بيانات المعلم</h2>
            <p className="text-sm leading-6 text-slate-300">
              لن نعيدك إلى شاشة تسجيل الدخول لأن حساب Google قد يكون متصلًا بالفعل. تعذر تحميل ملف المعلم من قاعدة البيانات.
            </p>
            {profileLoadError && (
              <p className="break-words rounded-xl bg-slate-950 p-3 text-left text-xs text-amber-200" dir="ltr">
                {profileLoadError}
              </p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="flex-1 rounded-xl bg-purple-600 px-3 py-2.5 text-sm font-bold text-white hover:bg-purple-500"
              >
                إعادة المحاولة
              </button>
              <button
                type="button"
                onClick={() => signOut(auth)}
                className="flex-1 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm font-bold text-slate-200 hover:bg-slate-700"
              >
                تسجيل الخروج
              </button>
            </div>
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
          onSignOut={() => signOut(auth)}
          onOpenAdmin={() => setShowAdminView(true)}
        />
      </div>
    );
  }

  const tabs = [
    { label: t('nav.home', 'الرئيسية'), icon: Home },
    { label: t('nav.students', 'الطلاب'), icon: Users, badge: students.length },
    { label: t('nav.appointments', 'المواعيد'), icon: Calendar, badge: schedules.length },
    { label: t('nav.classes', 'مكتبتي'), icon: BookOpen },
    { label: t('nav.settings', 'الإعدادات'), icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex justify-center transition-colors duration-200">
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
      <div className="w-full max-w-[460px] min-h-screen bg-white/95 dark:bg-slate-950/95 border-x border-slate-200 dark:border-purple-950/40 flex flex-col relative shadow-2xl transition-colors duration-200">
        {/* Sidebar Navigation Drawer */}
        <Sidebar
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          activeItem={activeSidebarItem}
          onSelect={handleSidebarSelect}
          profile={profile}
        />

        {/* Top App Header */}
        <header className="sticky top-0 z-40 bg-white/90 dark:bg-slate-950/80 backdrop-blur-md border-b border-slate-200 dark:border-purple-900/30 px-3.5 py-2.5 flex items-center justify-between transition-colors duration-200">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsSidebarOpen(true)}
              className="p-1.5 rounded-xl bg-purple-100 dark:bg-purple-900/40 hover:bg-purple-200 dark:hover:bg-purple-900/70 border border-purple-300 dark:border-purple-500/30 text-purple-700 dark:text-purple-200 hover:text-purple-900 dark:hover:text-white transition cursor-pointer"
              title="فتح القائمة الرئيسية"
            >
              <Menu className="w-4 h-4 text-purple-700 dark:text-amber-300" />
            </button>
            {activeTab !== 0 ? (
              <button
                type="button"
                onClick={() => handleSelectTab(0)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-purple-100 dark:bg-purple-900/50 hover:bg-purple-200 dark:hover:bg-purple-800/70 border border-purple-300 dark:border-purple-500/40 text-xs font-bold text-purple-800 dark:text-purple-200 hover:text-purple-950 dark:hover:text-white transition cursor-pointer shadow-sm active:scale-95"
                title="الرجوع للواجهة الرئيسية (Main Dashboard)"
              >
                <ChevronRight className="w-4 h-4 text-purple-700 dark:text-amber-300" />
                <span>الرئيسية</span>
              </button>
            ) : (
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-700 to-indigo-600 flex items-center justify-center shadow text-amber-300 font-bold">
                <BookOpen className="w-4 h-4" />
              </div>
            )}
            <div>
              <h1 className="text-sm font-extrabold text-slate-900 dark:text-white tracking-wide">
                سند المعلم
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Quick AI Assistant Icon in Header */}
            <button
              type="button"
              onClick={() => setIsAIAssistantOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-purple-700 to-indigo-600 hover:from-purple-600 hover:to-indigo-500 text-white text-xs font-bold shadow-md shadow-purple-950/40 active:scale-95 transition cursor-pointer border border-purple-400/30 group"
              title="المساعد الذكي Gemini"
            >
              <div className="relative">
                <Bot className="w-4 h-4 text-amber-300 group-hover:rotate-12 transition" />
                <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              </div>
              <span className="hidden sm:inline text-[11px]">المساعد الذكي</span>
              <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
            </button>

            {/* Quick Theme Toggle Button */}
            <ThemeToggleCompact />

            <div
              onClick={() => setShowUpgradeModal(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-100 dark:bg-purple-900/40 border border-purple-300 dark:border-purple-500/30 text-[11px] font-bold text-purple-800 dark:text-purple-200 cursor-pointer hover:bg-purple-200 dark:hover:bg-purple-900/70 transition"
              title="ترقية أو تجديد الاشتراك"
            >
              <span>{profile.subscriptionStatus === 'active' ? 'مشترك 💎' : 'تجريبي 🎁'}</span>
            </div>

            {/* Exit Application Trigger Button */}
            <button
              type="button"
              onClick={() => {
                const now = Date.now();
                if (now - lastBackPressTimeRef.current < 2000) {
                  return;
                }
                lastBackPressTimeRef.current = now;
                setExitToastMessage('اضغط مرة أخرى للخروج');
                setTimeout(() => setExitToastMessage(null), 2000);
              }}
              className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-900 hover:bg-rose-100 dark:hover:bg-rose-950/60 border border-slate-300 dark:border-slate-800 hover:border-rose-400 dark:hover:border-rose-500/40 text-slate-600 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-300 transition cursor-pointer"
              title="خروج من التطبيق"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Active Class Dynamic Reminder Banner with Countdown */}
        {activeReminderAlert && (
          <ActiveReminderAlert
            alert={activeReminderAlert}
            onClose={() => setActiveReminderAlert(null)}
          />
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
        <nav className="secondary-nav fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[460px] z-40 bg-white/95 dark:bg-slate-950/95 backdrop-blur-lg border-t border-slate-200 dark:border-purple-900/40 px-2 py-1.5 flex items-center justify-around shadow-2xl transition-colors duration-200">
          {tabs.map((tab, idx) => {
            const Icon = tab.icon;
            const isActive = activeTab === idx;
            return (
              <button
                key={tab.label}
                onClick={() => handleSelectTab(idx)}
                className={`flex-1 flex flex-col items-center justify-center py-1.5 px-1 rounded-2xl transition cursor-pointer relative ${
                  isActive
                    ? 'text-purple-700 dark:text-purple-300 font-bold'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-medium'
                }`}
              >
                <div
                  className={`p-1 rounded-xl transition ${
                    isActive ? 'bg-purple-100 dark:bg-purple-600/30 text-purple-700 dark:text-amber-300 scale-110 shadow-sm' : ''
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
          <div className="ai-assistant">
            <AIAssistantChat
              profile={profile}
              students={students}
              schedules={schedules}
              onOpenUpgradeModal={() => setShowUpgradeModal(true)}
              isOpenControlled={isAIAssistantOpen}
              onCloseControlled={() => setIsAIAssistantOpen(false)}
            />
          </div>
        )}

        {/* Voluntary Upgrade Modal */}
        {showUpgradeModal && (
          <LockScreen
            profile={profile}
            isVoluntary={true}
            onClose={() => setShowUpgradeModal(false)}
          />
        )}

        {/* First-Time Onboarding Modal */}
        {showOnboarding && profile && (
          <OnboardingModal
            profile={profile}
            onComplete={() => setShowOnboarding(false)}
          />
        )}

        {/* Exit Toast Notification */}
        {exitToastMessage && (
          <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 text-white px-4 py-2 rounded-2xl border border-purple-500/40 text-xs shadow-2xl animate-in fade-in slide-in-from-bottom-3">
            {exitToastMessage}
          </div>
        )}
      </div>
    </div>
  );
}
