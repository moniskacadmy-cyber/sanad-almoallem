import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  Calendar, 
  Clock, 
  Users, 
  BookOpen, 
  DollarSign, 
  CheckCircle2, 
  AlertCircle, 
  Send, 
  Volume2, 
  Sparkles,
  PlusCircle,
  Video,
  MapPin,
  UserCheck
} from 'lucide-react';

// واجهات البيانات (يمكنك مطابقتها مع الأنواع لديك في المشروع)
interface ScheduleSlot {
  id: string;
  studentName: string;
  subject: string;
  dayOfWeek: number; // 0: الأحد, 1: الإثنين, ...
  startTime: string; // صيغة "05:00"
  endTime: string;
  type: 'online' | 'center' | 'home';
  price: number;
}

interface HomeTabProps {
  schedule: ScheduleSlot[];
  subscriptionDaysLeft: number;
  onNavigate: (tab: string) => void;
}

export const HomeTab: React.FC<HomeTabProps> = ({ 
  schedule = [], 
  subscriptionDaysLeft = 15,
  onNavigate 
}) => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [notificationsAllowed, setNotificationsAllowed] = useState(false);
  
  // حالات Modal تسجيل الحصة وتقارير الواتساب
  const [activeClass, setActiveClass] = useState<ScheduleSlot | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [lessonNotes, setLessonNotes] = useState('');
  const [homework, setHomework] = useState('');
  const [attendanceStatus, setAttendanceStatus] = useState<'present' | 'absent' | 'excused'>('present');
  const [studentRating, setStudentRating] = useState(5);

  // تحديث الساعات والدقائق كل ثانية/دقيقة
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // التحقق من حالة إذن الإشعارات عند التحميل
  useEffect(() => {
    if ("Notification" in window) {
      if (Notification.permission === "granted") {
        setNotificationsAllowed(true);
      }
    }
  }, []);

  // دالة طلب إذن الإشعارات الفعلي وتفعيلها
  const requestNotificationPermission = async () => {
    if (!("Notification" in window)) {
      alert("متصفحك لا يدعم إشعارات سطح المكتب.");
      return;
    }

    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      setNotificationsAllowed(true);
      new Notification("تطبيق سند المعلم", {
        body: "تم تفعيل الإشعارات بنجاح! سنقوم بتنبيهك بمواعيد حصصك القادمة.",
        dir: "rtl",
        lang: "ar"
      });
    } else {
      alert("تم رفض إذن الإشعارات. يرجى تفعيلها من إعدادات المتصفح (رمز القفل).");
    }
  };

  // دالة إرسال الإشعار الفعلي عبر المتصفح أو Service Worker
  const triggerBrowserNotification = (title: string, body: string) => {
    if (Notification.permission === "granted") {
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.ready.then(registration => {
          registration.showNotification(title, {
            body: body,
            icon: "/icon.png",
            dir: "rtl",
            lang: "ar",
            vibrate: [200, 100, 200]
          } as NotificationOptions);
        });
      } else {
        new Notification(title, { body: body, dir: "rtl" });
      }
    }
  };

  // تشغيل تنبيه صوتي بسيط باستخدام Web Audio API
  const playAlertSound = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(587.33, audioCtx.currentTime); // نغمة D5
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.4);
    } catch (e) {
      console.log("Audio not supported or blocked");
    }
  };

  // حساب الحصة الجارية أو القادمة بناءً على الوقت الحقيقي
  const currentDay = currentTime.getDay();
  const currentHour = currentTime.getHours();
  const currentMinute = currentTime.getMinutes();
  const currentTotalMins = currentHour * 60 + currentMinute;

  // فلترة حصص اليوم وترتيبها
  const todaysClasses = schedule.filter(s => s.dayOfWeek === currentDay).sort((a, b) => {
    const [aH, aM] = a.startTime.split(':').map(Number);
    const [bH, bM] = b.startTime.split(':').map(Number);
    return (aH * 60 + aM) - (bH * 60 + bM);
  });

  // العثور على الحصة الحالية أو القادمة
  let activeOrUpcomingClass: ScheduleSlot | null = null;
  let classStatusText = 'لا توجد حصص أخرى اليوم';

  for (const cls of todaysClasses) {
    const [sH, sM] = cls.startTime.split(':').map(Number);
    const [eH, eM] = cls.endTime.split(':').map(Number);
    const startMins = sH * 60 + sM;
    const endMins = eH * 60 + eM;

    if (currentTotalMins >= startMins && currentTotalMins <= endMins) {
      activeOrUpcomingClass = cls;
      classStatusText = 'الحصة جارية الآن 🔴';
      break;
    } else if (startMins > currentTotalMins) {
      activeOrUpcomingClass = cls;
      const diffMins = startMins - currentTotalMins;
      classStatusText = `تبدأ خلال ${diffMins} دقيقة`;
      
      // إطلاق تنبيه فوري إذا اقتربت الحصة بـ 10 دقائق בדיוק
      if (diffMins === 10) {
        triggerBrowserNotification("⏰ تنبيه موعد حصة!", `تبقي 10 دقائق على حصة ${cls.subject} مع الطالب ${cls.studentName}`);
        playAlertSound();
      }
      break;
    }
  }

  // توليد رابط الواتساب الجاهز للتقرير
  const getWhatsAppReportLink = () => {
    if (!activeClass) return '#';
    const message = `مرحباً ولي أمر الطالب/ة ${activeClass.studentName}\n` +
      `إليك تقرير حصة مادة (${activeClass.subject}):\n` +
      `- الحالة: ${attendanceStatus === 'present' ? 'حاضر ✅' : attendanceStatus === 'absent' ? 'غائب ❌' : 'معتذر ⚠️'}\n` +
      `- ما تم شرحه: ${lessonNotes || 'تم استكمال المنهج بنجاح'}\n` +
      `- الواجب المنزلي: ${homework || 'لا يوجد واجب جديد'}\n` +
      `- التقييم: ${'⭐'.repeat(studentRating)}\n` +
      `مع تحيات أكاديمية سند المعلم 📚`;
    return `https://wa.me/?text=${encodeURIComponent(message)}`;
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto bg-gray-50 min-h-screen text-right" dir="rtl">
      
      {/* شريط الترحيب والاشتراك */}
      <div className="bg-gradient-to-l from-indigo-600 to-violet-700 rounded-2xl p-6 text-white shadow-xl flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            مرحباً بك يا معلمنا الفاضل <Sparkles className="w-7 h-7 text-yellow-300 animate-pulse" />
          </h1>
          <p className="text-indigo-100 mt-1 text-sm md:text-base">
            إليك نظرة سريعة على جدول اليوم وإدارة حصتك القادمة بكل سلاسة.
          </p>
        </div>
        
        <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-xl border border-white/20">
          <Calendar className="w-5 h-5 text-yellow-300" />
          <div>
            <span className="text-xs block text-indigo-200">حالة الاشتراك</span>
            <span className="font-bold text-sm">متبقي {subscriptionDaysLeft} يوماً للتجديد</span>
          </div>
        </div>
      </div>

      {/* قسم تفعيل الإشعارات الفورية في حال لم تكن مفعلة */}
      {!notificationsAllowed && (
        <div className="bg-amber-50 border-r-4 border-amber-500 p-4 rounded-xl shadow-sm flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Bell className="w-6 h-6 text-amber-600 animate-bounce" />
            <div>
              <h4 className="font-bold text-amber-800">تنبيهات الإشعارات الحقيقية متوقفة</h4>
              <p className="text-xs text-amber-700">قم بتفعيل الإشعارات لضمان تنبيهك بمواعيد الحصص بدقة حتى لو كان المتصفح في الخلفية.</p>
            </div>
          </div>
          <button 
            onClick={requestNotificationPermission}
            className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-sm font-bold shadow transition"
          >
            تفعيل الإشعارات الآن 🔔
          </button>
        </div>
      )}

      {/* بطاقة الحصة الحالية أو المنتظرة (Live Class Card) */}
      <div className="bg-white rounded-2xl p-6 shadow-md border border-gray-100 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-2 h-full bg-indigo-600"></div>
        <div className="flex justify-between items-center mb-4">
          <span className="text-xs font-bold px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" /> {classStatusText}
          </span>
          <span className="text-sm font-semibold text-gray-500">
            {currentTime.toLocaleDateString('ar-EG', { weekday: 'long', hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        {activeOrUpcomingClass ? (
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                {activeOrUpcomingClass.subject}
                <span className="text-sm font-normal text-gray-500">مع الطالب: {activeOrUpcomingClass.studentName}</span>
              </h2>
              <div className="flex items-center gap-4 text-sm text-gray-600 pt-1">
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4 text-indigo-500" /> 
                  {activeOrUpcomingClass.startTime} - {activeOrUpcomingClass.endTime}
                </span>
                <span className="flex items-center gap-1">
                  {activeOrUpcomingClass.type === 'online' ? <Video className="w-4 h-4 text-blue-500" /> : <MapPin className="w-4 h-4 text-emerald-500" />}
                  {activeOrUpcomingClass.type === 'online' ? 'أونلاين' : 'حضوري / سنتر'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
              <button 
                onClick={() => {
                  setActiveClass(activeOrUpcomingClass);
                  setShowReportModal(true);
                }}
                className="flex-1 md:flex-none bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-md transition flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" /> تسجيل الحصة وإرسال التقرير
              </button>
              <button 
                onClick={playAlertSound}
                title="اختبار نغمة التنبيه"
                className="p-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition"
              >
                <Volume2 className="w-5 h-5" />
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center py-6 text-gray-400">
            <BookOpen className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p>لا توجد حصص أخرى مجدولة لهذا اليوم. استرح قليلاً أو راجع مهامك!</p>
          </div>
        )}
      </div>

      {/* اختصارات سريعة للتبويبات */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <button 
          onClick={() => onNavigate('schedule')}
          className="bg-white hover:bg-indigo-50 p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-3 transition group"
        >
          <div className="p-3 bg-indigo-100 text-indigo-600 rounded-lg group-hover:bg-indigo-600 group-hover:text-white transition">
            <Calendar className="w-6 h-6" />
          </div>
          <div className="text-right">
            <span className="block font-bold text-gray-800 text-sm">جدول المواعيد</span>
            <span className="text-xs text-gray-500">إدارة الحصص الأسبوعية</span>
          </div>
        </button>

        <button 
          onClick={() => onNavigate('students')}
          className="bg-white hover:bg-violet-50 p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-3 transition group"
        >
          <div className="p-3 bg-violet-100 text-violet-600 rounded-lg group-hover:bg-violet-600 group-hover:text-white transition">
            <Users className="w-6 h-6" />
          </div>
          <div className="text-right">
            <span className="block font-bold text-gray-800 text-sm">قائمة الطلاب</span>
            <span className="text-xs text-gray-500">بيانات وأسعار الحصص</span>
          </div>
        </button>

        <button 
          onClick={() => onNavigate('library')}
          className="bg-white hover:bg-blue-50 p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-3 transition group"
        >
          <div className="p-3 bg-blue-100 text-blue-600 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition">
            <BookOpen className="w-6 h-6" />
          </div>
          <div className="text-right">
            <span className="block font-bold text-gray-800 text-sm">مكتبة الملفات</span>
            <span className="text-xs text-gray-500">الامتحانات والملخصات</span>
          </div>
        </button>

        <button 
          onClick={() => onNavigate('financial')}
          className="bg-white hover:bg-emerald-50 p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-3 transition group"
        >
          <div className="p-3 bg-emerald-100 text-emerald-600 rounded-lg group-hover:bg-emerald-600 group-hover:text-white transition">
            <DollarSign className="w-6 h-6" />
          </div>
          <div className="text-right">
            <span className="block font-bold text-gray-800 text-sm">الملخص المالي</span>
            <span className="text-xs text-gray-500">المصروفات والأرباح</span>
          </div>
        </button>
      </div>

      {/* Modal تسجيل الحصة وإرسال تقرير الواتساب */}
      {showReportModal && activeClass && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                تسجيل تقرير حصة: {activeClass.studentName}
              </h3>
              <button 
                onClick={() => setShowReportModal(false)}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-gray-600 block mb-1">حالة الحضور</label>
                <div className="grid grid-cols-3 gap-2">
                  <button 
                    type="button"
                    onClick={() => setAttendanceStatus('present')}
                    className={`py-2 rounded-lg text-xs font-bold border transition ${attendanceStatus === 'present' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-gray-50 text-gray-700 border-gray-200'}`}
                  >
                    حاضر ✅
                  </button>
                  <button 
                    type="button"
                    onClick={() => setAttendanceStatus('absent')}
                    className={`py-2 rounded-lg text-xs font-bold border transition ${attendanceStatus === 'absent' ? 'bg-rose-600 text-white border-rose-600' : 'bg-gray-50 text-gray-700 border-gray-200'}`}
                  >
                    غائب ❌
                  </button>
                  <button 
                    type="button"
                    onClick={() => setAttendanceStatus('excused')}
                    className={`py-2 rounded-lg text-xs font-bold border transition ${attendanceStatus === 'excused' ? 'bg-amber-600 text-white border-amber-600' : 'bg-gray-50 text-gray-700 border-gray-200'}`}
                  >
                    معتذر ⚠️️
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-600 block mb-1">ما تم شرحه اليوم</label>
                <input 
                  type="text" 
                  value={lessonNotes}
                  onChange={(e) => setLessonNotes(e.target.value)}
                  placeholder="مثال: شرح درس المعادلات الخطية وحل التمارين"
                  className="w-full border rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-600 block mb-1">الواجب المنزلي المطلوب</label>
                <input 
                  type="text" 
                  value={homework}
                  onChange={(e) => setHomework(e.target.value)}
                  placeholder="مثال: حل صفحة 45 رقم 3 و 5"
                  className="w-full border rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-600 block mb-1">تقييم مستوى الطالب ({studentRating} نجوم)</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setStudentRating(star)}
                      className={`text-2xl transition ${studentRating >= star ? 'text-yellow-400 scale-110' : 'text-gray-300'}`}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t">
              <button 
                onClick={() => setShowReportModal(false)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-bold rounded-xl transition"
              >
                إلغاء
              </button>
              <a 
                href={getWhatsAppReportLink()}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setShowReportModal(false)}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl shadow transition flex items-center gap-2"
              >
                <Send className="w-4 h-4" /> إرسال التقرير عبر واتساب
              </a>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
