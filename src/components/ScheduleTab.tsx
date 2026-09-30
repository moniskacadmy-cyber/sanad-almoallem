import React, { useState, useEffect, useRef } from 'react';
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
  Video,
  Building,
  UserCheck,
  Check,
  LayoutGrid,
  List,
  Palette,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Info,
  ExternalLink,
  MessageCircle,
} from 'lucide-react';

interface ScheduleTabProps {
  profile: TeacherProfile;
  students: Student[];
  schedules: ScheduleSlot[];
}

// Custom Vibrant Palette for Classes
export const CLASS_COLORS = [
  { id: 'purple', name: 'بنفسجي', hex: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.25)', border: '#a78bfa', text: '#ede9fe' },
  { id: 'blue', name: 'أزرق', hex: '#3b82f6', bg: 'rgba(59, 130, 246, 0.25)', border: '#60a5fa', text: '#dbeafe' },
  { id: 'cyan', name: 'سماوي', hex: '#06b6d4', bg: 'rgba(6, 182, 212, 0.25)', border: '#22d3ee', text: '#cffafe' },
  { id: 'emerald', name: 'أخضر', hex: '#10b981', bg: 'rgba(16, 185, 129, 0.25)', border: '#34d399', text: '#d1fae5' },
  { id: 'amber', name: 'برتقالي', hex: '#f59e0b', bg: 'rgba(245, 158, 11, 0.25)', border: '#fbbf24', text: '#fef3c7' },
  { id: 'rose', name: 'وردي', hex: '#ec4899', bg: 'rgba(236, 72, 153, 0.25)', border: '#f472b6', text: '#fce7f3' },
  { id: 'red', name: 'أحمر', hex: '#ef4444', bg: 'rgba(239, 68, 68, 0.25)', border: '#f87171', text: '#fee2e2' },
  { id: 'indigo', name: 'نيلي', hex: '#6366f1', bg: 'rgba(99, 102, 241, 0.25)', border: '#818cf8', text: '#e0e7ff' },
];

export function getColorStyle(colorId?: string) {
  const found = CLASS_COLORS.find((c) => c.id === colorId || c.hex === colorId);
  return found || CLASS_COLORS[0];
}

// 7 Days of the week in Arabic starting with Saturday
export const WEEK_DAYS = [
  { dayIndex: 6, name: 'السبت', short: 'السبت' },
  { dayIndex: 0, name: 'الأحد', short: 'الأحد' },
  { dayIndex: 1, name: 'الإثنين', short: 'الإثنين' },
  { dayIndex: 2, name: 'الثلاثاء', short: 'الثلاثاء' },
  { dayIndex: 3, name: 'الأربعاء', short: 'الأربعاء' },
  { dayIndex: 4, name: 'الخميس', short: 'الخميس' },
  { dayIndex: 5, name: 'الجمعة', short: 'الجمعة' },
];

// 48 Time slots (24 hours x 30-min intervals)
export const ROW_HEIGHT = 44; // pixels per 30 minutes
export const TIME_SLOTS = Array.from({ length: 48 }, (_, i) => {
  const hours = Math.floor(i / 2);
  const minutes = (i % 2) * 30;
  const time24 = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  const period = hours < 12 ? 'ص' : 'م';
  const displayHour = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  const displayMin = minutes === 0 ? '00' : '30';
  const label = `${displayHour.toString().padStart(2, '0')}:${displayMin} ${period}`;
  return {
    index: i,
    time24,
    label,
    hours,
    minutes,
    totalMinutes: i * 30,
  };
});

export const ScheduleTab: React.FC<ScheduleTabProps> = ({ profile, students, schedules }) => {
  const todayIndex = new Date().getDay();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedDayFilter, setSelectedDayFilter] = useState<number | 'all'>(todayIndex);

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<ScheduleSlot | null>(null);
  const [viewingScheduleDetails, setViewingScheduleDetails] = useState<ScheduleSlot | null>(null);

  // Form fields
  const [formStudentId, setFormStudentId] = useState('');
  const [formStudentName, setFormStudentName] = useState('');
  const [formSelectedDays, setFormSelectedDays] = useState<number[]>([todayIndex]);
  const [formTime, setFormTime] = useState('16:00');
  const [formDuration, setFormDuration] = useState<number>(60);
  const [formRecurrence, setFormRecurrence] = useState<RecurrenceType>('weekly');
  const [formClassType, setFormClassType] = useState<ClassType>('private');
  const [formColor, setFormColor] = useState('purple');
  const [formLocationOrLink, setFormLocationOrLink] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Notification state
  const [notificationStatus, setNotificationStatus] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );

  // Grid scroll container reference
  const gridScrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll grid to ~08:00 AM on initial load
  useEffect(() => {
    if (viewMode === 'grid' && gridScrollRef.current) {
      // 08:00 AM is index 16 (16 * 44 = 704px)
      // Check if there are scheduled classes earlier than 8 AM
      let earliestSlot = 16;
      schedules.forEach((s) => {
        const [h, m] = s.time.split(':').map(Number);
        const slotIdx = h * 2 + (m >= 30 ? 1 : 0);
        if (slotIdx < earliestSlot && slotIdx >= 12) {
          earliestSlot = slotIdx;
        }
      });
      gridScrollRef.current.scrollTop = Math.max(0, earliestSlot * ROW_HEIGHT - 20);
    }
  }, [viewMode, schedules]);

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

  // Open Add modal with defaults
  const handleOpenAddDefault = () => {
    setEditingSchedule(null);
    setViewingScheduleDetails(null);
    if (students.length > 0) {
      setFormStudentId(students[0].id);
      setFormStudentName(students[0].name);
      setFormClassType(students[0].classType);
    } else {
      setFormStudentId('custom');
      setFormStudentName('');
      setFormClassType('private');
    }
    setFormSelectedDays([todayIndex]);
    setFormTime('16:00');
    setFormDuration(60);
    setFormRecurrence('weekly');
    setFormColor('purple');
    setFormLocationOrLink('');
    setShowAddModal(true);
  };

  // Open Add modal from an empty cell in the grid
  const handleCellClick = (dayIndex: number, time24: string) => {
    setEditingSchedule(null);
    setViewingScheduleDetails(null);
    if (students.length > 0) {
      setFormStudentId(students[0].id);
      setFormStudentName(students[0].name);
      setFormClassType(students[0].classType);
    } else {
      setFormStudentId('custom');
      setFormStudentName('');
      setFormClassType('private');
    }
    setFormSelectedDays([dayIndex]);
    setFormTime(time24);
    setFormDuration(60);
    setFormRecurrence('weekly');
    setFormColor(CLASS_COLORS[dayIndex % CLASS_COLORS.length].id);
    setFormLocationOrLink('');
    setShowAddModal(true);
  };

  // Open Edit modal from slot
  const handleOpenEdit = (slot: ScheduleSlot) => {
    setViewingScheduleDetails(null);
    setEditingSchedule(slot);
    setFormStudentId(slot.studentId);
    setFormStudentName(slot.studentName);
    setFormSelectedDays([slot.dayOfWeek]);
    setFormTime(slot.time);
    setFormDuration(slot.duration);
    setFormRecurrence(slot.recurrence);
    setFormClassType(slot.classType);
    setFormColor(slot.color || 'purple');
    setFormLocationOrLink(slot.locationOrLink || '');
    setShowAddModal(true);
  };

  // Open Details Modal on booked class click
  const handleSlotClick = (slot: ScheduleSlot, e: React.MouseEvent) => {
    e.stopPropagation();
    setViewingScheduleDetails(slot);
  };

  const handleStudentSelectChange = (id: string) => {
    setFormStudentId(id);
    const found = students.find((s) => s.id === id);
    if (found) {
      setFormStudentName(found.name);
      setFormClassType(found.classType);
    }
  };

  const toggleDaySelection = (dayIndex: number) => {
    if (editingSchedule) {
      setFormSelectedDays([dayIndex]);
      return;
    }
    if (formSelectedDays.includes(dayIndex)) {
      if (formSelectedDays.length > 1) {
        setFormSelectedDays(formSelectedDays.filter((d) => d !== dayIndex));
      }
    } else {
      setFormSelectedDays([...formSelectedDays, dayIndex]);
    }
  };

  const selectPresetDays = (preset: number[]) => {
    setFormSelectedDays(preset);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formStudentName.trim() || !formTime || formSelectedDays.length === 0) return;
    setIsSubmitting(true);

    try {
      if (editingSchedule) {
        await updateSchedule(profile.id, editingSchedule.id, {
          studentId: formStudentId,
          studentName: formStudentName.trim(),
          dayOfWeek: Number(formSelectedDays[0]),
          time: formTime,
          duration: Number(formDuration),
          recurrence: formRecurrence,
          classType: formClassType,
          color: formColor,
          locationOrLink: formLocationOrLink.trim(),
        });
      } else {
        // Create schedule slot for EACH selected day
        for (const day of formSelectedDays) {
          await addSchedule(profile.id, {
            studentId: formStudentId || 'custom',
            studentName: formStudentName.trim(),
            dayOfWeek: Number(day),
            time: formTime,
            duration: Number(formDuration),
            recurrence: formRecurrence,
            classType: formClassType,
            color: formColor,
            locationOrLink: formLocationOrLink.trim(),
          });
        }
      }
      setShowAddModal(false);
      setViewingScheduleDetails(null);
    } catch (err) {
      console.error('Error saving schedule', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('هل أنت متأكد من حذف هذه الحصة من الجدول؟')) {
      try {
        await deleteSchedule(profile.id, id);
        setViewingScheduleDetails(null);
      } catch (err) {
        console.error('Error deleting schedule', err);
      }
    }
  };

  // Scroll to hour helper
  const scrollToHour = (hour: number) => {
    if (gridScrollRef.current) {
      gridScrollRef.current.scrollTo({
        top: hour * 2 * ROW_HEIGHT,
        behavior: 'smooth',
      });
    }
  };

  const getClassTypeBadge = (type: ClassType) => {
    switch (type) {
      case 'online':
        return (
          <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.2 rounded-full bg-blue-950/80 border border-blue-500/40 text-blue-300">
            <Video className="w-2.5 h-2.5" />
            <span>أونلاين</span>
          </span>
        );
      case 'center':
        return (
          <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.2 rounded-full bg-amber-950/80 border border-amber-500/40 text-amber-300">
            <Building className="w-2.5 h-2.5" />
            <span>سنتر</span>
          </span>
        );
      case 'private':
        return (
          <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.2 rounded-full bg-purple-950/80 border border-purple-500/40 text-purple-300">
            <UserCheck className="w-2.5 h-2.5" />
            <span>برايفيت</span>
          </span>
        );
    }
  };

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

  // Helper to format minutes from time string "HH:MM"
  const getMinutesFromTime = (timeStr: string) => {
    const [h, m] = timeStr.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };

  // Format end time from start and duration
  const getEndTimeFormatted = (start: string, durationMin: number) => {
    const total = getMinutesFromTime(start) + durationMin;
    const endH = Math.floor(total / 60) % 24;
    const endM = total % 60;
    const period = endH < 12 ? 'ص' : 'م';
    const displayH = endH === 0 ? 12 : endH > 12 ? endH - 12 : endH;
    return `${displayH}:${endM.toString().padStart(2, '0')} ${period}`;
  };

  const filteredListSchedules = schedules.filter((s) => {
    if (selectedDayFilter === 'all') return true;
    return s.dayOfWeek === selectedDayFilter;
  });

  return (
    <div className="space-y-3.5 pb-20 select-none">
      {/* Top Header & Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span>الجدول الزمني والمواعيد</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-purple-950 text-purple-300 border border-purple-500/30">
              {schedules.length} حصة
            </span>
          </h2>
          <p className="text-[11px] text-slate-400">تقسيم 24 ساعة بكل نصف ساعة مع ألوان مخصصة</p>
        </div>

        {/* View Mode Toggle & Add Button */}
        <div className="flex items-center gap-1.5">
          <div className="flex rounded-xl bg-slate-900 border border-slate-700/80 p-0.5">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-purple-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="عرض الشبكة الأسبوعية"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg transition cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-purple-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="عرض القائمة"
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={handleOpenAddDefault}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-lg shadow-purple-950/50 active:scale-95 transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>إضافة</span>
          </button>
        </div>
      </div>

      {/* Notification Banner (if not granted) */}
      {notificationStatus !== 'granted' && (
        <div className="rounded-2xl bg-gradient-to-r from-purple-950/70 to-indigo-950/70 border border-purple-500/30 p-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-purple-400 flex-shrink-0" />
            <p className="text-[11px] text-purple-200">فعل إشعارات المتصفح لتنبيهك قبل كل موعد</p>
          </div>
          <button
            onClick={requestNotificationPermission}
            className="px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-[11px] font-bold transition cursor-pointer"
          >
            تفعيل 🔔
          </button>
        </div>
      )}

      {/* Grid Legend & Quick Time Jumpers (Shown in Grid View) */}
      {viewMode === 'grid' && (
        <div className="space-y-2">
          {/* Legend Banner */}
          <div className="rounded-xl bg-slate-900/90 border border-purple-500/20 p-2.5 flex flex-wrap items-center justify-between gap-2 text-[11px]">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-md bg-purple-500/40 border border-purple-400 shadow-sm" />
                <span className="text-purple-200 font-medium">حصة محجوزة (انقر للتعديل)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-md bg-slate-800/80 border border-slate-700" />
                <span className="text-slate-400">خلية فارغة (انقر للحجز)</span>
              </div>
            </div>

            {/* Quick Scroll Anchors */}
            <div className="flex items-center gap-1 text-[10px] text-slate-400 mr-auto">
              <span>انتقال سريع:</span>
              <button
                onClick={() => scrollToHour(8)}
                className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-purple-300 hover:text-white transition cursor-pointer"
              >
                08:00 ص
              </button>
              <button
                onClick={() => scrollToHour(14)}
                className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-purple-300 hover:text-white transition cursor-pointer"
              >
                02:00 م
              </button>
              <button
                onClick={() => scrollToHour(18)}
                className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-purple-300 hover:text-white transition cursor-pointer"
              >
                06:00 م
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 1: WEEKLY TIMETABLE GRID (24 Hours x 7 Days x 30 Minutes) */}
      {viewMode === 'grid' && (
        <div className="rounded-2xl bg-slate-900/90 border border-purple-500/30 shadow-2xl overflow-hidden flex flex-col">
          {/* Scrollable Container with horizontal & vertical scroll */}
          <div
            ref={gridScrollRef}
            className="overflow-x-auto overflow-y-auto max-h-[68vh] relative scroll-smooth"
            style={{ direction: 'rtl' }}
          >
            <div className="min-w-[780px] relative">
              {/* Sticky Days Header Row */}
              <div className="sticky top-0 z-30 flex bg-slate-950/95 backdrop-blur-md border-b border-purple-900/40">
                {/* Top-Right Sticky Time Column Header */}
                <div className="w-16 flex-shrink-0 p-2.5 text-center text-[10px] font-bold text-slate-400 border-l border-slate-800 sticky right-0 z-40 bg-slate-950 shadow-md">
                  الوقت
                </div>

                {/* 7 Days Columns Headers */}
                {WEEK_DAYS.map((day) => {
                  const isToday = day.dayIndex === todayIndex;
                  const dayClassCount = schedules.filter((s) => s.dayOfWeek === day.dayIndex).length;
                  return (
                    <div
                      key={day.dayIndex}
                      className={`flex-1 min-w-[95px] p-2 text-center border-l border-slate-800/80 last:border-l-0 ${
                        isToday ? 'bg-purple-950/40' : ''
                      }`}
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span
                          className={`text-xs font-bold ${
                            isToday ? 'text-amber-300 font-black' : 'text-slate-200'
                          }`}
                        >
                          {day.name}
                        </span>
                        {isToday && (
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" title="اليوم" />
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400">
                        {dayClassCount > 0 ? `${dayClassCount} حصص` : 'فارغ'}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Grid Body */}
              <div className="relative flex">
                {/* Sticky Right-side Time Labels Column */}
                <div className="w-16 flex-shrink-0 sticky right-0 z-20 bg-slate-950 border-l border-slate-800 select-none shadow-md">
                  {TIME_SLOTS.map((slot) => {
                    const isHourMark = slot.minutes === 0;
                    return (
                      <div
                        key={slot.time24}
                        style={{ height: `${ROW_HEIGHT}px` }}
                        className={`flex items-center justify-center text-[10px] font-mono border-b border-slate-800/50 ${
                          isHourMark
                            ? 'text-slate-300 font-bold bg-slate-950'
                            : 'text-slate-500 bg-slate-950/80'
                        }`}
                      >
                        <span>{slot.label}</span>
                      </div>
                    );
                  })}
                </div>

                {/* 7 Days Columns with Background Cells & Positioned Classes */}
                {WEEK_DAYS.map((day) => {
                  const daySchedules = schedules.filter((s) => s.dayOfWeek === day.dayIndex);
                  const isToday = day.dayIndex === todayIndex;

                  return (
                    <div
                      key={day.dayIndex}
                      className={`flex-1 min-w-[95px] relative border-l border-slate-800/80 last:border-l-0 ${
                        isToday ? 'bg-purple-950/10' : ''
                      }`}
                      style={{ height: `${48 * ROW_HEIGHT}px` }}
                    >
                      {/* Empty 30-min Background Cells for Clicking to Add */}
                      {TIME_SLOTS.map((slot) => {
                        const isHour = slot.minutes === 0;
                        return (
                          <div
                            key={slot.time24}
                            onClick={() => handleCellClick(day.dayIndex, slot.time24)}
                            style={{ height: `${ROW_HEIGHT}px` }}
                            className={`border-b transition cursor-pointer group hover:bg-purple-600/15 ${
                              isHour ? 'border-slate-800/70' : 'border-slate-800/30'
                            }`}
                            title={`إضافة حصة يوم ${day.name} الساعة ${slot.label}`}
                          >
                            <span className="opacity-0 group-hover:opacity-100 text-[9px] text-purple-300 px-1 py-0.5 transition">
                              + حجز
                            </span>
                          </div>
                        );
                      })}

                      {/* Rendered Booked Classes on top */}
                      {daySchedules.map((slot) => {
                        const startMin = getMinutesFromTime(slot.time);
                        const topPx = (startMin / 30) * ROW_HEIGHT;
                        const heightPx = Math.max(32, (slot.duration / 30) * ROW_HEIGHT - 3);
                        const colorInfo = getColorStyle(slot.color);

                        return (
                          <div
                            key={slot.id}
                            onClick={(e) => handleSlotClick(slot, e)}
                            style={{
                              top: `${topPx}px`,
                              height: `${heightPx}px`,
                              backgroundColor: colorInfo.bg,
                              borderColor: colorInfo.border,
                              color: colorInfo.text,
                            }}
                            className="absolute right-0.5 left-0.5 rounded-xl border p-1.5 overflow-hidden transition hover:scale-[1.02] hover:z-20 cursor-pointer shadow-md flex flex-col justify-between"
                          >
                            <div>
                              <div className="flex items-center justify-between gap-1 leading-tight">
                                <span className="font-bold text-xs truncate drop-shadow-sm">
                                  {slot.studentName}
                                </span>
                                {slot.classType === 'online' && (
                                  <Video className="w-2.5 h-2.5 flex-shrink-0 opacity-80" />
                                )}
                                {slot.classType === 'center' && (
                                  <Building className="w-2.5 h-2.5 flex-shrink-0 opacity-80" />
                                )}
                              </div>
                              <span className="text-[10px] opacity-90 font-mono block mt-0.5">
                                {slot.time} ({slot.duration}د)
                              </span>
                            </div>

                            {heightPx > 45 && slot.locationOrLink && (
                              <span className="text-[9px] opacity-75 truncate block">
                                {slot.locationOrLink}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: LIST VIEW (Filtered by day) */}
      {viewMode === 'list' && (
        <div className="space-y-3">
          {/* Days Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            <button
              onClick={() => setSelectedDayFilter('all')}
              className={`px-3 py-1.5 rounded-xl font-bold transition whitespace-nowrap cursor-pointer ${
                selectedDayFilter === 'all'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              الكل ({schedules.length})
            </button>

            {WEEK_DAYS.map((day) => {
              const count = schedules.filter((s) => s.dayOfWeek === day.dayIndex).length;
              const isToday = day.dayIndex === todayIndex;
              return (
                <button
                  key={day.dayIndex}
                  onClick={() => setSelectedDayFilter(day.dayIndex)}
                  className={`px-3 py-1.5 rounded-xl font-bold transition whitespace-nowrap cursor-pointer relative ${
                    selectedDayFilter === day.dayIndex
                      ? 'bg-purple-600 text-white shadow-md'
                      : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  <span>{day.name}</span>
                  {count > 0 && <span className="mr-1 text-[10px] opacity-80">({count})</span>}
                  {isToday && (
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 absolute top-1 left-1" />
                  )}
                </button>
              );
            })}
          </div>

          {/* List items */}
          {filteredListSchedules.length === 0 ? (
            <div className="rounded-2xl bg-slate-900/50 border border-slate-800 p-8 text-center">
              <Calendar className="w-10 h-10 mx-auto text-purple-400/60 mb-2" />
              <p className="text-sm font-bold text-slate-200">
                {selectedDayFilter === 'all' ? 'لا توجد مواعيد مسجلة' : 'لا توجد حصص في هذا اليوم'}
              </p>
              <button
                onClick={handleOpenAddDefault}
                className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 text-white text-xs font-bold hover:bg-purple-500 transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة حصة الآن</span>
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredListSchedules.map((slot) => {
                const colorInfo = getColorStyle(slot.color);
                const dayObj = WEEK_DAYS.find((d) => d.dayIndex === slot.dayOfWeek);

                return (
                  <div
                    key={slot.id}
                    onClick={() => setViewingScheduleDetails(slot)}
                    style={{ borderColor: colorInfo.border }}
                    className="rounded-2xl bg-slate-900/90 border p-3.5 flex items-center justify-between hover:border-purple-400 transition cursor-pointer shadow-md"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        style={{ backgroundColor: colorInfo.bg, borderColor: colorInfo.border }}
                        className="w-12 h-12 rounded-2xl border flex flex-col items-center justify-center font-bold"
                      >
                        <span className="font-mono text-xs" style={{ color: colorInfo.text }}>
                          {slot.time}
                        </span>
                        <span className="text-[9px] text-slate-400">{slot.duration}د</span>
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-white">{slot.studentName}</h3>
                          {getClassTypeBadge(slot.classType)}
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {dayObj?.name} •{' '}
                          <span className="text-purple-300">{getRecurrenceArabic(slot.recurrence)}</span>
                          {slot.locationOrLink && ` • ${slot.locationOrLink}`}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenEdit(slot);
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                        title="تعديل"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(slot.id);
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition cursor-pointer"
                        title="حذف"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: VIEW DETAILS OF A BOOKED CLASS */}
      {viewingScheduleDetails && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-slate-900 border border-purple-500/40 rounded-3xl p-5 shadow-2xl text-right space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-purple-900/40 pb-3">
              <div className="flex items-center gap-2">
                <span
                  className="w-4 h-4 rounded-full border shadow-sm"
                  style={{
                    backgroundColor: getColorStyle(viewingScheduleDetails.color).hex,
                    borderColor: getColorStyle(viewingScheduleDetails.color).border,
                  }}
                />
                <h3 className="text-base font-bold text-white">تفاصيل الحصة المجدولة</h3>
              </div>
              <button
                onClick={() => setViewingScheduleDetails(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Info Body */}
            <div className="space-y-2.5 text-xs text-slate-200">
              <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">الطالب / المجموعة:</span>
                  <span className="text-sm font-bold text-white">
                    {viewingScheduleDetails.studentName}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">نوع الحصة:</span>
                  {getClassTypeBadge(viewingScheduleDetails.classType)}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">اليوم:</span>
                  <span className="font-semibold text-purple-300">
                    {WEEK_DAYS.find((d) => d.dayIndex === viewingScheduleDetails.dayOfWeek)?.name}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">التوقيت والمدة:</span>
                  <span className="font-mono text-amber-300 font-bold">
                    {viewingScheduleDetails.time} إلى{' '}
                    {getEndTimeFormatted(
                      viewingScheduleDetails.time,
                      viewingScheduleDetails.duration
                    )}{' '}
                    ({viewingScheduleDetails.duration} دقيقة)
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">التكرار:</span>
                  <span>{getRecurrenceArabic(viewingScheduleDetails.recurrence)}</span>
                </div>
                {viewingScheduleDetails.locationOrLink && (
                  <div className="flex items-center justify-between pt-1 border-t border-slate-800">
                    <span className="text-slate-400">المكان / الرابط:</span>
                    <span className="text-slate-200 truncate max-w-[180px]">
                      {viewingScheduleDetails.locationOrLink}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2 pt-1">
              <button
                onClick={() => {
                  const toEdit = viewingScheduleDetails;
                  setViewingScheduleDetails(null);
                  handleOpenEdit(toEdit);
                }}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition cursor-pointer shadow-md"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>تعديل الموعد أو اللون</span>
              </button>

              <button
                onClick={() => handleDelete(viewingScheduleDetails.id)}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-rose-950/60 hover:bg-rose-900/60 border border-rose-500/40 text-rose-300 text-xs font-bold transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>حذف هذه الحصة</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: ADD / EDIT SCHEDULE MODAL (WITH COLOR PALETTE PICKER) */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-purple-500/40 rounded-3xl p-5 shadow-2xl text-right max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-purple-900/40 pb-3 mb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-purple-400" />
                <span>{editingSchedule ? 'تعديل موعد الحصة' : 'إضافة موعد حصة جديد'}</span>
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3 overflow-y-auto pr-1">
              {/* Student Picker */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  الطالب أو اسم المجموعة *
                </label>
                {students.length > 0 && (
                  <select
                    value={formStudentId}
                    onChange={(e) => handleStudentSelectChange(e.target.value)}
                    className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-400 mb-2 cursor-pointer"
                  >
                    <option value="custom">-- اسم مخصص / مجموعة خارجية --</option>
                    {students.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.subject})
                      </option>
                    ))}
                  </select>
                )}
                {(formStudentId === 'custom' || students.length === 0) && (
                  <input
                    type="text"
                    value={formStudentName}
                    onChange={(e) => setFormStudentName(e.target.value)}
                    placeholder="اكتب اسم الطالب أو المجموعة..."
                    required
                    className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-400"
                  />
                )}
              </div>

              {/* Day & Time Selection with Multi-day Support */}
              <div className="space-y-2">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-medium text-slate-300">
                      {editingSchedule ? 'يوم الحصة' : 'أيام الحصة في الأسبوع (يمكنك اختيار أكثر من يوم)'}
                    </label>
                    <span className="text-[11px] text-purple-300 font-bold">
                      {formSelectedDays.length === 1
                        ? WEEK_DAYS.find((d) => d.dayIndex === formSelectedDays[0])?.name
                        : `${formSelectedDays.length} أيام مختارة`}
                    </span>
                  </div>

                  {/* 7 Day Toggle Pills */}
                  <div className="grid grid-cols-4 gap-1.5 mb-2">
                    {WEEK_DAYS.map((d) => {
                      const isSelected = formSelectedDays.includes(d.dayIndex);
                      return (
                        <button
                          key={d.dayIndex}
                          type="button"
                          onClick={() => toggleDaySelection(d.dayIndex)}
                          className={`py-1.5 px-2 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center justify-center gap-1 ${
                            isSelected
                              ? 'bg-purple-600 border-purple-400 text-white shadow-md'
                              : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-white'
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3 text-amber-300" />}
                          <span>{d.name}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Common Multi-Day Quick Presets for New Appointments */}
                  {!editingSchedule && (
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[10px]">
                      <span className="text-slate-500 flex-shrink-0">نماذج شائعة:</span>
                      <button
                        type="button"
                        onClick={() => selectPresetDays([6, 3])}
                        className="px-2 py-0.5 rounded-lg bg-slate-800 text-purple-300 hover:bg-slate-700 border border-slate-700 transition cursor-pointer whitespace-nowrap"
                      >
                        السبت والأربعاء
                      </button>
                      <button
                        type="button"
                        onClick={() => selectPresetDays([0, 2])}
                        className="px-2 py-0.5 rounded-lg bg-slate-800 text-purple-300 hover:bg-slate-700 border border-slate-700 transition cursor-pointer whitespace-nowrap"
                      >
                        الأحد والثلاثاء
                      </button>
                      <button
                        type="button"
                        onClick={() => selectPresetDays([1, 4])}
                        className="px-2 py-0.5 rounded-lg bg-slate-800 text-purple-300 hover:bg-slate-700 border border-slate-700 transition cursor-pointer whitespace-nowrap"
                      >
                        الإثنين والخميس
                      </button>
                      <button
                        type="button"
                        onClick={() => selectPresetDays([6, 0, 1, 2, 3, 4, 5])}
                        className="px-2 py-0.5 rounded-lg bg-slate-800 text-amber-300 hover:bg-slate-700 border border-slate-700 transition cursor-pointer whitespace-nowrap"
                      >
                        طوال الأسبوع
                      </button>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    وقت البدء (لكافة الأيام المختارة)
                  </label>
                  <select
                    value={formTime}
                    onChange={(e) => setFormTime(e.target.value)}
                    className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-400 cursor-pointer"
                  >
                    {TIME_SLOTS.map((slot) => (
                      <option key={slot.time24} value={slot.time24}>
                        {slot.label} ({slot.time24})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Duration & Recurrence */}
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
                    <option value={30}>30 دقيقة (نصف ساعة)</option>
                    <option value={45}>45 دقيقة</option>
                    <option value={60}>60 دقيقة (ساعة كاملة)</option>
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

              {/* Class Type */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">نوع الحصة</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormClassType('private')}
                    className={`py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                      formClassType === 'private'
                        ? 'bg-purple-600/30 border-purple-400 text-purple-200'
                        : 'bg-slate-800/60 border-slate-700 text-slate-400'
                    }`}
                  >
                    برايفيت
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormClassType('online')}
                    className={`py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                      formClassType === 'online'
                        ? 'bg-blue-600/30 border-blue-400 text-blue-200'
                        : 'bg-slate-800/60 border-slate-700 text-slate-400'
                    }`}
                  >
                    أونلاين
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormClassType('center')}
                    className={`py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                      formClassType === 'center'
                        ? 'bg-amber-600/30 border-amber-400 text-amber-200'
                        : 'bg-slate-800/60 border-slate-700 text-slate-400'
                    }`}
                  >
                    سنتر
                  </button>
                </div>
              </div>

              {/* COLOR PALETTE PICKER (الميزة المطلوبة) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                    <Palette className="w-3.5 h-3.5 text-purple-400" />
                    <span>لون الحصة في الجدول الشبكي</span>
                  </label>
                  <span className="text-[11px] text-purple-300 font-semibold">
                    {getColorStyle(formColor).name}
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-2 p-2.5 rounded-2xl bg-slate-950/60 border border-slate-800">
                  {CLASS_COLORS.map((color) => {
                    const isSelected = formColor === color.id;
                    return (
                      <button
                        key={color.id}
                        type="button"
                        onClick={() => setFormColor(color.id)}
                        style={{
                          backgroundColor: color.bg,
                          borderColor: color.border,
                        }}
                        className={`py-1.5 px-2 rounded-xl border flex items-center justify-center gap-1.5 transition cursor-pointer active:scale-95 ${
                          isSelected
                            ? 'ring-2 ring-white shadow-lg scale-105'
                            : 'opacity-70 hover:opacity-100'
                        }`}
                      >
                        <span
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: color.hex }}
                        />
                        <span className="text-[10px] font-bold" style={{ color: color.text }}>
                          {color.name}
                        </span>
                        {isSelected && <Check className="w-3 h-3 text-white mr-auto" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Location or Link */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  المكان أو الرابط (اختياري)
                </label>
                <input
                  type="text"
                  value={formLocationOrLink}
                  onChange={(e) => setFormLocationOrLink(e.target.value)}
                  placeholder="مثال: سنتر الأوائل أو رابط Zoom أو عنوان الطالب"
                  className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-400"
                />
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:brightness-110 py-2.5 text-xs font-bold text-white transition active:scale-95 disabled:opacity-50 cursor-pointer shadow-lg shadow-purple-950/50"
                >
                  {isSubmitting
                    ? 'جارٍ الحفظ...'
                    : editingSchedule
                    ? 'حفظ التعديلات'
                    : 'إضافة الحصة للجدول'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
