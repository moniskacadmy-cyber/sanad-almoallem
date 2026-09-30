import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';
import {
  auth,
  checkIsAdmin,
  subscribeToTeacherProfile,
  subscribeToStudents,
  subscribeToSchedules,
  subscribeToLibrary,
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
import { StudentsTab } from './components/StudentsTab';
import { ScheduleTab } from './components/ScheduleTab';
import { LibraryTab } from './components/LibraryTab';
import { SettingsTab } from './components/SettingsTab';
import { AdminDashboard } from './components/AdminDashboard';
import { AdminSecretGate } from './components/AdminSecretGate';
import { NearExpiryOverlay } from './components/NearExpiryOverlay';
import { OfflineIndicator } from './OfflineIndicator';
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
} from 'lucide-react';
import {
  getStoredReminderSettings,
  showBrowserNotification,
  playNotificationChime,
  checkRemindersApi,
} from './services/reminderService';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<TeacherProfile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loadingAuth, setLoadingAuth] = useState(true);

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

  // Collections state for current teacher
  const [students, setStudents] = useState<Student[]>([]);
  const [schedules, setSchedules] = useState<ScheduleSlot[]>([]);
  const [libraryItems, setLibraryItems] = useState<LibraryItem[]>([]);

  // Push initial history state on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.history.replaceState({ tab: 0 }, '', window.location.pathname);
    }
  }, []);

  // Synchronize browser history / popstate & Smart Back Button handling
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);

      // 1. If Exit Confirmation Modal is currently open, dismiss it
      if (showExitConfirmModal) {
        setShowExitConfirmModal(false);
        window.history.pushState({ tab: activeTab }, '', window.location.pathname);
        return;
      }

      // 2. If Admin view is open, return to Main Dashboard
      if (showAdminView) {
        setShowAdminView(false);
        window.history.pushState({ tab: 0 }, '', '/');
        return;
      }

      // 3. If Upgrade modal is open, close it
      if (showUpgradeModal) {
        setShowUpgradeModal(false);
        window.history.pushState({ tab: activeTab }, '', window.location.pathname);
        return;
      }

      // 4. If user is in any sub-tab (Students, Schedule, Library, Settings),
      // redirect them back to the Main Dashboard (Tab 0) instead of exiting
      if (activeTab !== 0) {
        setActiveTab(0);
        window.history.pushState({ tab: 0 }, '', '/');
        return;
      }

      // 5. If user is ALREADY at the Main Dashboard (Tab 0) and pressed Back:
      // Show confirmation dialog: "هل أنت متأكد من رغبتك في الخروج من التطبيق؟"
      setShowExitConfirmModal(true);
      window.history.pushState({ tab: 0 }, '', '/');
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [activeTab, showAdminView, showUpgradeModal, showExitConfirmModal]);

  const handleSelectTab = (idx: number) => {
    setActiveTab(idx);
    window.history.pushState({ tab: idx }, '', window.location.pathname);
  };

  const handleConfirmExit = () => {
    setShowExitConfirmModal(false);
    try {
      window.history.go(-2);
    } catch {
      window.close();
    }
  };

  const handleCancelExit = () => {
    setShowExitConfirmModal(false);
  };

  const navigateTo = (path: string) => {
    if (window.location.pathname !== path) {
      window.history.pushState({}, '', path);
    }
    setCurrentPath(path);
  };

  // Listen to Auth State
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        const adminStatus = await checkIsAdmin(user);
        setIsAdmin(adminStatus);
      } else {
        setProfile(null);
        setIsAdmin(false);
      }
      setLoadingAuth(false);
    });
    return () => unsub();
  }, []);

  // Listen to Teacher Profile
  useEffect(() => {
    if (!currentUser) {
      setProfile(null);
      return;
    }

    const unsub = subscribeToTeacherProfile(
      currentUser.uid,
      (p) => {
        setProfile(p);
      },
      (err) => {
        console.error('Error in teacher profile subscription', err);
      }
    );

    return () => unsub();
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

  // Automated 15-Minute Class Reminders Periodic Check
  const [activeReminderAlert, setActiveReminderAlert] = useState<{
    studentName: string;
    classTime: string;
    whatsappUrl?: string;
    studentPhone?: string;
    subject?: string;
  } | null>(null);

  useEffect(() => {
    if (!profile || !schedules || schedules.length === 0) return;
    const settings = getStoredReminderSettings();
    if (!settings.enabled) return;

    let isMounted = true;

    const performCheck = async () => {
      try {
        const res = await checkRemindersApi({
          teacher: profile,
          schedules,
          students,
          minutesBefore: settings.minutesBefore || 15,
        });

        if (isMounted && res.matchedReminders && res.matchedReminders.length > 0) {
          const first = res.matchedReminders[0];
          setActiveReminderAlert({
            studentName: first.studentName,
            classTime: first.classTime,
            whatsappUrl: first.whatsappUrl,
            studentPhone: first.recipientPhone,
            subject: first.subject,
          });

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
            onBackToApp={() => navigateTo('/')}
          />
        </div>
      </div>
    );
  }

  // Admin Dashboard View (activated from Settings Tab PIN 2882026 or LockScreen)
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
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-purple-300">
        <Loader2 className="w-10 h-10 animate-spin text-purple-500 mb-3" />
        <p className="text-sm font-bold">جارٍ تحميل سند المعلم...</p>
      </div>
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

  // If user signed in but profile document is not created yet
  if (!profile) {
    return (
      <div className="min-h-screen bg-[#070314] flex flex-col justify-center items-center p-4">
        <OfflineIndicator />
        <AuthModal onSuccess={() => {}} />
      </div>
    );
  }

  // Expiration & Remaining Days Calculation
  const effectiveExpiry = profile.subscriptionEndDate || profile.subscriptionExpiresAt;
  const expiryDate = effectiveExpiry?.toDate
    ? effectiveExpiry.toDate()
    : effectiveExpiry
    ? new Date(effectiveExpiry)
    : null;
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
          onSignOut={() => signOut(auth)}
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
      <div className="w-full max-w-[460px] min-h-screen bg-slate-950/95 border-x border-purple-950/40 flex flex-col relative shadow-2xl">
        {/* Top App Header */}
        <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-md border-b border-purple-900/30 px-3.5 py-2.5 flex items-center justify-between">
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
          {activeTab === 0 && (
            <HomeTab
              profile={profile}
              students={students}
              schedules={schedules}
              onNavigateToTab={(t) => setActiveTab(t)}
              onOpenUpgradeModal={() => setShowUpgradeModal(true)}
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
            />
          )}
        </main>

        {/* Bottom Tab Navigation Bar */}
        <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[460px] z-40 bg-slate-950/95 backdrop-blur-lg border-t border-purple-900/40 px-2 py-1.5 flex items-center justify-around shadow-2xl">
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
          <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 text-right">
            <div className="w-full max-w-sm bg-gradient-to-b from-slate-900 to-slate-950 border border-purple-500/40 rounded-3xl p-6 shadow-2xl relative space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-300 flex items-center justify-center border border-amber-500/30 flex-shrink-0">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">تأكيد الخروج من التطبيق</h3>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    هل أنت متأكد من رغبتك في الخروج من التطبيق؟
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleConfirmExit}
                  className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition cursor-pointer shadow-lg shadow-rose-950/50 active:scale-98"
                >
                  تأكيد
                </button>
                <button
                  type="button"
                  onClick={handleCancelExit}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition cursor-pointer active:scale-98"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
