import React, { useState, useEffect } from 'react';
import {
  TeacherProfile,
  NotificationPreferences,
  DEFAULT_NOTIFICATION_PREFERENCES,
} from '../types';
import { updateTeacherProfile } from '../firebase';
import {
  playNotificationChime,
  showBrowserNotification,
  requestBrowserNotificationPermission,
} from '../services/reminderService';
import {
  Bell,
  UserPlus,
  CreditCard,
  Clock,
  AlertCircle,
  DollarSign,
  FileText,
  Smartphone,
  Volume2,
  VolumeX,
  MessageCircle,
  CheckCircle2,
  Check,
  RotateCcw,
  Sparkles,
  Sliders,
  Send,
} from 'lucide-react';

const NOTIFICATION_PREFS_KEY = 'sanad_notification_preferences';

export function getStoredNotificationPrefs(profile?: TeacherProfile): NotificationPreferences {
  if (profile?.notificationPreferences) {
    return { ...DEFAULT_NOTIFICATION_PREFERENCES, ...profile.notificationPreferences };
  }
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(NOTIFICATION_PREFS_KEY);
      if (stored) {
        return { ...DEFAULT_NOTIFICATION_PREFERENCES, ...JSON.parse(stored) };
      }
    } catch (e) {
      console.warn('Failed reading notification preferences from localStorage:', e);
    }
  }
  return DEFAULT_NOTIFICATION_PREFERENCES;
}

interface NotificationCenterProps {
  profile: TeacherProfile;
  onPreferencesChange?: (prefs: NotificationPreferences) => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  profile,
  onPreferencesChange,
}) => {
  const [preferences, setPreferences] = useState<NotificationPreferences>(() =>
    getStoredNotificationPrefs(profile)
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'events' | 'channels'>('events');

  // Keep state synced with profile if it updates
  useEffect(() => {
    if (profile.notificationPreferences) {
      setPreferences((prev) => ({
        ...prev,
        ...profile.notificationPreferences,
      }));
    }
  }, [profile.notificationPreferences]);

  const savePreferences = async (newPrefs: NotificationPreferences) => {
    setPreferences(newPrefs);
    if (onPreferencesChange) {
      onPreferencesChange(newPrefs);
    }

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(NOTIFICATION_PREFS_KEY, JSON.stringify(newPrefs));
      } catch (e) {
        console.warn('Failed saving notification preferences to localStorage:', e);
      }
    }

    if (profile.id) {
      setIsSaving(true);
      try {
        await updateTeacherProfile(profile.id, {
          notificationPreferences: newPrefs,
        });
        setSaveNotice('تم حفظ تفضيلات الإشعارات بنجاح');
        setTimeout(() => setSaveNotice(null), 3000);
      } catch (err) {
        console.error('Error saving notification preferences to Firestore:', err);
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleToggle = (key: keyof NotificationPreferences) => {
    const updated = {
      ...preferences,
      [key]: !preferences[key],
    };
    savePreferences(updated);
  };

  const handleEnableAll = () => {
    const updated: NotificationPreferences = {
      newStudentRegistered: true,
      subscriptionNearExpiry: true,
      classReminders: true,
      studentAbsenceRecorded: true,
      paymentRecorded: true,
      dailySummaryReport: true,
      browserPush: true,
      inAppBanner: true,
      soundChime: true,
      whatsappAlerts: true,
    };
    savePreferences(updated);
  };

  const handleMuteAll = () => {
    const updated: NotificationPreferences = {
      newStudentRegistered: false,
      subscriptionNearExpiry: false,
      classReminders: false,
      studentAbsenceRecorded: false,
      paymentRecorded: false,
      dailySummaryReport: false,
      browserPush: false,
      inAppBanner: false,
      soundChime: false,
      whatsappAlerts: false,
    };
    savePreferences(updated);
  };

  const handleResetDefaults = () => {
    savePreferences(DEFAULT_NOTIFICATION_PREFERENCES);
  };

  const handleSendTestNotification = async () => {
    try {
      const perm = await requestBrowserNotificationPermission();
      if (preferences.soundChime) {
        playNotificationChime();
      }
      showBrowserNotification(
        'مركز إشعارات سند المعلم 🔔',
        'هذا إشعار تجريبي لاختبار إعدادات وتفضيلات التنبيهات على جهازك.'
      );
      setSaveNotice('تم إرسال إشعار تجريبي بنجاح 🧪');
      setTimeout(() => setSaveNotice(null), 3000);
    } catch (e) {
      console.warn('Test notification error:', e);
    }
  };

  // Event Categories Data
  const eventTypes = [
    {
      key: 'newStudentRegistered' as const,
      title: 'تسجيل طالب جديد',
      englishTitle: 'New student registered',
      description: 'تنبيه فوري عند تسجيل أو إضافة طالب جديد في مجموعاتك أو الحصص الخاصة',
      icon: <UserPlus className="w-5 h-5 text-emerald-400" />,
      badgeColor: 'bg-emerald-950/70 border-emerald-500/40 text-emerald-300',
    },
    {
      key: 'subscriptionNearExpiry' as const,
      title: 'قرب انتهاء الاشتراك',
      englishTitle: 'Subscription near expiry',
      description: 'تنبيه مسبق قبل انتهاء فترة الاشتراك أو التجربة المجانية لتفادي انقطاع الخدمة',
      icon: <CreditCard className="w-5 h-5 text-amber-400" />,
      badgeColor: 'bg-amber-950/70 border-amber-500/40 text-amber-300',
    },
    {
      key: 'classReminders' as const,
      title: 'تذكيرات مواعيد الحصص القادمة',
      englishTitle: 'Upcoming class reminders',
      description: 'تنبيه ديناميكي قبل موعد الحصة مع عد تنازلي بالدقائق والثواني',
      icon: <Clock className="w-5 h-5 text-sky-400" />,
      badgeColor: 'bg-sky-950/70 border-sky-500/40 text-sky-300',
    },
    {
      key: 'studentAbsenceRecorded' as const,
      title: 'تسجيل غياب أو اعتذار طالب',
      englishTitle: 'Student absence / excuse',
      description: 'إشعار عند تسجيل غياب أو اعتذار طالب لمتابعة أسباب الغياب وجدولة التعويض',
      icon: <AlertCircle className="w-5 h-5 text-rose-400" />,
      badgeColor: 'bg-rose-950/70 border-rose-500/40 text-rose-300',
    },
    {
      key: 'paymentRecorded' as const,
      title: 'تسجيل دفعة مالية أو تصفية',
      englishTitle: 'Payment recorded / settled',
      description: 'إشعار تأكيد فوري عند تسجيل دفعة نقدية جديدة أو تصفية مستحقات طالب',
      icon: <DollarSign className="w-5 h-5 text-teal-400" />,
      badgeColor: 'bg-teal-950/70 border-teal-500/40 text-teal-300',
    },
    {
      key: 'dailySummaryReport' as const,
      title: 'تقرير ملخص نهاية اليوم',
      englishTitle: 'Daily end-of-day summary',
      description: 'إشعار مسائي مجدول بملخص حصص اليوم ومعدل الحضور والغياب المالي',
      icon: <FileText className="w-5 h-5 text-purple-400" />,
      badgeColor: 'bg-purple-950/70 border-purple-500/40 text-purple-300',
    },
  ];

  // Delivery Channels Data
  const channelTypes = [
    {
      key: 'browserPush' as const,
      title: 'إشعارات المتصفح والنظام (Web Push)',
      description: 'وصول التنبيهات على شاشة الهاتف أو الكمبيوتر حتى عند عمل التطبيق في الخلفية',
      icon: <Smartphone className="w-5 h-5 text-purple-400" />,
    },
    {
      key: 'inAppBanner' as const,
      title: 'أشرطة التنبيه التفاعلية داخل التطبيق',
      description: 'شريط علوي ديناميكي مع عد تنازلي وزر تفاعل مباشر دون مقاطعة العمل',
      icon: <Bell className="w-5 h-5 text-amber-400" />,
    },
    {
      key: 'soundChime' as const,
      title: 'نغمة التنبيه الصوتية (Chime)',
      description: 'رنين نغمي لطيف لتنبيه المعلم صوتياً عند ورود إشعار جديد',
      icon: preferences.soundChime ? (
        <Volume2 className="w-5 h-5 text-emerald-400" />
      ) : (
        <VolumeX className="w-5 h-5 text-slate-500" />
      ),
    },
    {
      key: 'whatsappAlerts' as const,
      title: 'تنبيهات ورسائل واتساب التلقائية',
      description: 'تجهيز روابط ورسائل التذكير المباشرة لأولياء الأمور بنقرة واحدة',
      icon: <MessageCircle className="w-5 h-5 text-emerald-400" />,
    },
  ];

  const enabledEventsCount = eventTypes.filter((e) => preferences[e.key]).length;

  return (
    <div className="rounded-3xl bg-gradient-to-r from-purple-950/50 via-slate-900 to-indigo-950/50 border border-purple-500/30 p-4 sm:p-5 shadow-2xl space-y-4 select-none text-right">
      {/* Top Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-amber-500 flex items-center justify-center text-white shadow-lg shadow-purple-950/50 flex-shrink-0">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm sm:text-base font-extrabold text-white">
                مركز الإشعارات • Notification Center
              </h3>
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-purple-950/80 border border-purple-500/40 text-purple-300">
                {enabledEventsCount} من {eventTypes.length} أحداث مفعلة
              </span>
            </div>
            <p className="text-[11px] text-purple-200/80 mt-0.5">
              إدارة تفضيلات وصول الإشعارات والتنبيهات المخصصة لكل نوع من أنواع الأحداث
            </p>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={handleEnableAll}
            className="px-2.5 py-1 rounded-xl bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/40 text-purple-200 text-xs font-bold transition cursor-pointer active:scale-95"
            title="تفعيل جميع أنواع الإشعارات"
          >
            تفعيل الكل
          </button>
          <button
            type="button"
            onClick={handleMuteAll}
            className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer active:scale-95"
            title="كتم جميع الإشعارات"
          >
            كتم الكل
          </button>
          <button
            type="button"
            onClick={handleResetDefaults}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
            title="استعادة الإعدادات الافتراضية"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Save Notice Toast */}
      {saveNotice && (
        <div className="p-2.5 rounded-2xl bg-emerald-950/90 border border-emerald-500/50 text-emerald-200 text-xs flex items-center justify-between gap-2 shadow-lg animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{saveNotice}</span>
          </div>
          {isSaving && <span className="text-[10px] text-slate-400">جارٍ المزامنة...</span>}
        </div>
      )}

      {/* Tabs Switcher: Event Types vs Delivery Channels */}
      <div className="flex items-center gap-1 bg-slate-950/60 p-1 rounded-2xl border border-slate-800">
        <button
          type="button"
          onClick={() => setActiveTab('events')}
          className={`flex-1 py-1.5 px-3 rounded-xl font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5 ${
            activeTab === 'events'
              ? 'bg-purple-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>أنواع الأحداث ({eventTypes.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('channels')}
          className={`flex-1 py-1.5 px-3 rounded-xl font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5 ${
            activeTab === 'channels'
              ? 'bg-purple-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span>قنوات التنبيه ({channelTypes.length})</span>
        </button>
      </div>

      {/* Tab 1: Event Types Toggles */}
      {activeTab === 'events' && (
        <div className="space-y-2.5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {eventTypes.map((item) => {
              const isEnabled = preferences[item.key];
              return (
                <div
                  key={item.key}
                  onClick={() => handleToggle(item.key)}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start justify-between gap-3 shadow-md hover:scale-[1.01] ${
                    isEnabled
                      ? 'bg-slate-900/90 border-purple-500/40 shadow-purple-950/30'
                      : 'bg-slate-950/50 border-slate-800/80 opacity-70 hover:opacity-100'
                  }`}
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border mt-0.5 ${
                        isEnabled
                          ? 'bg-purple-500/20 border-purple-500/40'
                          : 'bg-slate-900 border-slate-800'
                      }`}
                    >
                      {item.icon}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-bold text-white block">
                          {item.title}
                        </span>
                        <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded border ${item.badgeColor}`}>
                          {item.englishTitle}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-300 mt-1 leading-relaxed">
                        {item.description}
                      </p>
                    </div>
                  </div>

                  {/* Toggle Switch */}
                  <div className="shrink-0 mt-1">
                    <div
                      className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                        isEnabled ? 'bg-emerald-600 justify-end' : 'bg-slate-800 justify-start'
                      }`}
                    >
                      <span className="bg-white w-4 h-4 rounded-full shadow-md transform transition" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 2: Channels Toggles */}
      {activeTab === 'channels' && (
        <div className="space-y-2.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {channelTypes.map((channel) => {
              const isEnabled = preferences[channel.key];
              return (
                <div
                  key={channel.key}
                  onClick={() => handleToggle(channel.key)}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start justify-between gap-3 shadow-md hover:scale-[1.01] ${
                    isEnabled
                      ? 'bg-slate-900/90 border-indigo-500/40 shadow-indigo-950/30'
                      : 'bg-slate-950/50 border-slate-800/80 opacity-70 hover:opacity-100'
                  }`}
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border mt-0.5 ${
                        isEnabled
                          ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300'
                          : 'bg-slate-900 border-slate-800 text-slate-500'
                      }`}
                    >
                      {channel.icon}
                    </div>

                    <div className="min-w-0">
                      <span className="text-xs font-bold text-white block">
                        {channel.title}
                      </span>
                      <p className="text-[10px] text-slate-300 mt-1 leading-relaxed">
                        {channel.description}
                      </p>
                    </div>
                  </div>

                  {/* Toggle Switch */}
                  <div className="shrink-0 mt-1">
                    <div
                      className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                        isEnabled ? 'bg-indigo-600 justify-end' : 'bg-slate-800 justify-start'
                      }`}
                    >
                      <span className="bg-white w-4 h-4 rounded-full shadow-md transform transition" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Bottom Footer Actions: Test Notification */}
      <div className="flex items-center justify-between gap-2 pt-2 border-t border-purple-900/30 flex-wrap">
        <div className="flex items-center gap-1.5 text-[11px] text-purple-200/80">
          <Sparkles className="w-3.5 h-3.5 text-amber-300" />
          <span>يتم حفظ وتطبيق التفضيلات تلقائياً على حسابك وجميع أجهزتك</span>
        </div>

        <button
          type="button"
          onClick={handleSendTestNotification}
          className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs transition flex items-center gap-1.5 shadow-md active:scale-95 cursor-pointer"
        >
          <Send className="w-3.5 h-3.5" />
          <span>اختبار إشعار تجريبي 🧪</span>
        </button>
      </div>
    </div>
  );
};
