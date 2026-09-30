import React, { useState } from 'react';
import { TeacherProfile, Student, ScheduleSlot, ClassType, RecurrenceType } from '../types';
import { addSchedule, updateSchedule, deleteSchedule } from '../firebase';
import {
  Calendar,
  Clock,
  Plus,
  Trash2,
  Edit2,
  X,
  Bell,
  BellRing,
  Video,
  Building,
  UserCheck,
  Check,
  ExternalLink,
} from 'lucide-react';

interface ScheduleTabProps {
  profile: TeacherProfile;
  students: Student[];
  schedules: ScheduleSlot[];
}

export const ScheduleTab: React.FC<ScheduleTabProps> = ({ profile, students, schedules }) => {
  const arabicDays = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  const todayIndex = new Date().getDay();

  const [selectedDayFilter, setSelectedDayFilter] = useState<number | 'all'>(todayIndex);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<ScheduleSlot | null>(null);

  // Form fields
  const [formStudentId, setFormStudentId] = useState('');
  const [formStudentName, setFormStudentName] = useState('');
  const [formDayOfWeek, setFormDayOfWeek] = useState<number>(todayIndex);
  const [formTime, setFormTime] = useState('16:00');
  const [formDuration, setFormDuration] = useState<number>(60);
  const [formRecurrence, setFormRecurrence] = useState<RecurrenceType>('weekly');
  const [formClassType, setFormClassType] = useState<ClassType>('private');
  const [formLocationOrLink, setFormLocationOrLink] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Browser Notification state
  const [notificationStatus, setNotificationStatus] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );

  const requestNotificationPermission = async () => {
    if (typeof Notification === 'undefined') return;
    try {
      const perm = await Notification.requestPermission();
      setNotificationStatus(perm);
      if (perm === 'granted') {
        new Notification('سند المعلم 🔔', {
          body: 'تم تفعيل التنبيهات بنجاح! سيتم تذكيرك بالحصص القادمة.',
          icon: '/pwa-192x192.png',
        });
      }
    } catch (e) {
      console.error('Error requesting notification permission', e);
    }
  };

  const handleOpenAdd = () => {
    setEditingSchedule(null);
    if (students.length > 0) {
      setFormStudentId(students[0].id);
      setFormStudentName(students[0].name);
      setFormClassType(students[0].classType);
    } else {
      setFormStudentId('custom');
      setFormStudentName('');
      setFormClassType('private');
    }
    setFormDayOfWeek(typeof selectedDayFilter === 'number' ? selectedDayFilter : todayIndex);
    setFormTime('16:00');
    setFormDuration(60);
    setFormRecurrence('weekly');
    setFormLocationOrLink('');
    setShowAddModal(true);
  };

  const handleOpenEdit = (slot: ScheduleSlot) => {
    setEditingSchedule(slot);
    setFormStudentId(slot.studentId);
    setFormStudentName(slot.studentName);
    setFormDayOfWeek(slot.dayOfWeek);
    setFormTime(slot.time);
    setFormDuration(slot.duration);
    setFormRecurrence(slot.recurrence);
    setFormClassType(slot.classType);
    setFormLocationOrLink(slot.locationOrLink || '');
    setShowAddModal(true);
  };

  const handleStudentSelectChange = (id: string) => {
    setFormStudentId(id);
    const found = students.find((s) => s.id === id);
    if (found) {
      setFormStudentName(found.name);
      setFormClassType(found.classType);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formStudentName.trim() || !formTime) return;
    setIsSubmitting(true);

    try {
      if (editingSchedule) {
        await updateSchedule(profile.id, editingSchedule.id, {
          studentId: formStudentId,
          studentName: formStudentName.trim(),
          dayOfWeek: Number(formDayOfWeek),
          time: formTime,
          duration: Number(formDuration),
          recurrence: formRecurrence,
          classType: formClassType,
          locationOrLink: formLocationOrLink.trim(),
        });
      } else {
        await addSchedule(profile.id, {
          studentId: formStudentId || 'custom',
          studentName: formStudentName.trim(),
          dayOfWeek: Number(formDayOfWeek),
          time: formTime,
          duration: Number(formDuration),
          recurrence: formRecurrence,
          classType: formClassType,
          locationOrLink: formLocationOrLink.trim(),
        });
      }
      setShowAddModal(false);
    } catch (err) {
      console.error('Error saving schedule', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('هل أنت متأكد من حذف هذا الموعد؟')) {
      try {
        await deleteSchedule(profile.id, id);
      } catch (err) {
        console.error('Error deleting schedule', err);
      }
    }
  };

  const filteredSchedules = schedules.filter((s) => {
    if (selectedDayFilter === 'all') return true;
    return s.dayOfWeek === selectedDayFilter;
  });

  const getRecurrenceArabic = (rec: RecurrenceType) => {
    switch (rec) {
      case 'daily':
        return 'يومياً';
      case 'weekly':
        return 'أسبوعياً';
      case 'monthly':
        return 'شهرياً';
      case 'once':
        return 'مرة واحدة';
    }
  };

  const getClassTypeBadge = (type: ClassType) => {
    switch (type) {
      case 'online':
        return (
          <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-blue-950/70 border border-blue-500/30 text-blue-300">
            <Video className="w-3 h-3" />
            <span>أونلاين</span>
          </span>
        );
      case 'center':
        return (
          <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-amber-950/70 border border-amber-500/30 text-amber-300">
            <Building className="w-3 h-3" />
            <span>سنتر</span>
          </span>
        );
      case 'private':
        return (
          <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-purple-950/70 border border-purple-500/30 text-purple-300">
            <UserCheck className="w-3 h-3" />
            <span>برايفيت</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-4 pb-20">
      {/* Top Header & Add Button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">جدول المواعيد ({schedules.length})</h2>
          <p className="text-xs text-slate-400">تنظيم المواعيد وتكرار الحصص الأسبوعية</p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-lg shadow-purple-950/50 active:scale-95 transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>إضافة موعد</span>
        </button>
      </div>

      {/* Notification Banner */}
      {notificationStatus !== 'granted' && (
        <div className="rounded-2xl bg-gradient-to-r from-purple-950/70 to-indigo-950/70 border border-purple-500/30 p-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-600/30 text-purple-300">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-white">تذكير بمواعيد الحصص</p>
              <p className="text-[11px] text-purple-200">فعل إشعارات المتصفح لتنبيهك قبل كل حصة</p>
            </div>
          </div>
          <button
            onClick={requestNotificationPermission}
            className="flex-shrink-0 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition cursor-pointer"
          >
            تفعيل 🔔
          </button>
        </div>
      )}

      {/* Days of week selector tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
        <button
          onClick={() => setSelectedDayFilter('all')}
          className={`px-3 py-1.5 rounded-xl font-bold transition whitespace-nowrap cursor-pointer ${
            selectedDayFilter === 'all'
              ? 'bg-purple-600 text-white shadow-md'
              : 'bg-slate-900/80 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          كل الأسبوع ({schedules.length})
        </button>

        {arabicDays.map((day, idx) => {
          const count = schedules.filter((s) => s.dayOfWeek === idx).length;
          const isToday = idx === todayIndex;
          return (
            <button
              key={day}
              onClick={() => setSelectedDayFilter(idx)}
              className={`px-3 py-1.5 rounded-xl font-bold transition whitespace-nowrap cursor-pointer relative ${
                selectedDayFilter === idx
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'bg-slate-900/80 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <span>{day}</span>
              {count > 0 && (
                <span className="mr-1 text-[10px] opacity-80">({count})</span>
              )}
              {isToday && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 absolute top-1 left-1" />
              )}
            </button>
          );
        })}
      </div>

      {/* Schedules List */}
      {filteredSchedules.length === 0 ? (
        <div className="rounded-2xl bg-slate-900/50 border border-slate-800 p-8 text-center">
          <Calendar className="w-10 h-10 mx-auto text-purple-400/60 mb-2" />
          <p className="text-sm font-bold text-slate-200">
            {selectedDayFilter === 'all'
              ? 'لا توجد مواعيد مجدولة بعد'
              : `لا توجد حصص مجدولة يوم ${arabicDays[selectedDayFilter as number]}`}
          </p>
          <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
            أضف موعد حصة لتنظيم وقتك بسهولة وتلقي التنبيهات.
          </p>
          <button
            onClick={handleOpenAdd}
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 text-white text-xs font-bold hover:bg-purple-500 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة موعد الآن</span>
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredSchedules.map((slot) => (
            <div
              key={slot.id}
              className="rounded-2xl bg-slate-900/80 border border-purple-500/20 p-3.5 flex items-center justify-between hover:border-purple-400/40 transition"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-purple-950/80 border border-purple-500/30 flex flex-col items-center justify-center text-purple-300">
                  <span className="font-mono text-xs font-bold">{slot.time}</span>
                  <span className="text-[9px] text-slate-400">{slot.duration} د</span>
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-white">{slot.studentName}</h3>
                    {getClassTypeBadge(slot.classType)}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    يوم {arabicDays[slot.dayOfWeek]} •{' '}
                    <span className="text-purple-300">{getRecurrenceArabic(slot.recurrence)}</span>
                    {slot.locationOrLink && ` • ${slot.locationOrLink}`}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleOpenEdit(slot)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                  title="تعديل الموعد"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleDelete(slot.id)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition cursor-pointer"
                  title="حذف الموعد"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Schedule Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-purple-500/30 rounded-3xl p-5 shadow-2xl text-right">
            <div className="flex items-center justify-between border-b border-purple-900/40 pb-3 mb-4">
              <h3 className="text-base font-bold text-white">
                {editingSchedule ? 'تعديل موعد الحصة' : 'إضافة موعد حصة جديد'}
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  اختيار الطالب أو كتابة اسم المجموعة
                </label>
                {students.length > 0 && (
                  <select
                    value={formStudentId}
                    onChange={(e) => handleStudentSelectChange(e.target.value)}
                    className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-400 mb-2 cursor-pointer"
                  >
                    <option value="custom">-- اسم مخصص / مجموعة --</option>
                    {students.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.subject})
                      </option>
                    ))}
                  </select>
                )}
                {formStudentId === 'custom' || students.length === 0 ? (
                  <input
                    type="text"
                    value={formStudentName}
                    onChange={(e) => setFormStudentName(e.target.value)}
                    placeholder="اسم الطالب أو اسم المجموعة..."
                    required
                    className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-400"
                  />
                ) : null}
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">يوم الحصة</label>
                  <select
                    value={formDayOfWeek}
                    onChange={(e) => setFormDayOfWeek(Number(e.target.value))}
                    className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-400 cursor-pointer"
                  >
                    {arabicDays.map((d, i) => (
                      <option key={d} value={i}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">وقت البدء</label>
                  <input
                    type="time"
                    value={formTime}
                    onChange={(e) => setFormTime(e.target.value)}
                    required
                    dir="ltr"
                    className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-400 text-right"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    المدة بالدقائق
                  </label>
                  <select
                    value={formDuration}
                    onChange={(e) => setFormDuration(Number(e.target.value))}
                    className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-400 cursor-pointer"
                  >
                    <option value={45}>45 دقيقة</option>
                    <option value={60}>60 دقيقة (ساعة)</option>
                    <option value={90}>90 دقيقة (ساعة ونصف)</option>
                    <option value={120}>120 دقيقة (ساعتان)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">التكرار</label>
                  <select
                    value={formRecurrence}
                    onChange={(e) => setFormRecurrence(e.target.value as RecurrenceType)}
                    className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-400 cursor-pointer"
                  >
                    <option value="weekly">أسبوعياً (المعتاد)</option>
                    <option value="daily">يومياً</option>
                    <option value="monthly">شهرياً</option>
                    <option value="once">مرة واحدة فقط</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">نوع الحصة</label>
                  <select
                    value={formClassType}
                    onChange={(e) => setFormClassType(e.target.value as ClassType)}
                    className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-400 cursor-pointer"
                  >
                    <option value="private">برايفيت</option>
                    <option value="online">أونلاين</option>
                    <option value="center">سنتر</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    المكان أو رابط الزوم
                  </label>
                  <input
                    type="text"
                    value={formLocationOrLink}
                    onChange={(e) => setFormLocationOrLink(e.target.value)}
                    placeholder="مثال: سنتر الأوائل أو رابط Zoom"
                    className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-400"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full rounded-xl bg-purple-600 hover:bg-purple-500 py-2.5 text-xs font-bold text-white transition active:scale-95 disabled:opacity-50 cursor-pointer shadow-lg shadow-purple-950/50"
                >
                  {isSubmitting ? 'جارٍ الحفظ...' : editingSchedule ? 'حفظ التعديلات' : 'إضافة الموعد للجدول'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
