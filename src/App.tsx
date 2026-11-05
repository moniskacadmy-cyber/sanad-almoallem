import React, { useState, useEffect, useRef } from 'react';
import { buildGoogleCalendarUrl } from './utils/calendar';
import { buildIcs, addToPhoneCalendar } from './utils/ics';

// Local storage key for persistent reminders list
const LOCAL_STORAGE_KEY = 'reminders';

interface ReminderItem {
  id: string;
  title: string;
  description: string;
  duration: number;
  repeat: string;
  startAt: string;
  nextAt: string;
  done: boolean;
}

// Helper: Get default date (today YYYY-MM-DD) and time (+1 hour HH:mm) for form
function getDefaultFormDateTime() {
  const now = new Date();
  now.setHours(now.getHours() + 1);
  now.setMinutes(0);

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');

  return {
    date: `${year}-${month}-${day}`,
    time: `${hours}:${minutes}`,
  };
}

// Helper: Calculate next occurrence for repeating reminders
function calculateNextOccurrence(startIsoString: string, repeatType: string) {
  const date = new Date(startIsoString);
  const now = new Date();

  if (repeatType === 'daily') {
    while (date <= now) {
      date.setDate(date.getDate() + 1);
    }
  } else if (repeatType === 'weekly') {
    while (date <= now) {
      date.setDate(date.getDate() + 7);
    }
  } else if (repeatType === 'monthly') {
    while (date <= now) {
      date.setMonth(date.getMonth() + 1);
    }
  }
  return date;
}

// Arabic label map for repeat types
const REPEAT_LABELS: Record<string, string> = {
  none: 'بدون تكرار',
  daily: 'يومياً',
  weekly: 'أسبوعياً',
  monthly: 'شهرياً',
};

export default function App() {
  const defaultDateTime = getDefaultFormDateTime();

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(defaultDateTime.date);
  const [time, setTime] = useState(defaultDateTime.time);
  const [duration, setDuration] = useState<number | string>(15);
  const [repeat, setRepeat] = useState('none');

  // App & List State
  const [reminders, setReminders] = useState<ReminderItem[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [toastMessage, setToastMessage] = useState('');
  const [notificationPermission, setNotificationPermission] = useState('default');
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);
  const [activeTab, setActiveTab] = useState<'active' | 'completed'>('active');

  // Ref to always access the latest reminders inside the 30s interval
  const remindersRef = useRef(reminders);
  remindersRef.current = reminders;

  // 1. Initial Load: Read reminders from LocalStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setReminders(parsed);
        }
      }
    } catch (err) {
      console.error('فشل في قراءة التذكيرات من localStorage:', err);
    }

    // Check notification permission
    if (typeof Notification !== 'undefined') {
      setNotificationPermission(Notification.permission);
    } else {
      setNotificationPermission('unsupported');
    }

    // Check standalone mode (already installed as PWA)
    const isStandaloneMode =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    setIsStandalone(isStandaloneMode);

    // Listen for PWA beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  // 2. Helper: Save reminders to state & localStorage
  const saveRemindersList = (newList: ReminderItem[]) => {
    setReminders(newList);
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newList));
    } catch (err) {
      console.error('فشل في حفظ التذكيرات في localStorage:', err);
    }
  };

  // 3. Form Validation with clear Arabic error messages
  const validateForm = () => {
    setErrorMessage('');

    if (!title || !title.trim()) {
      setErrorMessage('اكتب عنوان للتذكير');
      return null;
    }

    if (!date || !time) {
      setErrorMessage('التاريخ أو الوقت غير صحيح');
      return null;
    }

    // Construct local Date object
    const startDateTime = new Date(`${date}T${time}`);
    if (isNaN(startDateTime.getTime())) {
      setErrorMessage('التاريخ أو الوقت غير صحيح');
      return null;
    }

    const now = new Date();
    // 1-minute buffer to allow immediate upcoming scheduling
    if (startDateTime.getTime() < now.getTime() - 60000) {
      setErrorMessage('الموعد لازم يكون في المستقبل');
      return null;
    }

    const durationNum = Number(duration);
    if (isNaN(durationNum) || durationNum <= 0) {
      setErrorMessage('المدة لازم تكون أكبر من صفر');
      return null;
    }

    return {
      title: title.trim(),
      description: description.trim(),
      startDateTime,
      durationNum,
      repeat,
    };
  };

  // 4. Reset Form Fields
  const resetForm = () => {
    const nextDefault = getDefaultFormDateTime();
    setTitle('');
    setDescription('');
    setDate(nextDefault.date);
    setTime(nextDefault.time);
    setDuration(15);
    setRepeat('none');
    setEditingId(null);
    setErrorMessage('');
  };

  // 5. Handler: Save to App List ("حفظ في التطبيق")
  const handleSaveToApp = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const validData = validateForm();
    if (!validData) return;

    const startIso = validData.startDateTime.toISOString();

    if (editingId) {
      // Update existing reminder
      const updatedList = reminders.map((item) => {
        if (item.id === editingId) {
          return {
            ...item,
            title: validData.title,
            description: validData.description,
            duration: validData.durationNum,
            repeat: validData.repeat,
            startAt: startIso,
            nextAt: startIso,
            done: false,
          };
        }
        return item;
      });
      saveRemindersList(updatedList);
      showToast('تم تحديث التذكير بنجاح! ✏️');
    } else {
      // Create new reminder
      const newReminder: ReminderItem = {
        id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
        title: validData.title,
        description: validData.description,
        duration: validData.durationNum,
        repeat: validData.repeat,
        startAt: startIso,
        nextAt: startIso,
        done: false,
      };
      saveRemindersList([newReminder, ...reminders]);
      showToast('تم حفظ التذكير في التطبيق بنجاح! 💾');
    }

    resetForm();
  };

  // 6. Handler: Add to Google Calendar (Synchronous onClick)
  const handleAddToGoogleCalendar = () => {
    const validData = validateForm();
    if (!validData) return;

    const googleUrl = buildGoogleCalendarUrl({
      title: validData.title,
      description: validData.description,
      start: validData.startDateTime,
      durationMinutes: validData.durationNum,
      repeat: validData.repeat,
    });

    // Synchronous call to prevent popup blocker
    window.open(googleUrl, '_blank');
    showToast('جاري تحويلك لتقويم جوجل... 📅');
  };

  // 7. Handler: Add to Phone Calendar (.ics with alarm)
  const handleAddToPhoneCalendar = async () => {
    const validData = validateForm();
    if (!validData) return;

    const icsContent = buildIcs({
      title: validData.title,
      description: validData.description,
      start: validData.startDateTime,
      durationMinutes: validData.durationNum,
      repeat: validData.repeat,
      alarmMinutesBefore: 0, // Alarm fires at event start time
    });

    await addToPhoneCalendar(icsContent, `reminder-${Date.now()}.ics`);
    showToast('تم فتح التقويم إضافة الملف! 📱');
  };

  // 8. Handler: Quick sync existing reminder card to Google Calendar
  const handleCardGoogleCalendar = (reminder: ReminderItem) => {
    const googleUrl = buildGoogleCalendarUrl({
      title: reminder.title,
      description: reminder.description,
      start: new Date(reminder.nextAt || reminder.startAt),
      durationMinutes: reminder.duration,
      repeat: reminder.repeat,
    });
    window.open(googleUrl, '_blank');
  };

  // 9. Handler: Quick sync existing reminder card to Phone Calendar (.ics)
  const handleCardPhoneCalendar = async (reminder: ReminderItem) => {
    const icsContent = buildIcs({
      title: reminder.title,
      description: reminder.description,
      start: new Date(reminder.nextAt || reminder.startAt),
      durationMinutes: reminder.duration,
      repeat: reminder.repeat,
      alarmMinutesBefore: 0,
    });
    await addToPhoneCalendar(icsContent, `${reminder.title.slice(0, 10)}.ics`);
  };

  // 10. Edit Reminder (loads data into form)
  const handleEditClick = (reminder: ReminderItem) => {
    setEditingId(reminder.id);
    setTitle(reminder.title || '');
    setDescription(reminder.description || '');
    setDuration(reminder.duration || 15);
    setRepeat(reminder.repeat || 'none');

    const dt = new Date(reminder.startAt || reminder.nextAt);
    if (!isNaN(dt.getTime())) {
      const yr = dt.getFullYear();
      const mo = String(dt.getMonth() + 1).padStart(2, '0');
      const da = String(dt.getDate()).padStart(2, '0');
      const hr = String(dt.getHours()).padStart(2, '0');
      const mi = String(dt.getMinutes()).padStart(2, '0');
      setDate(`${yr}-${mo}-${da}`);
      setTime(`${hr}:${mi}`);
    }

    setErrorMessage('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // 11. Delete Reminder
  const handleDeleteClick = (id: string) => {
    const confirmed = window.confirm('هل أنت تأكد من حذف هذا التذكير؟');
    if (confirmed) {
      const updated = reminders.filter((item) => item.id !== id);
      saveRemindersList(updated);
      if (editingId === id) {
        resetForm();
      }
      showToast('تم حذف التذكير');
    }
  };

  // 12. Toggle Completion
  const handleToggleDone = (id: string) => {
    const updated = reminders.map((item) => {
      if (item.id === id) {
        return { ...item, done: !item.done };
      }
      return item;
    });
    saveRemindersList(updated);
  };

  // 13. Toast Notification Helper
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage('');
    }, 3000);
  };

  // 14. Feature 5: In-App Notification Engine
  // Note: In-app notifications fire while the app or tab is open. Background delivery requires server push (FCM).
  useEffect(() => {
    const checkAndTriggerNotifications = () => {
      const currentList = remindersRef.current;
      if (!currentList || currentList.length === 0) return;

      const now = new Date();
      let hasChanges = false;

      const updatedList = currentList.map((item) => {
        if (item.done) return item;

        const nextTime = new Date(item.nextAt);
        if (isNaN(nextTime.getTime())) return item;

        // Check if nextAt date/time has passed
        if (nextTime <= now) {
          hasChanges = true;

          // Read direct permission from Notification.permission
          const currentPermission = typeof Notification !== 'undefined' ? Notification.permission : 'denied';

          if (currentPermission === 'granted') {
            const notifTitle = `⏰ تذكير: ${item.title}`;
            const notifBody = item.description ? item.description : `حان الآن موعد التذكير!`;

            // Try Service Worker notification first, fallback to browser Notification
            if ('serviceWorker' in navigator && navigator.serviceWorker.ready) {
              navigator.serviceWorker.ready
                .then((registration) => {
                  registration.showNotification(notifTitle, {
                    body: notifBody,
                    icon: '/icon-192.png',
                    badge: '/icon-192.png',
                    dir: 'rtl',
                    lang: 'ar',
                  } as NotificationOptions);
                })
                .catch(() => {
                  try {
                    new Notification(notifTitle, {
                      body: notifBody,
                      icon: '/icon-192.png',
                      dir: 'rtl',
                    });
                  } catch (e) {}
                });
            } else {
              try {
                new Notification(notifTitle, {
                  body: notifBody,
                  icon: '/icon-192.png',
                  dir: 'rtl',
                });
              } catch (e) {}
            }
          }

          // Advance occurrence or mark as done
          if (item.repeat && item.repeat !== 'none') {
            const nextDate = calculateNextOccurrence(item.nextAt, item.repeat);
            return {
              ...item,
              nextAt: nextDate.toISOString(),
            };
          } else {
            return {
              ...item,
              done: true,
            };
          }
        }

        return item;
      });

      if (hasChanges) {
        saveRemindersList(updatedList);
      }
    };

    // Run check every 30 seconds
    const intervalId = setInterval(checkAndTriggerNotifications, 30000);
    return () => clearInterval(intervalId);
  }, []);

  // Request Notification Permission
  const handleRequestNotificationPermission = async () => {
    if (typeof Notification === 'undefined') {
      alert('متصفحك لا يدعم الإشعارات');
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      if (permission === 'granted') {
        showToast('تم تفعيل الإشعارات بنجاح! 🔔');
      }
    } catch (err) {
      console.error('فشل طلب إذن الإشعارات:', err);
    }
  };

  // Trigger PWA Installation
  const handleInstallPWA = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsStandalone(true);
        setDeferredPrompt(null);
      }
    } else {
      setShowIOSInstructions(true);
    }
  };

  // Filter reminders into active & completed
  const activeReminders = reminders.filter((r) => !r.done);
  const completedReminders = reminders.filter((r) => r.done);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dir-rtl font-sans antialiased pb-12">
      {/* Toast Banner */}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white text-sm px-4 py-2.5 rounded-full shadow-lg flex items-center gap-2 border border-slate-700 animate-bounce">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Container - Mobile First Max Width */}
      <main className="max-w-[28rem] mx-auto p-4 sm:p-6 space-y-5">
        {/* APP HEADER */}
        <header className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black text-blue-600 flex items-center gap-2">
              <span>🔔</span>
              <span>تذكيراتي</span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">
              تطبيق التذكيرات المتقدم وإدارة التقويم
            </p>
          </div>

          {/* PWA Install Button */}
          {!isStandalone && (
            <button
              onClick={handleInstallPWA}
              className="px-3 py-1.5 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 text-xs font-bold transition flex items-center gap-1 shadow-sm active:scale-95 cursor-pointer"
            >
              <span>📲</span>
              <span>تثبيت</span>
            </button>
          )}
        </header>

        {/* iOS PWA Install Guide Modal */}
        {showIOSInstructions && (
          <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl p-5 max-w-xs w-full space-y-3 text-right shadow-2xl border border-slate-200">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-1.5">
                <span>📱</span>
                <span>تثبيت التطبيق على آيفون / آيباد</span>
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                1. اضغط على زر <strong>المشاركة (Share)</strong> أسفل شاشة متصفح Safari.<br />
                2. اختر <strong>الإضافة إلى الشاشة الرئيسية (Add to Home Screen)</strong>.
              </p>
              <button
                onClick={() => setShowIOSInstructions(false)}
                className="w-full py-2 bg-blue-600 text-white font-bold rounded-xl text-xs hover:bg-blue-700 transition cursor-pointer"
              >
                حسناً، فهمت
              </button>
            </div>
          </div>
        )}

        {/* FEATURE 5: NOTIFICATION PERMISSION CARD */}
        <section className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/80 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">🔔</span>
              <h2 className="text-sm font-bold text-slate-800">إشعارات التذكير</h2>
            </div>

            {notificationPermission === 'granted' && (
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold border border-emerald-300">
                مفعلة ✅
              </span>
            )}
          </div>

          {notificationPermission === 'default' && (
            <div className="space-y-2">
              <p className="text-xs text-slate-600 leading-relaxed">
                فعّل الإشعارات لتصلك تنبيهات المواعيد في وقتها أثناء استخدام التطبيق.
              </p>
              <button
                onClick={handleRequestNotificationPermission}
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-sm active:scale-95 cursor-pointer"
              >
                تفعيل الإشعارات
              </button>
            </div>
          )}

          {notificationPermission === 'denied' && (
            <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs leading-relaxed">
              ⚠️ الإشعارات محظورة في متصفحك. يرجى تفعيل الإشعارات من إعدادات المتصفح تلقياً للتنبيهات.
            </div>
          )}

          {notificationPermission === 'unsupported' && (
            <p className="text-xs text-slate-500">
              متصفحك الحالي لا يدعم إشعارات الويب.
            </p>
          )}
        </section>

        {/* FEATURE 1: REMINDER FORM */}
        <section className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span>{editingId ? '✏️' : '➕'}</span>
              <span>{editingId ? 'تعديل التذكير' : 'إضافة تذكير جديد'}</span>
            </h2>

            {editingId && (
              <button
                onClick={resetForm}
                className="text-xs font-bold text-slate-500 hover:text-slate-800 bg-slate-100 px-2.5 py-1 rounded-lg transition cursor-pointer"
              >
                إلغاء التعديل ✖
              </button>
            )}
          </div>

          <form onSubmit={handleSaveToApp} className="space-y-3.5">
            {/* Title (Required) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                عنوان التذكير <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="مثال: موعد طبيب الأسنان، اجتماع العمل..."
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none transition bg-slate-50/50"
              />
            </div>

            {/* Description (Optional) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                الوصف / تفاصيل إضافية (اختياري)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="أضف أي تفاصيل أو ملاحظات تود تذكرها..."
                className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none transition bg-slate-50/50 resize-y"
              />
            </div>

            {/* Date and Time */}
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  التاريخ <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none transition bg-slate-50/50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  الوقت <span className="text-rose-500">*</span>
                </label>
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none transition bg-slate-50/50"
                />
              </div>
            </div>

            {/* Duration and Repeat */}
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  المدة (بالدقائق)
                </label>
                <input
                  type="number"
                  min="1"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none transition bg-slate-50/50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  التكرار
                </label>
                <select
                  value={repeat}
                  onChange={(e) => setRepeat(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none transition bg-slate-50/50 cursor-pointer"
                >
                  <option value="none">بدون تكرار</option>
                  <option value="daily">يومياً</option>
                  <option value="weekly">أسبوعياً</option>
                  <option value="monthly">شهرياً</option>
                </select>
              </div>
            </div>

            {/* Error Message Box */}
            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold">
                ⚠️ {errorMessage}
              </div>
            )}

            {/* Form Actions */}
            <div className="space-y-2 pt-1">
              {/* Primary Action: Save to App List */}
              <button
                type="submit"
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm transition shadow-md active:scale-98 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>💾</span>
                <span>{editingId ? 'تحديث التذكير في التطبيق' : 'حفظ في التطبيق'}</span>
              </button>

              {/* Secondary Actions: Calendar Integrations */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                {/* FEATURE 2: Google Calendar */}
                <button
                  type="button"
                  onClick={handleAddToGoogleCalendar}
                  className="py-2.5 px-2 bg-white hover:bg-blue-50 text-blue-700 border border-blue-300 font-bold rounded-xl text-xs transition shadow-sm flex items-center justify-center gap-1 active:scale-95 cursor-pointer"
                >
                  <span>📅</span>
                  <span className="truncate">أضف إلى Google Calendar</span>
                </button>

                {/* FEATURE 3: Phone Calendar ICS */}
                <button
                  type="button"
                  onClick={handleAddToPhoneCalendar}
                  className="py-2.5 px-2 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 font-bold rounded-xl text-xs transition shadow-sm flex items-center justify-center gap-1 active:scale-95 cursor-pointer"
                >
                  <span>📱</span>
                  <span className="truncate">أضف إلى تقويم الفون</span>
                </button>
              </div>
            </div>
          </form>
        </section>

        {/* FEATURE 4: SAVED REMINDERS LIST */}
        <section className="space-y-3">
          {/* List Header & Tabs */}
          <div className="flex items-center justify-between px-1">
            <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
              <span>📋</span>
              <span>قائمة التذكيرات</span>
            </h2>

            <div className="flex items-center gap-1 bg-slate-200/80 p-1 rounded-xl text-xs font-bold">
              <button
                onClick={() => setActiveTab('active')}
                className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                  activeTab === 'active'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                القادمة ({activeReminders.length})
              </button>
              <button
                onClick={() => setActiveTab('completed')}
                className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                  activeTab === 'completed'
                    ? 'bg-white text-slate-800 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                المكتملة ({completedReminders.length})
              </button>
            </div>
          </div>

          {/* Active Tab Content */}
          {activeTab === 'active' && (
            <div className="space-y-3">
              {activeReminders.length === 0 ? (
                <div className="bg-white rounded-2xl p-8 text-center border border-slate-200/80 space-y-2">
                  <span className="text-3xl block">✨</span>
                  <p className="text-sm font-bold text-slate-700">لا توجد تذكيرات قادمة</p>
                  <p className="text-xs text-slate-400">
                    أضف تذكيرك الأول من النموذج أعلاه وسيتم تنبيهك في الموعد المحدّد.
                  </p>
                </div>
              ) : (
                activeReminders.map((item) => {
                  const nextDt = new Date(item.nextAt || item.startAt);
                  const formattedDateTime = !isNaN(nextDt.getTime())
                    ? nextDt.toLocaleString('ar-EG', {
                        weekday: 'short',
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : 'موعد غير صحيح';

                  return (
                    <div
                      key={item.id}
                      className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/80 hover:border-blue-300 transition space-y-3"
                    >
                      {/* Card Header: Title & Repeat Badge */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-0.5">
                          <h3 className="text-sm font-bold text-slate-900 leading-snug">
                            {item.title}
                          </h3>
                          {item.description && (
                            <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                              {item.description}
                            </p>
                          )}
                        </div>

                        <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold flex-shrink-0">
                          {REPEAT_LABELS[item.repeat] || 'بدون تكرار'}
                        </span>
                      </div>

                      {/* Card Meta: Time & Duration */}
                      <div className="flex items-center justify-between text-xs text-slate-500 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                        <div className="flex items-center gap-1 font-semibold text-slate-700">
                          <span>⏰</span>
                          <span>{formattedDateTime}</span>
                        </div>
                        <span className="text-[11px] text-slate-400">
                          {item.duration} دقيقة
                        </span>
                      </div>

                      {/* Card Actions */}
                      <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                        {/* Right Actions: Mark Done / Edit / Delete */}
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleToggleDone(item.id)}
                            className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 text-xs font-bold transition cursor-pointer"
                            title="إنجاز التذكير"
                          >
                            ✓ تم
                          </button>
                          <button
                            onClick={() => handleEditClick(item)}
                            className="p-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs font-bold transition cursor-pointer"
                            title="تعديل"
                          >
                            ✏️ تعديل
                          </button>
                          <button
                            onClick={() => handleDeleteClick(item.id)}
                            className="p-1.5 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 text-xs font-bold transition cursor-pointer"
                            title="حذف"
                          >
                            🗑️ حذف
                          </button>
                        </div>

                        {/* Left Actions: Calendar Quick Export */}
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleCardGoogleCalendar(item)}
                            className="px-2 py-1 bg-slate-50 hover:bg-blue-50 text-blue-700 border border-slate-200 rounded-lg text-[11px] font-bold transition cursor-pointer"
                            title="أضف إلى Google Calendar"
                          >
                            📅 تقويم جوجل
                          </button>
                          <button
                            onClick={() => handleCardPhoneCalendar(item)}
                            className="px-2 py-1 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-[11px] font-bold transition cursor-pointer"
                            title="أضف إلى تقويم الفون"
                          >
                            📱 الفون
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* Completed Tab Content */}
          {activeTab === 'completed' && (
            <div className="space-y-3">
              {completedReminders.length === 0 ? (
                <div className="bg-white rounded-2xl p-8 text-center border border-slate-200/80 text-xs text-slate-400">
                  لا توجد تذكيرات مكتملة بعد.
                </div>
              ) : (
                completedReminders.map((item) => (
                  <div
                    key={item.id}
                    className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/80 opacity-75 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-bold text-slate-700 line-through">
                          {item.title}
                        </h3>
                        {item.description && (
                          <p className="text-xs text-slate-400">{item.description}</p>
                        )}
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                        مكتمل ✓
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                      <button
                        onClick={() => handleToggleDone(item.id)}
                        className="text-xs font-bold text-blue-600 hover:underline cursor-pointer"
                      >
                        إعادة للقائمة القادمة ↩️
                      </button>
                      <button
                        onClick={() => handleDeleteClick(item.id)}
                        className="text-xs font-bold text-rose-600 hover:underline cursor-pointer"
                      >
                        حذف 🗑️
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </section>

        {/* Footer info */}
        <footer className="text-center text-xs text-slate-400 pt-4">
          تطبيق تذكيراتي PWA • يعمل بدون إنترنت مع حفظ محلي آمن
        </footer>
      </main>
    </div>
  );
}
