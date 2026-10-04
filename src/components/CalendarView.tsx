import React, { useState } from 'react';
import { TeacherProfile, Student, ScheduleSlot, ClassType } from '../types';
import { toggleScheduleCompletedToday } from '../firebase';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  Video,
  UserCheck,
  Sparkles,
  Check,
  Star,
  Edit2,
  Trash2,
  ExternalLink,
  MessageCircle,
} from 'lucide-react';
import { getSlotColorStyle, getClassTypeMeta } from './ScheduleTab';

interface CalendarViewProps {
  schedules: ScheduleSlot[];
  students: Student[];
  profile: TeacherProfile;
  onAddSchedule: (dayOfWeek: number, time?: string) => void;
  onEditSchedule: (slot: ScheduleSlot) => void;
  onDeleteSchedule: (id: string) => void;
  onViewDetails: (slot: ScheduleSlot) => void;
  onOpenQuickEval: (slot: ScheduleSlot, e?: React.MouseEvent) => void;
}

export const ARABIC_MONTHS = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
];

export const CALENDAR_WEEK_DAYS = [
  { dayIndex: 6, name: 'السبت', short: 'سبت' },
  { dayIndex: 0, name: 'الأحد', short: 'أحد' },
  { dayIndex: 1, name: 'الإثنين', short: 'إثنين' },
  { dayIndex: 2, name: 'الثلاثاء', short: 'ثلاثاء' },
  { dayIndex: 3, name: 'الأربعاء', short: 'أربعاء' },
  { dayIndex: 4, name: 'الخميس', short: 'خميس' },
  { dayIndex: 5, name: 'الجمعة', short: 'جمعة' },
];

export const CalendarView: React.FC<CalendarViewProps> = ({
  schedules,
  students,
  profile,
  onAddSchedule,
  onEditSchedule,
  onDeleteSchedule,
  onViewDetails,
  onOpenQuickEval,
}) => {
  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [selectedDayInMonth, setSelectedDayInMonth] = useState<number>(today.getDate());
  const [typeFilter, setTypeFilter] = useState<'all' | 'online' | 'in_person' | 'trial'>('all');

  // Month navigation
  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
    setSelectedDayInMonth(1);
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
    setSelectedDayInMonth(1);
  };

  const handleJumpToToday = () => {
    const t = new Date();
    setCurrentYear(t.getFullYear());
    setCurrentMonth(t.getMonth());
    setSelectedDayInMonth(t.getDate());
  };

  // Days calculation
  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const totalDays = getDaysInMonth(currentYear, currentMonth);
  const firstDayOfWeek = new Date(currentYear, currentMonth, 1).getDay(); // 0 (Sun) - 6 (Sat)
  // Saturday is index 0 in our week: Sat(6)=0, Sun(0)=1, Mon(1)=2, Tue(2)=3, Wed(3)=4, Thu(4)=5, Fri(5)=6
  const paddingOffset = (firstDayOfWeek + 1) % 7;

  // Filter helper
  const filterSlot = (slot: ScheduleSlot) => {
    if (typeFilter === 'all') return true;
    if (typeFilter === 'online') return slot.classType === 'online';
    if (typeFilter === 'trial') return slot.classType === 'trial';
    return slot.classType === 'in_person' || !slot.classType || slot.classType === 'center' || slot.classType === 'private';
  };

  const filteredSchedules = schedules.filter(filterSlot);

  // Month metrics
  let monthTotalClasses = 0;
  let monthOnlineCount = 0;
  let monthInPersonCount = 0;
  let monthTrialCount = 0;

  for (let d = 1; d <= totalDays; d++) {
    const dateObj = new Date(currentYear, currentMonth, d);
    const dow = dateObj.getDay();
    const daySlots = filteredSchedules.filter((s) => s.dayOfWeek === dow);
    monthTotalClasses += daySlots.length;
    daySlots.forEach((s) => {
      if (s.classType === 'online') monthOnlineCount++;
      else if (s.classType === 'trial') monthTrialCount++;
      else monthInPersonCount++;
    });
  }

  // Selected Day Details
  const selectedDateObject = new Date(currentYear, currentMonth, selectedDayInMonth);
  const selectedDayOfWeekIndex = selectedDateObject.getDay();
  const selectedDayArabicName = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'][selectedDayOfWeekIndex];

  const selectedDaySlots = filteredSchedules
    .filter((s) => s.dayOfWeek === selectedDayOfWeekIndex)
    .sort((a, b) => a.time.localeCompare(b.time));

  const todayStr = new Intl.DateTimeFormat('en-CA').format(today);
  const nowMinutes = today.getHours() * 60 + today.getMinutes();

  return (
    <div className="space-y-4 text-right">
      {/* Header with Type Filters & Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Class Type Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <button
            type="button"
            onClick={() => setTypeFilter('all')}
            className={`px-3 py-1.5 rounded-xl font-bold transition whitespace-nowrap cursor-pointer shadow-sm ${
              typeFilter === 'all'
                ? 'bg-purple-600 text-white shadow-purple-900/40'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            كافة الحصص ({schedules.length})
          </button>
          <button
            type="button"
            onClick={() => setTypeFilter('online')}
            className={`px-2.5 py-1.5 rounded-xl font-bold transition whitespace-nowrap cursor-pointer border flex items-center gap-1.5 ${
              typeFilter === 'online'
                ? 'bg-sky-500/30 border-sky-400 text-sky-200 shadow-sm'
                : 'bg-slate-900 border-slate-800 text-sky-400 hover:text-white'
            }`}
          >
            <Video className="w-3.5 h-3.5 text-sky-400" />
            <span>أونلاين ({schedules.filter((s) => s.classType === 'online').length})</span>
          </button>
          <button
            type="button"
            onClick={() => setTypeFilter('in_person')}
            className={`px-2.5 py-1.5 rounded-xl font-bold transition whitespace-nowrap cursor-pointer border flex items-center gap-1.5 ${
              typeFilter === 'in_person'
                ? 'bg-emerald-500/30 border-emerald-400 text-emerald-200 shadow-sm'
                : 'bg-slate-900 border-slate-800 text-emerald-400 hover:text-white'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>شخصي ({schedules.filter((s) => s.classType === 'in_person' || !s.classType || s.classType === 'center' || s.classType === 'private').length})</span>
          </button>
          <button
            type="button"
            onClick={() => setTypeFilter('trial')}
            className={`px-2.5 py-1.5 rounded-xl font-bold transition whitespace-nowrap cursor-pointer border flex items-center gap-1.5 ${
              typeFilter === 'trial'
                ? 'bg-amber-500/30 border-amber-400 text-amber-200 shadow-sm'
                : 'bg-slate-900 border-slate-800 text-amber-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>تجريبية ({schedules.filter((s) => s.classType === 'trial').length})</span>
          </button>
        </div>

        {/* Action Button: Add slot */}
        <button
          type="button"
          onClick={() => onAddSchedule(selectedDayOfWeekIndex, '16:00')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold transition active:scale-95 shadow-md shadow-purple-950/40 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>إضافة حصة للمجدول</span>
        </button>
      </div>

      {/* Monthly Navigation Card */}
      <div className="flex items-center justify-between bg-gradient-to-r from-slate-900 via-slate-900/95 to-purple-950/30 border border-purple-500/20 rounded-2xl p-3.5 shadow-xl">
        <div className="flex items-center gap-2">
          {/* Previous Month (Right Arrow in RTL) */}
          <button
            type="button"
            onClick={handlePrevMonth}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-purple-300 transition cursor-pointer active:scale-95"
            title="الشهر السابق"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          {/* Month & Year Title with Selectors */}
          <div className="flex items-center gap-1.5 px-2">
            <span className="text-base font-black text-white font-mono">
              {ARABIC_MONTHS[currentMonth]}
            </span>
            <span className="text-base font-bold text-purple-300 font-mono">
              {currentYear}
            </span>
          </div>

          {/* Next Month (Left Arrow in RTL) */}
          <button
            type="button"
            onClick={handleNextMonth}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-purple-300 transition cursor-pointer active:scale-95"
            title="الشهر التالي"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>

        {/* Quick Month Selectors & Today Jump */}
        <div className="flex items-center gap-2">
          <select
            value={currentMonth}
            onChange={(e) => {
              setCurrentMonth(Number(e.target.value));
              setSelectedDayInMonth(1);
            }}
            className="bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1 text-xs font-bold text-white focus:outline-none focus:border-purple-400 cursor-pointer"
          >
            {ARABIC_MONTHS.map((m, idx) => (
              <option key={m} value={idx}>
                {m}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={handleJumpToToday}
            className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition border border-purple-400/40 shadow-sm cursor-pointer active:scale-95"
          >
            اليوم 📍
          </button>
        </div>
      </div>

      {/* Main Interactive Calendar Grid Container */}
      <div className="rounded-3xl bg-slate-900/90 border border-purple-500/25 shadow-2xl p-3.5 overflow-hidden">
        {/* Day of Week Headers */}
        <div className="grid grid-cols-7 gap-1.5 border-b border-purple-500/15 pb-2.5 mb-2 text-center text-xs font-bold text-slate-300">
          {CALENDAR_WEEK_DAYS.map((day) => (
            <div key={day.dayIndex} className="py-1">
              <span className="hidden sm:inline">{day.name}</span>
              <span className="sm:hidden">{day.short}</span>
            </div>
          ))}
        </div>

        {/* Month Day Cells */}
        <div className="grid grid-cols-7 gap-1.5">
          {/* 1. Padding offset cells */}
          {Array.from({ length: paddingOffset }).map((_, i) => (
            <div
              key={`pad-${i}`}
              className="aspect-square rounded-2xl bg-slate-950/20 border border-transparent opacity-10"
            />
          ))}

          {/* 2. Actual Month Days */}
          {Array.from({ length: totalDays }).map((_, i) => {
            const dayNum = i + 1;
            const dateObj = new Date(currentYear, currentMonth, dayNum);
            const dow = dateObj.getDay();
            const isToday =
              dayNum === today.getDate() &&
              currentMonth === today.getMonth() &&
              currentYear === today.getFullYear();
            const isSelected = selectedDayInMonth === dayNum;

            // Slots on this day of week
            const daySlots = filteredSchedules
              .filter((s) => s.dayOfWeek === dow)
              .sort((a, b) => a.time.localeCompare(b.time));

            return (
              <div
                key={`day-${dayNum}`}
                onClick={() => setSelectedDayInMonth(dayNum)}
                className={`min-h-[76px] sm:min-h-[92px] rounded-2xl border p-1.5 relative flex flex-col justify-between transition cursor-pointer select-none ${
                  isToday
                    ? 'bg-purple-950/40 border-purple-500 ring-2 ring-purple-400/80 shadow-lg shadow-purple-950/50'
                    : isSelected
                    ? 'bg-slate-800/95 border-purple-400 shadow-md ring-1 ring-purple-500/50'
                    : 'bg-slate-950/70 border-slate-800 hover:bg-slate-850 hover:border-slate-700'
                }`}
              >
                {/* Day Number and Badges */}
                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs sm:text-sm font-mono font-black ${
                      isToday
                        ? 'text-amber-300'
                        : isSelected
                        ? 'text-purple-300'
                        : 'text-slate-200'
                    }`}
                  >
                    {dayNum}
                  </span>

                  {isToday ? (
                    <span className="text-[9px] bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-black px-1.5 py-0.2 rounded-full shadow">
                      اليوم
                    </span>
                  ) : daySlots.length > 0 ? (
                    <span className="w-2 h-2 rounded-full bg-purple-500 shadow-sm shadow-purple-400" />
                  ) : null}
                </div>

                {/* Day Scheduled Lesson Pills */}
                <div className="space-y-1 mt-1 max-h-[60px] overflow-hidden flex flex-col justify-end">
                  {daySlots.slice(0, 2).map((slot) => {
                    const col = getSlotColorStyle(slot);
                    return (
                      <div
                        key={slot.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          onViewDetails(slot);
                        }}
                        style={{
                          backgroundColor: col.bg,
                          borderColor: col.border,
                          color: col.text,
                        }}
                        className="text-[9px] font-bold py-0.5 px-1.5 rounded-lg border truncate flex items-center justify-between hover:scale-[1.02] transition shadow-xs"
                        title={`${slot.studentName} (${slot.time})`}
                      >
                        <span className="truncate">{slot.studentName}</span>
                        <span className="opacity-80 font-mono text-[8px] mr-1">
                          {slot.time}
                        </span>
                      </div>
                    );
                  })}

                  {daySlots.length > 2 && (
                    <span className="text-[8px] text-purple-300 font-bold text-center block leading-none">
                      +{daySlots.length - 2} حصص أخرى
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Monthly Statistics KPI Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
        <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 shadow-md">
          <span className="text-[11px] text-slate-400 block">إجمالي حصص الشهر 📅</span>
          <span className="font-extrabold text-purple-300 font-mono text-base block mt-1">
            {monthTotalClasses} حصة
          </span>
        </div>
        <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 shadow-md">
          <span className="text-[11px] text-sky-400 block">حصص أونلاين 🌐</span>
          <span className="font-extrabold text-sky-300 font-mono text-base block mt-1">
            {monthOnlineCount} حصة
          </span>
        </div>
        <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 shadow-md">
          <span className="text-[11px] text-emerald-400 block">حضور شخصي 👤</span>
          <span className="font-extrabold text-emerald-300 font-mono text-base block mt-1">
            {monthInPersonCount} حصة
          </span>
        </div>
        <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 shadow-md">
          <span className="text-[11px] text-amber-400 block">حصص تجريبية ✨</span>
          <span className="font-extrabold text-amber-300 font-mono text-base block mt-1">
            {monthTrialCount} حصة
          </span>
        </div>
      </div>

      {/* Interactive Selected Day Schedule Breakdown */}
      <div className="rounded-3xl bg-slate-900/95 border border-purple-500/25 p-4 space-y-3.5 shadow-2xl text-right">
        <div className="flex items-center justify-between border-b border-purple-500/10 pb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-600/20 text-purple-300 flex items-center justify-center border border-purple-500/30">
              <CalendarIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white">
                حصص ومواعيد يوم {selectedDayArabicName} {selectedDayInMonth} {ARABIC_MONTHS[currentMonth]} {currentYear}
              </h3>
              <p className="text-[11px] text-slate-400">
                {selectedDaySlots.length > 0
                  ? `لديك ${selectedDaySlots.length} حصص مجدولة في هذا اليوم`
                  : 'لا توجد حصص مجدولة في هذا اليوم بعد'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onAddSchedule(selectedDayOfWeekIndex, '16:00')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition active:scale-95 shadow cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة حصة اليوم</span>
          </button>
        </div>

        {selectedDaySlots.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400 bg-slate-950/40 rounded-2xl border border-slate-800/80 flex flex-col items-center justify-center gap-2">
            <Clock className="w-8 h-8 text-slate-600" />
            <p>لا توجد حصص مسجلة في هذا اليوم المختار 🌟</p>
            <button
              type="button"
              onClick={() => onAddSchedule(selectedDayOfWeekIndex, '16:00')}
              className="mt-1 text-xs text-purple-400 hover:text-purple-300 font-bold underline cursor-pointer"
            >
              اضغط هنا لجدولة حصة جديدة في هذا اليوم
            </button>
          </div>
        ) : (
          <div className="space-y-2.5">
            {selectedDaySlots.map((slot) => {
              const colorInfo = getSlotColorStyle(slot);
              const meta = getClassTypeMeta(slot.classType);
              const [slotH, slotM] = slot.time.split(':').map(Number);
              const startMin = (slotH || 0) * 60 + (slotM || 0);
              const endMin = startMin + (slot.duration || 60);

              const isTodaySlot =
                today.getDate() === selectedDayInMonth &&
                today.getMonth() === currentMonth &&
                today.getFullYear() === currentYear;
              const isExplicitlyCompleted = slot.completedTodayDate === todayStr;
              const isPastTime = isTodaySlot && nowMinutes >= endMin;
              const isCompleted = isExplicitlyCompleted || isPastTime;

              const student = students.find((st) => st.id === slot.studentId);
              const studentPhone = student?.whatsapp || '';

              return (
                <div
                  key={slot.id}
                  style={{
                    borderColor: isCompleted ? 'rgba(16, 185, 129, 0.4)' : colorInfo.border,
                  }}
                  className={`rounded-2xl bg-slate-950/85 p-3.5 border transition hover:border-purple-500/50 flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 shadow-md ${
                    isCompleted ? 'opacity-90 bg-emerald-950/15' : ''
                  }`}
                >
                  {/* Left: Info */}
                  <div className="flex items-center gap-3">
                    <div
                      style={{ backgroundColor: colorInfo.hex }}
                      className="w-3.5 h-3.5 rounded-full flex-shrink-0"
                    />

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4
                          onClick={() => onViewDetails(slot)}
                          className={`text-sm font-bold text-white hover:text-purple-300 transition cursor-pointer ${
                            isCompleted ? 'line-through text-slate-400 decoration-emerald-400' : ''
                          }`}
                        >
                          {slot.studentName}
                        </h4>
                        <span className={`text-[10px] px-2 py-0.5 rounded-lg border ${meta.badgeClass}`}>
                          {meta.shortLabel}
                        </span>
                        {isCompleted && (
                          <span className="text-[10px] px-2 py-0.5 rounded-lg bg-emerald-950 text-emerald-300 font-bold border border-emerald-500/40">
                            تمت الحصة ✅
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-xs text-slate-400 mt-1 flex-wrap font-mono">
                        <span className="flex items-center gap-1 text-purple-300 font-bold">
                          <Clock className="w-3.5 h-3.5" />
                          <span>{slot.time}</span>
                          <span className="text-[10px] text-slate-400">({slot.duration || 60} دقيقة)</span>
                        </span>
                        {slot.locationOrLink && (
                          <span className="text-slate-400 text-[11px] truncate max-w-[200px]">
                            • {slot.locationOrLink}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-1.5 flex-wrap mr-auto">
                    {/* Evaluation Button */}
                    <button
                      type="button"
                      onClick={(e) => onOpenQuickEval(slot, e)}
                      className={`p-1.5 rounded-xl border text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                        slot.rating
                          ? 'bg-amber-950/80 border-amber-500/50 text-amber-300 hover:bg-amber-900/90'
                          : 'bg-slate-900 border-slate-700 text-amber-400 hover:bg-slate-800'
                      }`}
                      title="تقييم الحصة"
                    >
                      <Star className={`w-3.5 h-3.5 ${slot.rating ? 'fill-amber-400 text-amber-400' : 'text-amber-400'}`} />
                      <span>{slot.rating ? `${slot.rating}/5 ⭐` : 'تقييم'}</span>
                    </button>

                    {/* WhatsApp Reminder Button */}
                    {studentPhone && (
                      <a
                        href={`https://wa.me/${studentPhone.replace(/\D/g, '')}?text=${encodeURIComponent(
                          `السلام عليكم 🌷\nتذكير بموعد حصة الطالب/ـة (${slot.studentName}) اليوم الساعة ${slot.time} بمشيئة الله.`
                        )}`}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 rounded-xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-900 transition flex items-center gap-1 text-xs font-bold"
                        title="إرسال تذكير واتساب"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">واتساب</span>
                      </a>
                    )}

                    {/* Mark Completed Button */}
                    {isTodaySlot && (
                      <button
                        type="button"
                        onClick={async (e) => {
                          e.stopPropagation();
                          try {
                            await toggleScheduleCompletedToday(profile.id, slot.id, !isExplicitlyCompleted);
                          } catch (err) {
                            console.error('Error toggling complete status', err);
                          }
                        }}
                        className={`p-1.5 rounded-xl border text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                          isExplicitlyCompleted
                            ? 'bg-purple-950 border-purple-500/40 text-purple-300'
                            : 'bg-emerald-950 border-emerald-500/40 text-emerald-300 hover:bg-emerald-900'
                        }`}
                        title={isExplicitlyCompleted ? 'إلغاء التمام' : 'تسجيل حضور'}
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">
                          {isExplicitlyCompleted ? 'تمت ✅' : 'تسجيل حضور'}
                        </span>
                      </button>
                    )}

                    {/* Edit */}
                    <button
                      type="button"
                      onClick={() => onEditSchedule(slot)}
                      className="p-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white transition cursor-pointer"
                      title="تعديل الحصة"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    {/* Delete */}
                    <button
                      type="button"
                      onClick={() => onDeleteSchedule(slot.id)}
                      className="p-1.5 rounded-xl bg-slate-900 border border-slate-800 text-rose-400 hover:text-rose-300 transition cursor-pointer"
                      title="حذف الحصة"
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
    </div>
  );
};
