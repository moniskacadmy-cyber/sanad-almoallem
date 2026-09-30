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
import { OfflineIndicator } from './OfflineIndicator';
import {
  Home,
  Users,
  Calendar,
  BookOpen,
  Settings,
  Shield,
  Loader2,
} from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<TeacherProfile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loadingAuth, setLoadingAuth] = useState(true);

  // Active Tab
  const [activeTab, setActiveTab] = useState<number>(0);
  const [showAdminView, setShowAdminView] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  // Collections state for current teacher
  const [students, setStudents] = useState<Student[]>([]);
  const [schedules, setSchedules] = useState<ScheduleSlot[]>([]);
  const [libraryItems, setLibraryItems] = useState<LibraryItem[]>([]);

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

  // If user signed in via Google or Auth but profile document is not created yet
  if (!profile) {
    return (
      <div className="min-h-screen bg-[#070314] flex flex-col justify-center items-center p-4">
        <OfflineIndicator />
        <AuthModal onSuccess={() => {}} />
      </div>
    );
  }

  // If subscription has expired and not in admin view
  const isSubscriptionExpired = profile.subscriptionStatus === 'expired';
  if (isSubscriptionExpired && !showAdminView) {
    return (
      <div className="min-h-screen bg-[#070314] flex flex-col items-center justify-center p-4">
        <OfflineIndicator />
        <LockScreen
          profile={profile}
          onSignOut={() => signOut(auth)}
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

      {/* Mobile-first centered frame (up to 460px) */}
      <div className="w-full max-w-[460px] min-h-screen bg-slate-950/95 border-x border-purple-950/40 flex flex-col relative shadow-2xl">
        {/* Top App Header */}
        <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-md border-b border-purple-900/30 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-700 to-indigo-600 flex items-center justify-center shadow text-amber-300 font-bold">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-sm font-extrabold text-white tracking-wide">
                سند المعلم
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isAdmin && (
              <button
                onClick={() => setShowAdminView(!showAdminView)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
                  showAdminView
                    ? 'bg-amber-400 text-slate-950 shadow-md'
                    : 'bg-purple-950/80 border border-purple-500/30 text-amber-300 hover:bg-purple-900/70'
                }`}
                title="لوحة الإدارة"
              >
                <Shield className="w-3.5 h-3.5" />
                <span>{showAdminView ? 'تطبيق المعلم' : 'الإدارة'}</span>
              </button>
            )}

            <div
              onClick={() => setShowUpgradeModal(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-900/40 border border-purple-500/30 text-[11px] font-bold text-purple-200 cursor-pointer hover:bg-purple-900/70 transition"
              title="ترقية أو تجديد الاشتراك"
            >
              <span>{profile.subscriptionStatus === 'active' ? 'مشترك 💎' : 'تجريبي 🎁'}</span>
            </div>
          </div>
        </header>

        {/* Main Body Content */}
        <main className="flex-1 p-4 overflow-y-auto">
          {showAdminView ? (
            <AdminDashboard onBackToApp={() => setShowAdminView(false)} />
          ) : (
            <>
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
                <StudentsTab profile={profile} students={students} />
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
            </>
          )}
        </main>

        {/* Bottom Tab Navigation Bar */}
        {!showAdminView && (
          <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[460px] z-40 bg-slate-950/95 backdrop-blur-lg border-t border-purple-900/40 px-2 py-1.5 flex items-center justify-around shadow-2xl">
            {tabs.map((tab, idx) => {
              const Icon = tab.icon;
              const isActive = activeTab === idx;
              return (
                <button
                  key={tab.label}
                  onClick={() => setActiveTab(idx)}
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
        )}

        {/* Voluntary Upgrade Modal */}
        {showUpgradeModal && (
          <LockScreen
            profile={profile}
            isVoluntary={true}
            onClose={() => setShowUpgradeModal(false)}
          />
        )}
      </div>
    </div>
  );
}
