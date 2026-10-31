import React, { useState, useEffect, useRef, useMemo } from 'react';
import { TeacherProfile, Student, ScheduleSlot, ClassType, RecurrenceType, Group } from '../types';
import {
  addSchedule,
  updateSchedule,
  deleteSchedule,
  toggleScheduleCompletedToday,
  saveScheduleEvaluation,
  addStudent,
  subscribeToGroups,
  subscribeToStudents,
  subscribeToSchedules,
  bulkShiftSchedules,
} from '../firebase';
import { TimeShiftModal } from './TimeShiftModal';
import { EditLessonModal } from './EditLessonModal';
import { useFirebaseSubscription } from '../hooks/useFirebaseSubscription';
import { exportScheduleToPdf } from '../services/pdfReportService';
import { VoiceInputButton } from './VoiceInputButton';
import { CalendarView } from './CalendarView';
import { DailyAttendanceModal } from './DailyAttendanceModal';
import { useBackHandler } from '../services/backHandler';
import { hasConflict, getMinutesFromTime } from '../services/conflictService';
import { isStudentPaused } from '../services/studentStatus';
import { formatTime12h, formatTime12hShort } from '../utils/timeZone';
import {
  Calendar,
  Clock,
  Plus,
  Trash2,
  Edit2,
  X,
  Bell,
  Video,
  UserCheck,
  User,
  UserPlus,
  Check,
  CheckCircle,
  LayoutGrid,
  List,
  Sparkles,
  AlertCircle,
  Star,
  Search,
  Layers,
  Printer,
  MessageCircle,
} from 'lucide-react';

interface ScheduleTabProps {
  profile: TeacherProfile;
  students: Student[];
  schedules: ScheduleSlot[];
}

// Custom Vibrant Palette for Classes
export const CLASS_COLORS = [
  { id: 'cyan', name: 'أزرق سماوي (أونلاين)', hex: '#06b6d4', bg: 'rgba(14, 165, 233, 0.28)', border: '#38bdf8', text: '#e0f2fe' },
  { id: 'emerald', name: 'أخضر زمردي (حضور شخصي)', hex: '#10b981', bg: 'rgba(16, 185, 129, 0.28)', border: '#34d399', text: '#d1fae5' },
  { id: 'amber', name: 'ذهبي / برتقالي (حصة تجريبية)', hex: '#f59e0b', bg: 'rgba(245, 158, 11, 0.32)', border: '#fbbf24', text: '#fef3c7' },
  { id: 'purple', name: 'بنفسجي ملكي', hex: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.28)', border: '#a78bfa', text: '#ede9fe' },
  { id: 'blue', name: 'أزرق كلاسيكي', hex: '#3b82f6', bg: 'rgba(59, 130, 246, 0.28)', border: '#60a5fa', text: '#dbeafe' },
  { id: 'rose', name: 'وردي', hex: '#ec4899', bg: 'rgba(236, 72, 153, 0.28)', border: '#f472b6', text: '#fce7f3' },
  { id: 'red', name: 'أحمر قرمزي', hex: '#ef4444', bg: 'rgba(239, 68, 68, 0.28)', border: '#f87171', text: '#fee2e2' },
  { id: 'indigo', name: 'نيلي', hex: '#6366f1', bg: 'rgba(99, 102, 241, 0.28)', border: '#818cf8', text: '#e0e7ff' },
];

export interface ClassTypeMeta {
  id: ClassType;
  label: string;
  shortLabel: string;
  desc: string;
  bg: string;
  border: string;
  text: string;
  badgeClass: string;
  dotColor: string;
  colorId: string;
}

export const CLASS_TYPE_META: Record<string, ClassTypeMeta> = {
  online: {
    id: 'online',
    label: 'أونلاين',
    shortLabel: 'أونلاين 🌐',
    desc: 'عبر الإنترنت (Zoom / Teams / Meet)',
    bg: 'rgba(14, 165, 233, 0.28)',
    border: '#38bdf8',
    text: '#e0f2fe',
    badgeClass: 'bg-sky-950/90 border-sky-500/50 text-sky-300 font-semibold',
    dotColor: '#38bdf8',
    colorId: 'cyan',
  },
  in_person: {
    id: 'in_person',
    label: 'حضور شخصي',
    shortLabel: 'حضور شخصي 👤',
    desc: 'لقاء مباشر (منزل الطالب / السنتر / المكتب)',
    bg: 'rgba(16, 185, 129, 0.28)',
    border: '#34d399',
    text: '#d1fae5',
    badgeClass: 'bg-emerald-950/90 border-emerald-500/50 text-emerald-300 font-semibold',
    dotColor: '#34d399',
    colorId: 'emerald',
  },
  trial: {
    id: 'trial',
    label: 'حصة تجريبية',
    shortLabel: 'حصة تجريبية ✨',
    desc: 'جلسة أولى للتقييم والتعارف (مجانية أو مخفضة)',
    bg: 'rgba(245, 158, 11, 0.32)',
    border: '#fbbf24',
    text: '#fef3c7',
    badgeClass: 'bg-amber-950/90 border-amber-500/50 text-amber-300 font-semibold ring-1 ring-amber-400/30',
    dotColor: '#fbbf24',
    colorId: 'amber',
  },
  private: {
    id: 'in_person',
    label: 'حضور شخصي',
    shortLabel: 'حضور شخصي 👤',
    desc: 'لقاء مباشر',
    bg: 'rgba(16, 185, 129, 0.28)',
    border: '#34d399',
    text: '#d1fae5',
    badgeClass: 'bg-emerald-950/90 border-emerald-500/50 text-emerald-300 font-semibold',
    dotColor: '#34d399',
    colorId: 'emerald',
  },
  center: {
    id: 'in_person',
    label: 'حضور شخصي (سنتر)',
    shortLabel: 'سنتر 🏫',
    desc: 'حضور في السنتر',
    bg: 'rgba(16, 185, 129, 0.28)',
    border: '#34d399',
    text: '#d1fae5',
    badgeClass: 'bg-emerald-950/90 border-emerald-500/50 text-emerald-300 font-semibold',
    dotColor: '#34d399',
    colorId: 'emerald',
  },
};

export function getClassTypeMeta(type?: string): ClassTypeMeta {
  if (type && CLASS_TYPE_META[type]) {
    return CLASS_TYPE_META[type];
  }
  return CLASS_TYPE_META.in_person;
}

export function getColorStyle(colorId?: string) {
  const found = CLASS_COLORS.find((c) => c.id === colorId || c.hex === colorId);
  return found || CLASS_COLORS[0];
}

export function getSlotColorStyle(slot: { classType?: ClassType; color?: string }) {
  if (slot.color && slot.color !== 'purple' && slot.color !== 'default') {
    const custom = CLASS_COLORS.find((c) => c.id === slot.color || c.hex === slot.color);
    if (custom) return custom;
  }
  const meta = getClassTypeMeta(slot.classType);
  const typeColor = CLASS_COLORS.find((c) => c.id === meta.colorId);
  return (
    typeColor || {
      id: meta.id,
      name: meta.label,
      hex: meta.dotColor,
      bg: meta.bg,
      border: meta.border,
      text: meta.text,
    }
  );
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

export interface FormSlotItem {
  id: string;
  dayOfWeek: number;
  time: string;
  duration: number;
  classType: ClassType;
  color: string;
  recurrence: RecurrenceType;
  locationOrLink?: string;
  notes?: string;
}

export const ScheduleTab: React.FC<ScheduleTabProps> = React.memo(({ profile, students: propsStudents, schedules: propsSchedules }) => {
  const { data: studentsData = [] } = useFirebaseSubscription(
    profile ? `students/${profile.id}` : null,
    (cb) => subscribeToStudents(profile.id, cb)
  );
  const { data: rawSchedulesData = [] } = useFirebaseSubscription(
    profile ? `schedules/${profile.id}` : null,
    (cb) => subscribeToSchedules(profile.id, cb)
  );

  const students = propsStudents || studentsData;
  const rawSchedules = propsSchedules || rawSchedulesData;
  const [groups, setGroups] = useState<Group[]>([]);
  const [isTimeShiftOpen, setIsTimeShiftOpen] = useState(false);

  useEffect(() => {
    const unsub = subscribeToGroups(profile.id, (g) => setGroups(g));
    return () => unsub();
  }, [profile.id]);

  // Derived group schedule slots: automatically generated for all active groups
  const groupSlots = useMemo(() => {
    const slots: ScheduleSlot[] = [];
    groups.forEach((g) => {
      if (g.status !== 'active' || g.archived || !Array.isArray(g.schedule)) return;
      const studentCount = students.filter(
        (s) => !s.archived && !isStudentPaused(s) && s.groupIds && s.groupIds.includes(g.id)
      ).length;

      g.schedule.forEach((item) => {
        slots.push({
          id: `group_slot_${g.id}_day_${item.day}_time_${item.time}`,
          teacherId: profile.id,
          studentId: `group_${g.id}`,
          studentName: `مجموعة ${g.name} (${studentCount} طلاب)`,
          dayOfWeek: item.day,
          time: item.time,
          duration: item.duration || 60,
          recurrence: 'weekly',
          classType: 'center',
          color: g.color || 'purple',
          locationOrLink: g.centerName || 'السنتر',
          notes: `${g.subject || ''} • سنتر: ${g.centerName || 'بدون سنتر'} • عدد الطلاب: ${studentCount}`,
          createdAt: g.createdAt || new Date(),
          updatedAt: g.updatedAt || new Date(),
          ...({ isGroupSlot: true, groupId: g.id, groupData: g, groupStudentCount: studentCount } as any),
        });
      });
    });
    return slots;
  }, [groups, students, profile.id]);

  // Combined schedules (individual students + active groups)
  // Automatically excludes paused and archived students from timetable slots
  const schedules = useMemo(() => {
    const activeIndividualSlots = (rawSchedules || []).filter((slot) => {
      const st = students.find((s) => s.id === slot.studentId);
      if (!st) return false;
      return !isStudentPaused(st);
    });
    return [...activeIndividualSlots, ...groupSlots];
  }, [rawSchedules, groupSlots, students]);

  const todayIndex = new Date().getDay();

  // Schedule View Mode: Default to Weekly Timetable ('grid') with toggle to 'month', persisting selection
  const [viewMode, setViewModeState] = useState<'grid' | 'month' | 'list'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sanad_schedule_view_mode');
      if (saved === 'grid' || saved === 'month' || saved === 'list') return saved as any;
    }
    return 'grid'; // Default weekly timetable view as requested
  });

  const setViewMode = (mode: 'grid' | 'month' | 'list') => {
    setViewModeState(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('sanad_schedule_view_mode', mode);
    }
  };

  const [selectedDayFilter, setSelectedDayFilter] = useState<number | 'all'>(todayIndex);
  const [selectedClassTypeFilter, setSelectedClassTypeFilter] = useState<'all' | 'online' | 'in_person' | 'trial'>('all');

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<ScheduleSlot | null>(null);
  const [viewingScheduleDetails, setViewingScheduleDetails] = useState<ScheduleSlot | null>(null);
  
  // Group Attendance Modal on clicking group slot
  const [groupAttendanceModal, setGroupAttendanceModal] = useState<{
    group: Group;
    date: string;
  } | null>(null);

  // Quick Evaluation Modal State
  const [showQuickEvalModal, setShowQuickEvalModal] = useState(false);
  const [evalTargetSlot, setEvalTargetSlot] = useState<ScheduleSlot | null>(null);
  const [evalRating, setEvalRating] = useState<number>(5);
  const [evalNotes, setEvalNotes] = useState<string>('');
  const [isSavingEval, setIsSavingEval] = useState(false);
  const [evalNotice, setEvalNotice] = useState<string | null>(null);

  // Register modals on back handler stack
  useBackHandler(showAddModal, () => setShowAddModal(false), 'schedule_add_modal');
  useBackHandler(showQuickEvalModal, () => setShowQuickEvalModal(false), 'schedule_quick_eval_modal');
  useBackHandler(!!viewingScheduleDetails, () => setViewingScheduleDetails(null), 'schedule_details_modal');
  useBackHandler(!!groupAttendanceModal, () => setGroupAttendanceModal(null), 'schedule_group_attendance');

  // Student selection mode: 'existing' vs 'new'
  const [studentSelectionMode, setStudentSelectionMode] = useState<'existing' | 'new'>('existing');
  const [formStudentId, setFormStudentId] = useState('');
  const [formStudentSearch, setFormStudentSearch] = useState('');

  // New Student Quick-Add Fields
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentWhatsapp, setNewStudentWhatsapp] = useState('');
  const [newStudentSubject, setNewStudentSubject] = useState(profile.subject || 'رياضيات');
  const [newStudentHourlyRate, setNewStudentHourlyRate] = useState<number>(100);
  const [newStudentClassType, setNewStudentClassType] = useState<ClassType>('in_person');

  // Multiple slots list for the student
  const [formSlotsList, setFormSlotsList] = useState<FormSlotItem[]>([
    {
      id: 'slot-1',
      dayOfWeek: todayIndex,
      time: '16:00',
      duration: 60,
      classType: 'in_person',
      color: 'emerald',
      recurrence: 'weekly',
      locationOrLink: '',
      notes: '',
    },
  ]);

  // Single editing slot data
  const [editingSlotData, setEditingSlotData] = useState<FormSlotItem>({
    id: 'edit-1',
    dayOfWeek: todayIndex,
    time: '16:00',
    duration: 60,
    classType: 'in_person',
    color: 'emerald',
    recurrence: 'weekly',
    locationOrLink: '',
    notes: '',
  });

  const [conflictError, setConflictError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Notification state
  const [notificationStatus, setNotificationStatus] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );

  // Grid scroll container reference
  const gridScrollRef = useRef<HTMLDivElement>(null);

  // Filter existing students list by search term
  const filteredStudents = useMemo(() => {
    if (!formStudentSearch.trim()) return students;
    const term = formStudentSearch.trim().toLowerCase();
    return students.filter(
      (s) =>
        s.name.toLowerCase().includes(term) ||
        (s.subject && s.subject.toLowerCase().includes(term)) ||
        (s.whatsapp && s.whatsapp.includes(term))
    );
  }, [students, formStudentSearch]);

  // Auto-scroll grid to ~08:00 AM on initial load
  useEffect(() => {
    if (viewMode === 'grid' && gridScrollRef.current) {
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

  const handleOpenQuickEval = (slot: ScheduleSlot, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEvalTargetSlot(slot);
    setEvalRating(slot.rating || 5);
    setEvalNotes(slot.notes || '');
    setEvalNotice(null);
    setShowQuickEvalModal(true);
  };

  const handleSaveQuickEval = async () => {
    if (!evalTargetSlot) return;
    setIsSavingEval(true);
    setEvalNotice(null);
    try {
      await saveScheduleEvaluation(profile.id, evalTargetSlot.id, evalRating, evalNotes);
      setEvalNotice('تم حفظ التقييم السريع للحصة بنجاح! ⭐');
      setTimeout(() => {
        setShowQuickEvalModal(false);
        setEvalNotice(null);
      }, 900);
    } catch (err) {
      console.error('Error saving quick evaluation:', err);
      setEvalNotice('حدث خطأ أثناء حفظ التقييم.');
    } finally {
      setIsSavingEval(false);
    }
  };

  // Open Add modal with defaults
  const handleOpenAddDefault = () => {
    setConflictError(null);
    setEditingSchedule(null);
    setViewingScheduleDetails(null);
    setFormStudentSearch('');
    if (students.length > 0) {
      setStudentSelectionMode('existing');
      setFormStudentId(students[0].id);
    } else {
      setStudentSelectionMode('new');
      setFormStudentId('');
    }
    setNewStudentName('');
    setNewStudentWhatsapp('');
    setNewStudentSubject(profile.subject || 'رياضيات');
    setNewStudentHourlyRate(100);
    setNewStudentClassType('in_person');
    setFormSlotsList([
      {
        id: Math.random().toString(),
        dayOfWeek: todayIndex,
        time: '16:00',
        duration: 60,
        classType: 'in_person',
        color: 'emerald',
        recurrence: 'weekly',
        locationOrLink: '',
        notes: '',
      },
    ]);
    setShowAddModal(true);
  };

  // Open Add modal from an empty cell or clicked day/time
  const handleCellClick = (dayIndex: number, time24: string) => {
    setConflictError(null);
    setEditingSchedule(null);
    setViewingScheduleDetails(null);
    setFormStudentSearch('');
    if (students.length > 0) {
      setStudentSelectionMode('existing');
      setFormStudentId(students[0].id);
    } else {
      setStudentSelectionMode('new');
      setFormStudentId('');
    }
    setNewStudentName('');
    setNewStudentWhatsapp('');
    setNewStudentSubject(profile.subject || 'رياضيات');
    setNewStudentHourlyRate(100);
    setNewStudentClassType('in_person');
    setFormSlotsList([
      {
        id: Math.random().toString(),
        dayOfWeek: dayIndex,
        time: time24 || '16:00',
        duration: 60,
        classType: 'in_person',
        color: 'emerald',
        recurrence: 'weekly',
        locationOrLink: '',
        notes: '',
      },
    ]);
    setShowAddModal(true);
  };

  // Add another time slot for the student
  const handleAddAnotherSlot = () => {
    const last = formSlotsList[formSlotsList.length - 1];
    const nextDay = last ? (last.dayOfWeek + 2) % 7 : 0;
    const newSlot: FormSlotItem = {
      id: Math.random().toString(),
      dayOfWeek: nextDay,
      time: last ? last.time : '17:00',
      duration: last ? last.duration : 60,
      classType: last ? last.classType : 'in_person',
      color: last ? last.color : 'emerald',
      recurrence: 'weekly',
      locationOrLink: last ? last.locationOrLink : '',
      notes: '',
    };
    setFormSlotsList([...formSlotsList, newSlot]);
  };

  // Apply Common Multi-Day Quick Preset
  const handleApplyPreset = (days: number[], defaultTime = '16:00', duration = 60, type: ClassType = 'in_person') => {
    const newSlots: FormSlotItem[] = days.map((dayIdx) => ({
      id: Math.random().toString(),
      dayOfWeek: dayIdx,
      time: defaultTime,
      duration: duration,
      classType: type,
      color: getClassTypeMeta(type).colorId,
      recurrence: 'weekly',
      locationOrLink: '',
      notes: '',
    }));
    setFormSlotsList(newSlots);
  };

  // Remove a slot from the list
  const handleRemoveSlot = (slotId: string) => {
    if (formSlotsList.length > 1) {
      setFormSlotsList(formSlotsList.filter((s) => s.id !== slotId));
    }
  };

  // Update a specific slot item
  const handleUpdateSlotItem = (slotId: string, updates: Partial<FormSlotItem>) => {
    setConflictError(null);
    setFormSlotsList((prev) =>
      prev.map((s) => {
        if (s.id === slotId) {
          const updated = { ...s, ...updates };
          if (updates.classType) {
            updated.color = getClassTypeMeta(updates.classType).colorId;
          }
          return updated;
        }
        return s;
      })
    );
  };

  // Open Edit modal from slot
  const handleOpenEdit = (slot: ScheduleSlot) => {
    setConflictError(null);
    setViewingScheduleDetails(null);
    setEditingSchedule(slot);
    setFormStudentId(slot.studentId);
    setEditingSlotData({
      id: slot.id,
      dayOfWeek: slot.dayOfWeek,
      time: slot.time,
      duration: slot.duration || 60,
      recurrence: slot.recurrence || 'weekly',
      classType: slot.classType || 'in_person',
      color: slot.color || getClassTypeMeta(slot.classType).colorId,
      locationOrLink: slot.locationOrLink || '',
      notes: slot.notes || '',
    });
    setShowAddModal(true);
  };

  // Open Details Modal on booked class click, or Record Attendance for group slot
  const handleSlotClick = (slot: ScheduleSlot, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if ((slot as any).isGroupSlot) {
      const g = (slot as any).groupData || groups.find((grp) => grp.id === (slot as any).groupId);
      if (g) {
        const today = new Date();
        const currentDay = today.getDay();
        const diff = slot.dayOfWeek - currentDay;
        const slotDate = new Date(today);
        slotDate.setDate(today.getDate() + diff);
        const targetDateStr = new Intl.DateTimeFormat('en-CA').format(slotDate);

        setGroupAttendanceModal({
          group: g,
          date: targetDateStr,
        });
        return;
      }
    }
    setViewingScheduleDetails(slot);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setConflictError(null);

    try {
      if (editingSchedule) {
        // Conflict check for editing against all other schedules
        const conflictRes = hasConflict(
          {
            id: editingSchedule.id,
            dayOfWeek: Number(editingSlotData.dayOfWeek),
            time: editingSlotData.time,
            duration: Number(editingSlotData.duration) || 60,
            studentName: editingSchedule.studentName,
          },
          schedules,
          editingSchedule.id
        );

        if (conflictRes.hasConflict) {
          setConflictError(conflictRes.message || 'عفواً، لديك حصة أو مجموعة أخرى في نفس هذا الموعد');
          return;
        }

        setIsSubmitting(true);
        await updateSchedule(profile.id, editingSchedule.id, {
          dayOfWeek: Number(editingSlotData.dayOfWeek),
          time: editingSlotData.time,
          duration: Number(editingSlotData.duration) || 60,
          recurrence: editingSlotData.recurrence,
          classType: editingSlotData.classType,
          color: editingSlotData.color,
          locationOrLink: editingSlotData.locationOrLink?.trim() || '',
          notes: editingSlotData.notes?.trim() || '',
        });
      } else {
        // Multi-slot addition or direct student add
        let targetStudentId = formStudentId;
        let targetStudentName = '';

        if (studentSelectionMode === 'new') {
          if (!newStudentName.trim()) {
            setConflictError('يرجى كتابة اسم الطالب الجديد.');
            return;
          }
          targetStudentName = newStudentName.trim();
          const rate = Number(newStudentHourlyRate) || 100;
          const createdId = await addStudent(profile.id, {
            name: targetStudentName,
            whatsapp: newStudentWhatsapp.trim() || '',
            subject: newStudentSubject.trim() || profile.subject || 'رياضيات',
            classType: newStudentClassType,
            hourlyRate: rate,
            monthlyFee: rate * 4,
            paymentStatus: 'unpaid',
            color: formSlotsList[0]?.color || 'emerald',
            notes: '',
          });
          if (!createdId) throw new Error('فشل إنشاء الطالب في السجل');
          targetStudentId = createdId;
        } else {
          const found = students.find((s) => s.id === formStudentId);
          if (!found) {
            setConflictError('يرجى اختيار الطالب من القائمة.');
            return;
          }
          targetStudentName = found.name;
        }

        if (formSlotsList.length === 0) {
          setConflictError('يرجى إضافة موعد واحد على الأقل.');
          return;
        }

        // 1. Internal conflict check among draft slots in formSlotsList
        for (let i = 0; i < formSlotsList.length; i++) {
          const a = formSlotsList[i];
          const aStart = getMinutesFromTime(a.time);
          const aEnd = aStart + (Number(a.duration) || 60);

          for (let j = i + 1; j < formSlotsList.length; j++) {
            const b = formSlotsList[j];
            if (Number(a.dayOfWeek) === Number(b.dayOfWeek)) {
              const bStart = getMinutesFromTime(b.time);
              const bEnd = bStart + (Number(b.duration) || 60);
              if (aStart < bEnd && aEnd > bStart) {
                const dayName = WEEK_DAYS.find((d) => d.dayIndex === a.dayOfWeek)?.name;
                setConflictError(
                  `يوجد تداخل بين الموعدين رقم (${i + 1}) ورقم (${j + 1}) في نفس يوم ${dayName}!`
                );
                return;
              }
            }
          }
        }

        // 2. Conflict check against existing schedules in Firestore
        for (let i = 0; i < formSlotsList.length; i++) {
          const slot = formSlotsList[i];
          const conflictRes = hasConflict(
            {
              dayOfWeek: Number(slot.dayOfWeek),
              time: slot.time,
              duration: Number(slot.duration) || 60,
              studentName: targetStudentName,
            },
            schedules
          );

          if (conflictRes.hasConflict) {
            setConflictError(
              conflictRes.message || 'عفواً، لديك حصة أو مجموعة أخرى في نفس هذا الموعد'
            );
            return;
          }
        }

        setIsSubmitting(true);
        // Save each slot as an independent document in Firestore (One-to-Many student-to-slots relationship)
        for (const slot of formSlotsList) {
          await addSchedule(profile.id, {
            studentId: targetStudentId,
            studentName: targetStudentName,
            dayOfWeek: Number(slot.dayOfWeek),
            time: slot.time,
            duration: Number(slot.duration) || 60,
            recurrence: slot.recurrence || 'weekly',
            classType: slot.classType || 'in_person',
            color: slot.color || getClassTypeMeta(slot.classType).colorId,
            locationOrLink: slot.locationOrLink?.trim() || '',
            notes: slot.notes?.trim() || '',
          });
        }
      }

      setShowAddModal(false);
      setViewingScheduleDetails(null);
    } catch (err: any) {
      console.error('Error saving schedule', err);
      setConflictError(err?.message || 'حدث خطأ أثناء حفظ المواعيد. يرجى المحاولة مرة أخرى.');
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

  const getClassTypeBadge = (type?: ClassType) => {
    switch (type) {
      case 'online':
        return (
          <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-sky-950/90 border border-sky-500/40 text-sky-300 font-bold shadow-sm">
            <Video className="w-2.5 h-2.5 text-sky-400" />
            <span>أونلاين 🌐</span>
          </span>
        );
      case 'trial':
        return (
          <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-amber-950/90 border border-amber-500/50 text-amber-300 font-bold shadow-sm ring-1 ring-amber-400/30">
            <Sparkles className="w-2.5 h-2.5 text-amber-400" />
            <span>حصة تجريبية ✨</span>
          </span>
        );
      case 'in_person':
      case 'private':
      case 'center':
      default:
        return (
          <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-950/90 border border-emerald-500/40 text-emerald-300 font-bold shadow-sm">
            <UserCheck className="w-2.5 h-2.5 text-emerald-400" />
            <span>{type === 'center' ? 'سنتر 🏫' : 'حضور شخصي 👤'}</span>
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

  // Format end time from start and duration
  const getEndTimeFormatted = (start: string, durationMin: number) => {
    const total = getMinutesFromTime(start) + durationMin;
    const endH = Math.floor(total / 60) % 24;
    const endM = total % 60;
    const period = endH < 12 ? 'صباحاً' : 'مساءً';
    const displayH = endH === 0 ? 12 : endH > 12 ? endH - 12 : endH;
    return `${displayH}:${endM.toString().padStart(2, '0')} ${period}`;
  };

  // Today's evaluated slots & Next upcoming lesson countdown
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const todayStr = new Intl.DateTimeFormat('en-CA').format(now);

  const todayScheduleSlots = schedules
    .filter((s) => s.dayOfWeek === todayIndex)
    .sort((a, b) => a.time.localeCompare(b.time));

  const evaluatedTodaySchedule = todayScheduleSlots.map((item) => {
    let startMin = 0;
    let endMin = 0;
    if (item.time && item.time.includes(':')) {
      const [h, m] = item.time.split(':').map(Number);
      startMin = h * 60 + m;
      endMin = startMin + (item.duration || 60);
    }
    const isExplicitlyCompleted = item.completedTodayDate === todayStr;
    const isPastTime = nowMinutes >= endMin;
    const isCompleted = isExplicitlyCompleted || isPastTime;
    const isOngoing = nowMinutes >= startMin && nowMinutes < endMin && !isExplicitlyCompleted;
    const isUpcoming = startMin > nowMinutes && !isExplicitlyCompleted;
    const diffToStart = startMin - nowMinutes;

    return {
      slot: item,
      startMin,
      endMin,
      isCompleted,
      isOngoing,
      isUpcoming,
      diffToStart,
    };
  });

  const nextUpcomingOrOngoing = evaluatedTodaySchedule.find((c) => c.isOngoing || c.isUpcoming);

  // Filter schedules by class type
  const isSlotMatchingTypeFilter = (slot: ScheduleSlot, filter: string) => {
    if (filter === 'all') return true;
    if (filter === 'online') return slot.classType === 'online';
    if (filter === 'trial') return slot.classType === 'trial';
    if (filter === 'in_person') {
      return (
        slot.classType === 'in_person' ||
        slot.classType === 'private' ||
        slot.classType === 'center' ||
        !slot.classType
      );
    }
    return true;
  };

  const onlineSlotsCount = schedules.filter((s) => s.classType === 'online').length;
  const inPersonSlotsCount = schedules.filter(
    (s) => s.classType === 'in_person' || s.classType === 'private' || s.classType === 'center' || !slotIsNonInPerson(s)
  ).length;
  function slotIsNonInPerson(s: ScheduleSlot) {
    return s.classType === 'online' || s.classType === 'trial';
  }
  const trialSlotsCount = schedules.filter((s) => s.classType === 'trial').length;

  const filteredListSchedules = schedules.filter((s) => {
    const matchesDay = selectedDayFilter === 'all' || s.dayOfWeek === selectedDayFilter;
    const matchesType = isSlotMatchingTypeFilter(s, selectedClassTypeFilter);
    return matchesDay && matchesType;
  });

  return (
    <div className="space-y-3.5 pb-20 select-none">
      {/* Top Header & Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span>الجدول الزمني والمواعيد</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-purple-950 text-purple-300 border border-purple-500/30 font-mono">
              {schedules.length} حصة
            </span>
          </h2>
          <p className="text-[11px] text-slate-400">إدارة مواعيد وحصص الطلاب الأسبوعية بتنظيم متكامل</p>
        </div>

        {/* View Mode Toggle & Add Button */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setIsTimeShiftOpen(true)}
            className="p-1.5 rounded-lg bg-amber-950/50 text-amber-400 hover:bg-amber-950 transition cursor-pointer border border-amber-900/50"
            title="تعديل التوقيت الصيفي/الشتوي"
          >
            <Clock className="w-4 h-4" />
          </button>
          <div className="flex rounded-xl bg-slate-900 border border-slate-700/80 p-0.5">
            <button
              onClick={() => setViewMode('grid')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-purple-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="الجدول الأسبوعي (الافتراضي)"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>الجدول الأسبوعي</span>
            </button>
            <button
              onClick={() => setViewMode('month')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                viewMode === 'month'
                  ? 'bg-purple-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="التقويم الشهري (Calendar View)"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>التقويم الشهري</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-2 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-purple-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="عرض القائمة"
            >
              <List className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">القائمة</span>
            </button>
          </div>
          <button
            onClick={handleOpenAddDefault}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:brightness-110 text-white text-xs font-bold shadow-lg shadow-purple-950/50 active:scale-95 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة موعد</span>
          </button>
          <button
            onClick={() => exportScheduleToPdf(profile, schedules, students)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition cursor-pointer border border-slate-700"
            title="تصدير جدول الحصص PDF"
          >
            <Printer className="w-4 h-4" />
            <span>تصدير المواعيد</span>
          </button>
        </div>
      </div>

      {/* Time Shift Modal */}
      <TimeShiftModal 
          isOpen={isTimeShiftOpen}
          onClose={() => setIsTimeShiftOpen(false)}
          teacherId={profile.id}
          schedules={schedules}
          students={students}
          groups={groups}
      />
      
      {/* Smart Upcoming Lesson Countdown Banner */}
      {(() => {
        let badgeText = 'جدول اليوم';
        let mainTitle = 'لا توجد حصص متبقية اليوم 🌟';
        let mainSubtitle =
          todayScheduleSlots.length > 0
            ? 'اكتملت جميع حصص اليوم بنجاح، أحسنت عملاً!'
            : 'لا توجد حصص مجدولة لليوم في الجدول الأسبوعي.';

        if (nextUpcomingOrOngoing) {
          if (nextUpcomingOrOngoing.isOngoing) {
            badgeText = 'حصة جارية الآن 🔴';
            mainTitle = `الحصة الجارية: ${nextUpcomingOrOngoing.slot.studentName}`;
            mainSubtitle = `بدأت الساعة ${nextUpcomingOrOngoing.slot.time} (متبقي ${
              nextUpcomingOrOngoing.endMin - nowMinutes
            } دقيقة)`;
          } else {
            const diffM = nextUpcomingOrOngoing.diffToStart;
            const timeStr =
              diffM >= 60 ? `${Math.floor(diffM / 60)} ساعة و ${diffM % 60} دقيقة` : `${diffM} دقيقة`;
            badgeText = `خلال ${timeStr} ⏰`;
            mainTitle = `الحصة القادمة: ${nextUpcomingOrOngoing.slot.studentName} - خلال ${timeStr}`;
            mainSubtitle = `الساعة ${nextUpcomingOrOngoing.slot.time} • مدة الحصة: ${
              nextUpcomingOrOngoing.slot.duration || 60
            } دقيقة`;
          }
        }

        return (
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-purple-800 via-indigo-800 to-purple-900 p-4 shadow-xl border border-purple-400/30 text-right">
            <div className="relative z-10 flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <span className="inline-block px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider rounded-full bg-amber-400 text-slate-950 mb-1.5 shadow">
                  {badgeText}
                </span>
                <h3 className="text-sm font-extrabold text-white truncate">{mainTitle}</h3>
                <p className="text-xs text-purple-200 mt-0.5 leading-relaxed">{mainSubtitle}</p>
              </div>
              {nextUpcomingOrOngoing && (
                <button
                  onClick={() => setViewingScheduleDetails(nextUpcomingOrOngoing.slot)}
                  className="flex-shrink-0 flex items-center gap-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 px-3.5 py-2.5 text-xs font-black shadow-lg shadow-amber-950/40 active:scale-95 transition cursor-pointer"
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>عرض الموعد</span>
                </button>
              )}
            </div>
            <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full bg-purple-500/20 blur-xl pointer-events-none" />
          </div>
        );
      })()}

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
          {/* Class Types Legend & Filter Banner */}
          <div className="rounded-2xl bg-slate-900/90 border border-purple-500/25 p-3 flex flex-wrap items-center justify-between gap-2.5 text-[11px] shadow-md">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-slate-400 font-bold ml-1">تصنيف الحصص بالألوان:</span>
              <button
                type="button"
                onClick={() => setSelectedClassTypeFilter('all')}
                className={`px-2.5 py-1 rounded-xl font-bold transition cursor-pointer flex items-center gap-1 text-[11px] ${
                  selectedClassTypeFilter === 'all'
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'bg-slate-800/80 text-slate-400 hover:text-white border border-slate-700/60'
                }`}
              >
                <span>الكل</span>
                <span className="text-[10px] opacity-80">({schedules.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedClassTypeFilter(selectedClassTypeFilter === 'online' ? 'all' : 'online')}
                className={`px-2.5 py-1 rounded-xl font-bold transition cursor-pointer flex items-center gap-1 text-[11px] border ${
                  selectedClassTypeFilter === 'online'
                    ? 'bg-sky-500/30 border-sky-400 text-sky-200 ring-2 ring-sky-400/40 shadow-md'
                    : 'bg-sky-950/60 border-sky-500/40 text-sky-300 hover:bg-sky-900/60'
                }`}
                title="تصفية حصص الأونلاين"
              >
                <Video className="w-3 h-3 text-sky-400" />
                <span>أونلاين 🌐</span>
                <span className="text-[10px] bg-sky-900/80 px-1.5 py-0.2 rounded-full font-mono font-bold">
                  {onlineSlotsCount}
                </span>
              </button>

              <button
                type="button"
                onClick={() =>
                  setSelectedClassTypeFilter(selectedClassTypeFilter === 'in_person' ? 'all' : 'in_person')
                }
                className={`px-2.5 py-1 rounded-xl font-bold transition cursor-pointer flex items-center gap-1 text-[11px] border ${
                  selectedClassTypeFilter === 'in_person'
                    ? 'bg-emerald-500/30 border-emerald-400 text-emerald-200 ring-2 ring-emerald-400/40 shadow-md'
                    : 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/60'
                }`}
                title="تصفية حصص الحضور الشخصي"
              >
                <UserCheck className="w-3 h-3 text-emerald-400" />
                <span>حضور شخصي 👤</span>
                <span className="text-[10px] bg-emerald-900/80 px-1.5 py-0.2 rounded-full font-mono font-bold">
                  {inPersonSlotsCount}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedClassTypeFilter(selectedClassTypeFilter === 'trial' ? 'all' : 'trial')}
                className={`px-2.5 py-1 rounded-xl font-bold transition cursor-pointer flex items-center gap-1 text-[11px] border ${
                  selectedClassTypeFilter === 'trial'
                    ? 'bg-amber-500/30 border-amber-400 text-amber-200 ring-2 ring-amber-400/40 shadow-md'
                    : 'bg-amber-950/60 border-amber-500/40 text-amber-300 hover:bg-amber-900/60 ring-1 ring-amber-400/30'
                }`}
                title="تصفية الحصص التجريبية"
              >
                <Sparkles className="w-3 h-3 text-amber-400" />
                <span>حصة تجريبية ✨</span>
                <span className="text-[10px] bg-amber-900/80 px-1.5 py-0.2 rounded-full font-mono font-bold">
                  {trialSlotsCount}
                </span>
              </button>
            </div>

            {/* Quick Scroll Anchors */}
            <div className="flex items-center gap-1 text-[10px] text-slate-400 mr-auto">
              <span className="hidden sm:inline">انتقال سريع:</span>
              <button
                type="button"
                onClick={() => scrollToHour(8)}
                className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-purple-300 hover:text-white transition cursor-pointer border border-slate-700/60"
              >
                08:00 ص
              </button>
              <button
                type="button"
                onClick={() => scrollToHour(14)}
                className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-purple-300 hover:text-white transition cursor-pointer border border-slate-700/60"
              >
                02:00 م
              </button>
              <button
                type="button"
                onClick={() => scrollToHour(18)}
                className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-purple-300 hover:text-white transition cursor-pointer border border-slate-700/60"
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
          <div
            ref={gridScrollRef}
            className="overflow-x-auto overflow-y-auto max-h-[68vh] relative scroll-smooth"
            style={{ direction: 'rtl' }}
          >
            <div className="min-w-[780px] relative">
              {/* Sticky Days Header Row */}
              <div className="sticky top-0 z-30 flex bg-slate-950/95 backdrop-blur-md border-b border-purple-900/40">
                <div className="w-16 flex-shrink-0 p-2.5 text-center text-[10px] font-bold text-slate-400 border-l border-slate-800 sticky right-0 z-40 bg-slate-950 shadow-md">
                  الوقت
                </div>

                {WEEK_DAYS.map((day) => {
                  const isToday = day.dayIndex === todayIndex;
                  const daySchedules = schedules.filter((s) => s.dayOfWeek === day.dayIndex);
                  const matchingCount = daySchedules.filter((s) =>
                    isSlotMatchingTypeFilter(s, selectedClassTypeFilter)
                  ).length;

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
                        {isToday && <span className="w-1.5 h-1.5 rounded-full bg-amber-400" title="اليوم" />}
                      </div>
                      <span className="text-[10px] text-slate-400">
                        {matchingCount > 0 ? `${matchingCount} حصص` : 'فارغ'}
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
                          isHourMark ? 'text-slate-300 font-bold bg-slate-950' : 'text-slate-500 bg-slate-950/80'
                        }`}
                      >
                        <span>{slot.label}</span>
                      </div>
                    );
                  })}
                </div>

                {/* 7 Days Columns */}
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

                      {/* Rendered Booked Classes */}
                      {daySchedules.map((slot) => {
                        const isMatchesFilter = isSlotMatchingTypeFilter(slot, selectedClassTypeFilter);
                        const startMin = getMinutesFromTime(slot.time);
                        const endMin = startMin + (slot.duration || 60);
                        const topPx = (startMin / 30) * ROW_HEIGHT;
                        const heightPx = Math.max(32, (slot.duration / 30) * ROW_HEIGHT - 3);
                        const colorInfo = getSlotColorStyle(slot);
                        const isSlotCompleted =
                          isToday && (slot.completedTodayDate === todayStr || nowMinutes >= endMin);

                        if (!isMatchesFilter) {
                          return null;
                        }

                        return (
                          <div
                            key={slot.id}
                            onClick={(e) => handleSlotClick(slot, e)}
                            style={{
                              top: `${topPx}px`,
                              height: `${heightPx}px`,
                              backgroundColor: isSlotCompleted ? 'rgba(6, 78, 59, 0.45)' : colorInfo.bg,
                              borderColor: isSlotCompleted ? 'rgba(16, 185, 129, 0.5)' : colorInfo.border,
                              color: isSlotCompleted ? '#d1fae5' : colorInfo.text,
                            }}
                            className={`absolute right-0.5 left-0.5 rounded-xl border p-1.5 overflow-hidden transition hover:scale-[1.02] hover:z-20 cursor-pointer shadow-md flex flex-col justify-between ${
                              isSlotCompleted ? 'opacity-80' : ''
                            }`}
                          >
                            <div>
                              <div className="flex items-center justify-between gap-1 leading-tight">
                                <span
                                  className={`font-bold text-xs truncate drop-shadow-sm ${
                                    isSlotCompleted ? 'line-through text-slate-200 decoration-emerald-400' : ''
                                  }`}
                                >
                                  {isSlotCompleted ? `✓ ${slot.studentName}` : slot.studentName}
                                </span>

                                {slot.classType === 'online' && (
                                  <span title="أونلاين 🌐">
                                    <Video className="w-2.5 h-2.5 flex-shrink-0 text-sky-300" />
                                  </span>
                                )}
                                {slot.classType === 'trial' && (
                                  <span title="حصة تجريبية ✨">
                                    <Sparkles className="w-2.5 h-2.5 flex-shrink-0 text-amber-300" />
                                  </span>
                                )}
                                {(slot.classType === 'in_person' ||
                                  slot.classType === 'private' ||
                                  slot.classType === 'center' ||
                                  !slot.classType) && (
                                  <span title="حضور شخصي 👤">
                                    <UserCheck className="w-2.5 h-2.5 flex-shrink-0 text-emerald-300" />
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] opacity-90 font-mono block mt-0.5">
                                {slot.time} ({slot.duration}د)
                              </span>
                            </div>

                            {heightPx > 45 && (
                              <div className="flex items-center justify-between text-[9px] opacity-90 font-medium">
                                <span className="truncate">
                                  {slot.classType === 'trial'
                                    ? '⭐ تجريبية'
                                    : slot.locationOrLink || (slot.classType === 'online' ? '🌐 أونلاين' : '👤 شخصي')}
                                </span>
                                {isSlotCompleted && <span className="text-emerald-300 font-bold">تمت ✅</span>}
                              </div>
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

      {/* VIEW 1.5: MONTHLY CALENDAR VIEW */}
      {viewMode === 'month' && (
        <CalendarView
          schedules={schedules}
          students={students}
          profile={profile}
          onAddSchedule={(dayOfWeek, time) => handleCellClick(dayOfWeek, time || '16:00')}
          onEditSchedule={handleOpenEdit}
          onDeleteSchedule={handleDelete}
          onViewDetails={(slot) => handleSlotClick(slot)}
          onOpenQuickEval={handleOpenQuickEval}
        />
      )}

      {/* VIEW 2: LIST VIEW (Filtered by day and class type) */}
      {viewMode === 'list' && (
        <div className="space-y-3">
          {/* Class Types Filter for List View */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            <button
              type="button"
              onClick={() => setSelectedClassTypeFilter('all')}
              className={`px-3 py-1 rounded-xl font-bold transition whitespace-nowrap cursor-pointer ${
                selectedClassTypeFilter === 'all'
                  ? 'bg-purple-600 text-white shadow'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              كافة الأنواع ({schedules.length})
            </button>
            <button
              type="button"
              onClick={() => setSelectedClassTypeFilter('online')}
              className={`px-2.5 py-1 rounded-xl font-bold transition whitespace-nowrap cursor-pointer border flex items-center gap-1 ${
                selectedClassTypeFilter === 'online'
                  ? 'bg-sky-500/30 border-sky-400 text-sky-200'
                  : 'bg-slate-900 border-slate-800 text-sky-300 hover:text-white'
              }`}
            >
              <Video className="w-3 h-3 text-sky-400" />
              <span>أونلاين ({onlineSlotsCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedClassTypeFilter('in_person')}
              className={`px-2.5 py-1 rounded-xl font-bold transition whitespace-nowrap cursor-pointer border flex items-center gap-1 ${
                selectedClassTypeFilter === 'in_person'
                  ? 'bg-emerald-500/30 border-emerald-400 text-emerald-200'
                  : 'bg-slate-900 border-slate-800 text-emerald-300 hover:text-white'
              }`}
            >
              <UserCheck className="w-3 h-3 text-emerald-400" />
              <span>حضور شخصي ({inPersonSlotsCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedClassTypeFilter('trial')}
              className={`px-2.5 py-1 rounded-xl font-bold transition whitespace-nowrap cursor-pointer border flex items-center gap-1 ${
                selectedClassTypeFilter === 'trial'
                  ? 'bg-amber-500/30 border-amber-400 text-amber-200'
                  : 'bg-slate-900 border-slate-800 text-amber-300 hover:text-white'
              }`}
            >
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span>حصة تجريبية ({trialSlotsCount})</span>
            </button>
          </div>

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
              كافة الأيام
            </button>

            {WEEK_DAYS.map((day) => {
              const count = schedules.filter(
                (s) => s.dayOfWeek === day.dayIndex && isSlotMatchingTypeFilter(s, selectedClassTypeFilter)
              ).length;
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
                  {isToday && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 absolute top-1 left-1" />}
                </button>
              );
            })}
          </div>

          {/* List items */}
          {filteredListSchedules.length === 0 ? (
            <div className="rounded-2xl bg-slate-900/50 border border-slate-800 p-8 text-center">
              <Calendar className="w-10 h-10 mx-auto text-purple-400/60 mb-2" />
              <p className="text-sm font-bold text-slate-200">
                {selectedDayFilter === 'all'
                  ? 'لا توجد مواعيد مسجلة تطابق الفلتر'
                  : 'لا توجد حصص في هذا اليوم تطابق الفلتر'}
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
                const colorInfo = getSlotColorStyle(slot);
                const dayObj = WEEK_DAYS.find((d) => d.dayIndex === slot.dayOfWeek);
                const isTodaySlot = slot.dayOfWeek === todayIndex;
                const [slotH, slotM] = slot.time.split(':').map(Number);
                const startMin = (slotH || 0) * 60 + (slotM || 0);
                const endMin = startMin + (slot.duration || 60);
                const isExplicitlyCompleted = slot.completedTodayDate === todayStr;
                const isPastTime = isTodaySlot && nowMinutes >= endMin;
                const isCompleted = isExplicitlyCompleted || isPastTime;

                return (
                  <div
                    key={slot.id}
                    onClick={() => handleSlotClick(slot)}
                    style={{ borderColor: isCompleted ? 'rgba(16, 185, 129, 0.4)' : colorInfo.border }}
                    className={`rounded-2xl border p-3.5 flex items-center justify-between transition cursor-pointer shadow-md ${
                      isCompleted
                        ? 'bg-slate-900/60 opacity-80 border-emerald-500/40'
                        : 'bg-slate-900/90 hover:border-purple-400'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        style={{
                          backgroundColor: isCompleted ? 'rgba(6, 78, 59, 0.5)' : colorInfo.bg,
                          borderColor: isCompleted ? 'rgba(16, 185, 129, 0.4)' : colorInfo.border,
                        }}
                        className="w-12 h-12 rounded-2xl border flex flex-col items-center justify-center font-bold"
                      >
                        <span
                          className="font-mono text-xs"
                          style={{ color: isCompleted ? '#34d399' : colorInfo.text }}
                        >
                          {isCompleted ? '✓' : formatTime12hShort(slot.time)}
                        </span>
                        <span className="text-[9px] text-slate-400">{slot.duration}د</span>
                      </div>

                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3
                            className={`text-sm font-bold ${
                              isCompleted ? 'line-through text-slate-300 decoration-emerald-400' : 'text-white'
                            }`}
                          >
                            {slot.studentName}
                          </h3>
                          {getClassTypeBadge(slot.classType)}

                          {slot.isMakeup && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-950/90 text-indigo-300 border border-indigo-500/40 font-bold flex items-center gap-1 shadow-sm">
                              <span>🔄 حصة تعويضية</span>
                            </span>
                          )}

                          {isCompleted && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950/90 text-emerald-300 border border-emerald-500/40 font-bold flex items-center gap-1 shadow-sm">
                              <Check className="w-3 h-3 text-emerald-400 stroke-[3]" />
                              <span>تمت الحصة ✅</span>
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {dayObj?.name} •{' '}
                          <span className="text-purple-300">{getRecurrenceArabic(slot.recurrence)}</span>
                          {slot.locationOrLink && ` • ${slot.locationOrLink}`}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      {/* Quick Evaluation Button */}
                      <button
                        type="button"
                        onClick={(e) => handleOpenQuickEval(slot, e)}
                        className={`p-1.5 rounded-lg border transition cursor-pointer flex items-center gap-1 ${
                          slot.rating
                            ? 'bg-amber-950/80 border-amber-500/50 text-amber-300'
                            : 'bg-slate-800/60 border-slate-700 text-amber-400 hover:bg-slate-800'
                        }`}
                        title="تقييم سريع للحصة"
                      >
                        <Star
                          className={`w-3.5 h-3.5 ${
                            slot.rating ? 'fill-amber-400 text-amber-400' : 'text-amber-400'
                          }`}
                        />
                        {slot.rating && <span className="text-[10px] font-bold">{slot.rating}/5</span>}
                      </button>

                      {/* Toggle Attendance / Completed */}
                      {isTodaySlot && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleScheduleCompletedToday(profile.id, slot.id, !slot.completedTodayDate);
                          }}
                          className={`p-1.5 rounded-lg border transition cursor-pointer ${
                            slot.completedTodayDate
                              ? 'bg-emerald-900/40 border-emerald-500/40 text-emerald-300 hover:bg-emerald-800/40'
                              : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-emerald-300 hover:bg-slate-800'
                          }`}
                          title={slot.completedTodayDate ? 'إلغاء وسم تمت الحصة' : 'تسجيل حضور / تمت الحصة'}
                        >
                          <CheckCircle className={`w-3.5 h-3.5 ${slot.completedTodayDate ? 'text-emerald-400' : ''}`} />
                        </button>
                      )}

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

      {/* GROUP ATTENDANCE MODAL (Directly opened on clicking group slot) */}
      {groupAttendanceModal && (
        <DailyAttendanceModal
          isOpen={true}
          onClose={() => setGroupAttendanceModal(null)}
          profile={profile}
          students={students}
          schedules={schedules}
          targetGroupId={groupAttendanceModal.group.id}
          targetGroupName={groupAttendanceModal.group.name}
          targetDate={groupAttendanceModal.date}
        />
      )}

      {/* MODAL 1: VIEW DETAILS OF A BOOKED CLASS */}
      {viewingScheduleDetails && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-slate-900 border border-purple-500/40 rounded-3xl p-5 shadow-2xl text-right space-y-4 animate-fadeIn">
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
                className="p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Info Body */}
            <div className="space-y-2.5 text-xs text-slate-200">
              <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">الطالب / المجموعة:</span>
                  <span className="text-sm font-bold text-white">{viewingScheduleDetails.studentName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">نوع الحصة:</span>
                  <div className="flex items-center gap-1.5">
                    {getClassTypeBadge(viewingScheduleDetails.classType)}
                    {viewingScheduleDetails.isMakeup && (
                      <span className="px-2 py-0.5 rounded-full bg-indigo-950 border border-indigo-500/40 text-indigo-300 font-bold text-[10px]">
                        🔄 تعويضية
                      </span>
                    )}
                  </div>
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
                    {formatTime12h(viewingScheduleDetails.time)} إلى{' '}
                    {getEndTimeFormatted(viewingScheduleDetails.time, viewingScheduleDetails.duration)} (
                    {viewingScheduleDetails.duration} دقيقة)
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
                {viewingScheduleDetails.notes && (
                  <div className="pt-1 border-t border-slate-800">
                    <span className="text-slate-400 block mb-0.5">ملاحظات الحصة:</span>
                    <p className="text-slate-300 leading-relaxed">{viewingScheduleDetails.notes}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2 pt-1">
              {(() => {
                const student = students.find((s) => s.id === viewingScheduleDetails.studentId);
                const phone = student?.whatsapp || '';
                const dayName = WEEK_DAYS.find((d) => d.dayIndex === viewingScheduleDetails.dayOfWeek)?.name || '';
                const msg = `مرحباً بك يا ${viewingScheduleDetails.studentName}،\nنذكرك بموعد حصتنا القادمة:\n📚 المادة: ${profile.subject || 'دراسات'}\n📅 اليوم: ${dayName}\n⏰ التوقيت: ${formatTime12h(viewingScheduleDetails.time)}\n\nنتطلع لحضورك المتميز!`;
                const cleanPhone = phone.replace(/[^0-9]/g, '');
                const waUrl = cleanPhone ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}` : `https://wa.me/?text=${encodeURIComponent(msg)}`;

                return (
                  <a
                    href={waUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition cursor-pointer shadow-md"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>إرسال تذكير عبر واتساب 📱</span>
                  </a>
                );
              })()}

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

      {/* EDIT LESSON MODAL WITH STUDENT / GROUP SELECTOR */}
      <EditLessonModal
        isOpen={!!editingSchedule}
        onClose={() => setEditingSchedule(null)}
        teacherId={profile.id}
        schedule={editingSchedule}
        students={students}
        groups={groups}
        schedules={schedules}
        onSuccess={() => setEditingSchedule(null)}
      />

      {/* MODAL 2: QUICK ADD SCHEDULE MODAL (WITH MULTIPLE TIME SLOTS SUPPORT) */}
      {showAddModal && !editingSchedule && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="w-full max-w-xl bg-slate-900 border border-purple-500/40 rounded-3xl p-5 shadow-2xl text-right max-h-[92vh] flex flex-col animate-fadeIn">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-purple-900/40 pb-3 mb-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-2xl bg-purple-600/20 text-purple-300 flex items-center justify-center border border-purple-500/30">
                  <Calendar className="w-4 h-4 text-purple-400" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-white">
                    إضافة وتثبيت مواعيد بالجدول
                  </h3>
                  <p className="text-[11px] text-purple-300">
                    دعم مواعيد متعددة وإضافة طلاب جدد مباشرة
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto pr-1 flex-1">
              {/* Conflict Error Alert */}
              {conflictError && (
                <div className="rounded-2xl bg-rose-950/80 border border-rose-500/50 p-3.5 flex items-start gap-2.5 text-rose-200 text-xs shadow-lg animate-shake">
                  <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 leading-relaxed">
                    <p className="font-bold text-rose-300 mb-0.5">تنبيه تعارض في المواعيد!</p>
                    <p className="text-[11px] text-rose-200">{conflictError}</p>
                  </div>
                </div>
              )}

              {/* SECTION 1: STUDENT SELECTION (Existing vs New Direct Quick Add) - Only when NOT editing */}
              {!editingSchedule && (
                <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-purple-900/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-white flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-purple-400" />
                      <span>تحديد الطالب</span>
                    </label>

                    {/* Mode Toggle Tabs */}
                    <div className="flex rounded-xl bg-slate-900 border border-slate-700/80 p-0.5 text-xs">
                      <button
                        type="button"
                        onClick={() => setStudentSelectionMode('existing')}
                        className={`px-3 py-1 rounded-lg font-bold transition flex items-center gap-1 cursor-pointer ${
                          studentSelectionMode === 'existing'
                            ? 'bg-purple-600 text-white shadow'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        <UserCheck className="w-3 h-3" />
                        <span>طالب مسجل</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setStudentSelectionMode('new')}
                        className={`px-3 py-1 rounded-lg font-bold transition flex items-center gap-1 cursor-pointer ${
                          studentSelectionMode === 'new'
                            ? 'bg-purple-600 text-white shadow'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        <UserPlus className="w-3 h-3" />
                        <span>طالب جديد فوراً ⚡</span>
                      </button>
                    </div>
                  </div>

                  {/* Mode A: Existing Student Picker */}
                  {studentSelectionMode === 'existing' && (
                    <div className="space-y-2">
                      {students.length > 0 ? (
                        <>
                          {/* Search Input */}
                          <div className="relative">
                            <input
                              type="text"
                              value={formStudentSearch}
                              onChange={(e) => setFormStudentSearch(e.target.value)}
                              placeholder="ابحث باسم الطالب أو المادة..."
                              className="w-full rounded-xl bg-slate-900 border border-slate-700/80 pr-8 pl-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-400"
                            />
                            <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5" />
                          </div>

                          {/* Student Select Dropdown */}
                          <select
                            value={formStudentId}
                            onChange={(e) => setFormStudentId(e.target.value)}
                            required
                            className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-400 cursor-pointer"
                          >
                            {filteredStudents.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name} • {s.subject || 'بدون مادة'} • {s.hourlyRate || 100} ج.م/ساعة
                              </option>
                            ))}
                          </select>

                          {/* Selected Student Quick Info Badge */}
                          {(() => {
                            const sel = students.find((s) => s.id === formStudentId);
                            if (!sel) return null;
                            return (
                              <div className="flex items-center justify-between text-[11px] px-2.5 py-1.5 rounded-xl bg-purple-950/40 border border-purple-800/30 text-purple-200">
                                <span className="font-semibold">{sel.name}</span>
                                <span className="text-slate-400">{sel.subject} • سعر الساعة: {sel.hourlyRate || 100}</span>
                              </div>
                            );
                          })()}
                        </>
                      ) : (
                        <div className="text-center py-2 text-xs text-slate-400">
                          <p>لا يوجد طلاب مسجلين مسبقاً.</p>
                          <button
                            type="button"
                            onClick={() => setStudentSelectionMode('new')}
                            className="mt-1 text-purple-400 hover:underline font-bold"
                          >
                            اضغط هنا لإضافة طالب جديد فوراً ⚡
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Mode B: Direct Quick Add New Student Form */}
                  {studentSelectionMode === 'new' && (
                    <div className="space-y-2.5 pt-1">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[11px] font-medium text-slate-300 mb-1">
                            اسم الطالب الجديد *
                          </label>
                          <input
                            type="text"
                            value={newStudentName}
                            onChange={(e) => setNewStudentName(e.target.value)}
                            placeholder="مثال: أحمد محمد"
                            required
                            className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-1.5 text-xs text-white focus:outline-none focus:border-purple-400"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-medium text-slate-300 mb-1">
                            رقم الواتساب (اختياري)
                          </label>
                          <input
                            type="tel"
                            value={newStudentWhatsapp}
                            onChange={(e) => setNewStudentWhatsapp(e.target.value)}
                            placeholder="مثال: 01012345678"
                            className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-1.5 text-xs text-white focus:outline-none focus:border-purple-400 font-mono"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div>
                          <label className="block text-[11px] font-medium text-slate-300 mb-1">
                            المادة الدراسية
                          </label>
                          <input
                            type="text"
                            value={newStudentSubject}
                            onChange={(e) => setNewStudentSubject(e.target.value)}
                            placeholder="رياضيات، فيزياء..."
                            className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-1.5 text-xs text-white focus:outline-none focus:border-purple-400"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-medium text-slate-300 mb-1">
                            سعر الساعة ({profile.currency || 'ج.م'})
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={newStudentHourlyRate}
                            onChange={(e) => setNewStudentHourlyRate(Number(e.target.value))}
                            className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-1.5 text-xs text-white focus:outline-none focus:border-purple-400 font-mono"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-medium text-slate-300 mb-1">
                            نوع الحصة
                          </label>
                          <select
                            value={newStudentClassType}
                            onChange={(e) => setNewStudentClassType(e.target.value as ClassType)}
                            className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-1.5 text-xs text-white focus:outline-none focus:border-purple-400 cursor-pointer"
                          >
                            <option value="in_person">حضور شخصي 👤</option>
                            <option value="online">أونلاين 🌐</option>
                            <option value="trial">حصة تجريبية ✨</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* SECTION 3: MULTIPLE TIME SLOTS LIST (When Adding New Slots) */}
              {!editingSchedule && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-purple-400" />
                      <h4 className="text-xs font-bold text-white">
                        مواعيد الحصص الأسبوعية ({formSlotsList.length})
                      </h4>
                    </div>

                    {/* Quick Presets */}
                    <div className="flex items-center gap-1 text-[10px]">
                      <span className="text-slate-500 hidden sm:inline">نماذج سريعة:</span>
                      <button
                        type="button"
                        onClick={() => handleApplyPreset([6, 3], '16:00', 60, 'in_person')}
                        className="px-2 py-0.5 rounded-lg bg-slate-800 text-purple-300 hover:bg-slate-700 border border-slate-700 transition cursor-pointer"
                        title="السبت والأربعاء"
                      >
                        سبت/أربعاء
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApplyPreset([0, 2], '17:00', 60, 'in_person')}
                        className="px-2 py-0.5 rounded-lg bg-slate-800 text-purple-300 hover:bg-slate-700 border border-slate-700 transition cursor-pointer"
                        title="الأحد والثلاثاء"
                      >
                        أحد/ثلاثاء
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApplyPreset([1, 4], '16:00', 60, 'in_person')}
                        className="px-2 py-0.5 rounded-lg bg-slate-800 text-purple-300 hover:bg-slate-700 border border-slate-700 transition cursor-pointer"
                        title="الإثنين والخميس"
                      >
                        إثنين/خميس
                      </button>
                    </div>
                  </div>

                  {/* Dynamic Slots Cards List */}
                  <div className="space-y-2.5">
                    {formSlotsList.map((slotItem, index) => {
                      return (
                        <div
                          key={slotItem.id}
                          className="p-3.5 rounded-2xl bg-slate-950/80 border border-purple-900/40 space-y-3 relative group"
                        >
                          {/* Slot Header */}
                          <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full bg-purple-600/30 border border-purple-400/40 text-purple-300 text-[10px] font-bold flex items-center justify-center">
                                {index + 1}
                              </span>
                              <span className="text-xs font-bold text-white">الموعد رقم {index + 1}</span>
                              <span className="text-[10px] text-purple-300 font-mono">
                                {WEEK_DAYS.find((d) => d.dayIndex === slotItem.dayOfWeek)?.name} • {slotItem.time}
                              </span>
                            </div>

                            {formSlotsList.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveSlot(slotItem.id)}
                                className="p-1 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/50 transition cursor-pointer"
                                title="حذف هذا الموعد"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>

                          {/* Day & Time Selection */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            <div>
                              <label className="block text-[11px] font-medium text-slate-300 mb-1">
                                يوم الحصة *
                              </label>
                              <select
                                value={slotItem.dayOfWeek}
                                onChange={(e) =>
                                  handleUpdateSlotItem(slotItem.id, { dayOfWeek: Number(e.target.value) })
                                }
                                className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-1.5 text-xs text-white focus:outline-none focus:border-purple-400 cursor-pointer"
                              >
                                {WEEK_DAYS.map((d) => (
                                  <option key={d.dayIndex} value={d.dayIndex}>
                                    {d.name}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label className="block text-[11px] font-medium text-slate-300 mb-1">
                                وقت البدء *
                              </label>
                              <select
                                value={slotItem.time}
                                onChange={(e) =>
                                  handleUpdateSlotItem(slotItem.id, { time: e.target.value })
                                }
                                className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-1.5 text-xs text-white focus:outline-none focus:border-purple-400 cursor-pointer font-mono"
                              >
                                {TIME_SLOTS.map((ts) => (
                                  <option key={ts.time24} value={ts.time24}>
                                    {ts.label} ({ts.time24})
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>

                          {/* Duration, Type, Color */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                            <div>
                              <label className="block text-[11px] font-medium text-slate-300 mb-1">
                                مدة الحصة
                              </label>
                              <select
                                value={slotItem.duration}
                                onChange={(e) =>
                                  handleUpdateSlotItem(slotItem.id, { duration: Number(e.target.value) })
                                }
                                className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-1.5 text-xs text-white focus:outline-none focus:border-purple-400 cursor-pointer"
                              >
                                <option value={30}>30 دقيقة</option>
                                <option value={45}>45 دقيقة</option>
                                <option value={60}>60 دقيقة (ساعة)</option>
                                <option value={90}>90 دقيقة (ساعة ونصف)</option>
                                <option value={120}>120 دقيقة (ساعتان)</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-[11px] font-medium text-slate-300 mb-1">
                                نوع الحصة
                              </label>
                              <select
                                value={slotItem.classType}
                                onChange={(e) => {
                                  const val = e.target.value as ClassType;
                                  handleUpdateSlotItem(slotItem.id, {
                                    classType: val,
                                    color: getClassTypeMeta(val).colorId,
                                  });
                                }}
                                className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-1.5 text-xs text-white focus:outline-none focus:border-purple-400 cursor-pointer"
                              >
                                <option value="in_person">حضور شخصي 👤</option>
                                <option value="online">أونلاين 🌐</option>
                                <option value="trial">حصة تجريبية ✨</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-[11px] font-medium text-slate-300 mb-1">
                                لون الموعد
                              </label>
                              <select
                                value={slotItem.color}
                                onChange={(e) =>
                                  handleUpdateSlotItem(slotItem.id, { color: e.target.value })
                                }
                                className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-1.5 text-xs text-white focus:outline-none focus:border-purple-400 cursor-pointer"
                              >
                                {CLASS_COLORS.map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {c.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>

                          {/* Location / Link optional */}
                          <div>
                            <input
                              type="text"
                              value={slotItem.locationOrLink || ''}
                              onChange={(e) =>
                                handleUpdateSlotItem(slotItem.id, { locationOrLink: e.target.value })
                              }
                              placeholder="المكان أو الرابط (اختياري: رابط Zoom أو السنتر)..."
                              className="w-full rounded-xl bg-slate-900 border border-slate-700/80 px-3 py-1.5 text-[11px] text-white focus:outline-none focus:border-purple-400"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Add Another Slot Button */}
                  <button
                    type="button"
                    onClick={handleAddAnotherSlot}
                    className="w-full py-2.5 rounded-2xl border-2 border-dashed border-purple-500/40 hover:border-purple-400 bg-purple-950/20 hover:bg-purple-950/40 text-purple-300 text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-[0.99]"
                  >
                    <Plus className="w-4 h-4 text-purple-400" />
                    <span>+ إضافة موعد آخر لهذا الطالب</span>
                  </button>
                </div>
              )}

              {/* Submit & Cancel Buttons */}
              <div className="pt-2 flex items-center gap-2 sticky bottom-0 bg-slate-900 pb-1">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 rounded-2xl bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:brightness-110 py-3 text-xs font-bold text-white transition active:scale-95 disabled:opacity-50 cursor-pointer shadow-xl shadow-purple-950/60 flex items-center justify-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  <span>
                    {isSubmitting
                      ? 'جارٍ الحفظ في قاعدة البيانات...'
                      : editingSchedule
                      ? 'حفظ التعديلات'
                      : `تثبيت ${formSlotsList.length > 1 ? `${formSlotsList.length} مواعيد` : 'الموعد'} بالجدول`}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-3 rounded-2xl bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold transition cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Evaluation Modal */}
      {showQuickEvalModal && evalTargetSlot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div
            className="relative w-full max-w-md rounded-3xl bg-slate-900 border border-purple-500/30 p-5 space-y-4 shadow-2xl text-right"
            dir="rtl"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-300 flex items-center justify-center border border-amber-500/30">
                  <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">التقييم السريع للحصة 🌟</h3>
                  <p className="text-xs text-purple-300">
                    {evalTargetSlot.studentName} • الساعة {evalTargetSlot.time}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowQuickEvalModal(false)}
                className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Interactive Stars Selector */}
            <div className="space-y-2 text-center bg-slate-950/50 p-3 rounded-2xl border border-slate-800">
              <label className="block text-xs font-bold text-slate-300">
                درجة تقييم أداء الطالب واستيعابه للحصة:
              </label>
              <div className="flex items-center justify-center gap-2 py-1.5">
                {[1, 2, 3, 4, 5].map((starVal) => (
                  <button
                    key={starVal}
                    type="button"
                    onClick={() => setEvalRating(starVal)}
                    className="p-1 transition hover:scale-125 active:scale-95 cursor-pointer"
                    title={`تقييم ${starVal} من 5`}
                  >
                    <Star
                      className={`w-7 h-7 ${
                        starVal <= evalRating
                          ? 'fill-amber-400 text-amber-400 filter drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]'
                          : 'text-slate-600 hover:text-slate-400'
                      }`}
                    />
                  </button>
                ))}
              </div>
              <p className="text-xs font-bold text-amber-300">
                {evalRating === 5 && 'ممتاز - استيعاب وأداء كلي 🌟🌟🌟🌟🌟'}
                {evalRating === 4 && 'جيد جداً - استيعاب مرتفع 🌟🌟🌟🌟'}
                {evalRating === 3 && 'جيد - يفي بالمتطلبات 🌟🌟🌟'}
                {evalRating === 2 && 'مقبول - يحتاج مراجعة 🌟🌟'}
                {evalRating === 1 && 'ضعيف - يحتاج متابعة خاصة 🌟'}
              </p>
            </div>

            {/* Evaluation Notes Area with Voice Input */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-300">
                  ملاحظات وتقييم أداء الطالب (اختياري):
                </label>
                <VoiceInputButton
                  onTranscript={(text) => setEvalNotes((prev) => (prev ? `${prev} ${text}` : text))}
                  compact
                />
              </div>
              <textarea
                rows={3}
                value={evalNotes}
                onChange={(e) => setEvalNotes(e.target.value)}
                placeholder="اكتب أو امْلِ بصوتك ملاحظاتك عن أداء الطالب، استيعابه، أو النقاط الإيجابية..."
                className="w-full rounded-2xl bg-slate-950 border border-slate-700 p-3 text-xs text-white focus:outline-none focus:border-amber-400 leading-relaxed transition"
              />
            </div>

            {/* Success Notice */}
            {evalNotice && (
              <div className="p-2.5 rounded-xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-xs text-center font-bold animate-pulse">
                {evalNotice}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                disabled={isSavingEval}
                onClick={handleSaveQuickEval}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:brightness-110 text-slate-950 font-black text-xs transition cursor-pointer shadow-lg disabled:opacity-50"
              >
                {isSavingEval ? 'جارٍ الحفظ...' : 'حفظ التقييم 💾'}
              </button>
              <button
                type="button"
                onClick={() => setShowQuickEvalModal(false)}
                className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold transition cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
