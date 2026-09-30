import React, { useState, useEffect } from 'react';
import { TeacherProfile, Student, LessonLog, ClassType, PaymentStatus, ScheduleSlot } from '../types';
import {
  addStudent,
  updateStudent,
  deleteStudent,
  toggleStudentPaymentStatus,
  subscribeToStudentLessons,
  addLessonLog,
  deleteLessonLog,
  addSchedule,
  updateSchedule,
  deleteSchedule,
} from '../firebase';
import {
  WEEK_DAYS,
  TIME_SLOTS,
  CLASS_COLORS,
  getColorStyle,
} from './ScheduleTab';
import {
  UserPlus,
  Search,
  Phone,
  MessageCircle,
  CreditCard,
  CheckCircle2,
  XCircle,
  Calendar,
  BookOpen,
  Star,
  Trash2,
  Edit2,
  X,
  Filter,
  Check,
  Video,
  Building,
  UserCheck,
  Sparkles,
  Share2,
  Copy,
  Lightbulb,
  FileText,
  AlertCircle,
  Brain,
  Send,
  HelpCircle,
  Clock,
  Palette,
  Plus,
  ChevronDown,
} from 'lucide-react';

interface FormScheduleRow {
  id: string;
  dayOfWeek: number;
  time: string;
  duration: number;
}

export const DURATION_OPTIONS = [
  { value: 30, label: '30 دقيقة' },
  { value: 45, label: '45 دقيقة' },
  { value: 60, label: '60 دقيقة' },
  { value: 90, label: '90 دقيقة' },
  { value: 120, label: '120 دقيقة' },
];

interface StudentsTabProps {
  profile: TeacherProfile;
  students: Student[];
  schedules?: ScheduleSlot[];
}

export const StudentsTab: React.FC<StudentsTabProps> = ({ profile, students, schedules = [] }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | ClassType>('all');
  const [paymentFilter, setPaymentFilter] = useState<'all' | PaymentStatus>('all');

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [selectedProfileStudent, setSelectedProfileStudent] = useState<Student | null>(null);
  const [studentLessons, setStudentLessons] = useState<LessonLog[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<Student | null>(null);
  const [showMonthlyReportModal, setShowMonthlyReportModal] = useState(false);
  const [copiedReport, setCopiedReport] = useState(false);

  // Form fields for Add/Edit Student
  const [formName, setFormName] = useState('');
  const [formWhatsapp, setFormWhatsapp] = useState('');
  const [formSubject, setFormSubject] = useState(profile.subject || 'رياضيات');
  const [formClassType, setFormClassType] = useState<ClassType>('private');
  const [formMonthlyFee, setFormMonthlyFee] = useState<number>(300);
  const [formLearningStyle, setFormLearningStyle] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Schedules state for Add Student modal
  const [formSchedules, setFormSchedules] = useState<FormScheduleRow[]>([]);
  const [formColor, setFormColor] = useState('purple');

  // Schedules state inside Student Details modal
  const [showAddScheduleInsideProfile, setShowAddScheduleInsideProfile] = useState(false);
  const [newSchedDay, setNewSchedDay] = useState<number>(6); // Saturday
  const [newSchedTime, setNewSchedTime] = useState('16:00'); // 04:00 PM
  const [newSchedDuration, setNewSchedDuration] = useState<number>(60);
  const [newSchedClassType, setNewSchedClassType] = useState<ClassType>('private');
  const [newSchedColor, setNewSchedColor] = useState('purple');
  const [savingSchedInProfile, setSavingSchedInProfile] = useState(false);
  const [isManagingSchedules, setIsManagingSchedules] = useState(false);

  // Edit schedule state inside Student Details modal
  const [editingScheduleSlot, setEditingScheduleSlot] = useState<ScheduleSlot | null>(null);
  const [editSchedDay, setEditSchedDay] = useState<number>(6);
  const [editSchedTime, setEditSchedTime] = useState('16:00');
  const [editSchedDuration, setEditSchedDuration] = useState<number>(60);
  const [editSchedClassType, setEditSchedClassType] = useState<ClassType>('private');
  const [editSchedColor, setEditSchedColor] = useState('purple');

  // Helper row management for Add Student modal
  const handleAddScheduleRow = () => {
    setFormSchedules((prev) => [
      ...prev,
      {
        id: Math.random().toString(),
        dayOfWeek: 6, // السبت
        time: '16:00', // 04:00 م
        duration: 60,
      },
    ]);
  };

  const handleRemoveScheduleRow = (rowId: string) => {
    setFormSchedules((prev) => prev.filter((r) => r.id !== rowId));
  };

  const handleUpdateScheduleRow = (rowId: string, updates: Partial<FormScheduleRow>) => {
    setFormSchedules((prev) =>
      prev.map((r) => (r.id === rowId ? { ...r, ...updates } : r))
    );
  };

  const formatSlotTime = (timeStr: string) => {
    const slot = TIME_SLOTS.find((t) => t.time24 === timeStr);
    return slot ? slot.label : timeStr;
  };

  const getDayName = (dayIndex: number) => {
    const d = WEEK_DAYS.find((w) => w.dayIndex === dayIndex);
    return d ? d.name : '';
  };

  // Helper to format schedule display in exact Arabic format
  // Example: السبت الساعة 04:00 مساءً (60 دقيقة) - أونلاين
  const formatScheduleDisplayArabic = (slot: {
    dayOfWeek: number;
    time: string;
    duration?: number;
    classType?: ClassType;
  }) => {
    const day = WEEK_DAYS.find((d) => d.dayIndex === slot.dayOfWeek);
    const dayName = day ? day.name : 'السبت';
    const [hStr, mStr] = (slot.time || '16:00').split(':');
    const h = parseInt(hStr, 10) || 0;
    const m = parseInt(mStr, 10) || 0;
    const period = h < 12 ? 'صباحاً' : 'مساءً';
    const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
    const timeFormatted = `${displayHour.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} ${period}`;
    const dur = slot.duration || 60;
    const classTypeStr =
      slot.classType === 'online'
        ? 'أونلاين'
        : slot.classType === 'center'
        ? 'سنتر'
        : 'برايفيت';
    return `${dayName} الساعة ${timeFormatted} (${dur} دقيقة) - ${classTypeStr}`;
  };

  // Actions for managing schedules directly inside Student Details Modal
  const handleAddScheduleForProfileStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProfileStudent) return;
    setSavingSchedInProfile(true);
    try {
      await addSchedule(profile.id, {
        studentId: selectedProfileStudent.id,
        studentName: selectedProfileStudent.name,
        dayOfWeek: Number(newSchedDay),
        time: newSchedTime,
        duration: Number(newSchedDuration) || 60,
        recurrence: 'weekly',
        classType: newSchedClassType,
        color: newSchedColor || selectedProfileStudent.color || 'purple',
      });
      setShowAddScheduleInsideProfile(false);
      // Reset default values
      setNewSchedDay(6);
      setNewSchedTime('16:00');
      setNewSchedDuration(60);
    } catch (err) {
      console.error('Error adding schedule in profile', err);
    } finally {
      setSavingSchedInProfile(false);
    }
  };

  const handleStartEditScheduleSlot = (slot: ScheduleSlot) => {
    setEditingScheduleSlot(slot);
    setEditSchedDay(slot.dayOfWeek);
    setEditSchedTime(slot.time);
    setEditSchedDuration(slot.duration || 60);
    setEditSchedClassType(slot.classType || 'private');
    setEditSchedColor(slot.color || selectedProfileStudent?.color || 'purple');
    setShowAddScheduleInsideProfile(false);
  };

  const handleSaveEditScheduleSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingScheduleSlot) return;
    setSavingSchedInProfile(true);
    try {
      await updateSchedule(profile.id, editingScheduleSlot.id, {
        dayOfWeek: Number(editSchedDay),
        time: editSchedTime,
        duration: Number(editSchedDuration) || 60,
        classType: editSchedClassType,
        color: editSchedColor,
      });
      setEditingScheduleSlot(null);
    } catch (err) {
      console.error('Error updating schedule slot', err);
    } finally {
      setSavingSchedInProfile(false);
    }
  };

  const handleDeleteScheduleSlot = async (slotId: string) => {
    try {
      await deleteSchedule(profile.id, slotId);
      if (editingScheduleSlot?.id === slotId) {
        setEditingScheduleSlot(null);
      }
    } catch (err) {
      console.error('Error deleting schedule slot', err);
    }
  };

  // Sync selectedProfileStudent if updated in parent list
  useEffect(() => {
    if (selectedProfileStudent) {
      const updated = students.find((s) => s.id === selectedProfileStudent.id);
      if (updated) {
        setSelectedProfileStudent(updated);
      }
    }
  }, [students]);

  // New Lesson form inside Student Profile
  const [showAddLessonInsideProfile, setShowAddLessonInsideProfile] = useState(false);
  const [newLessonTopic, setNewLessonTopic] = useState('');
  const [newLessonHomework, setNewLessonHomework] = useState('');
  const [newLessonAttendance, setNewLessonAttendance] = useState<'present' | 'absent' | 'excused'>('present');
  const [newLessonRating, setNewLessonRating] = useState<number>(5);

  // Learning style editing inside profile
  const [profileLearningStyle, setProfileLearningStyle] = useState('');
  const [savingLearningStyle, setSavingLearningStyle] = useState(false);

  // Subscribe to selected student's lessons
  useEffect(() => {
    if (!selectedProfileStudent) {
      setStudentLessons([]);
      return;
    }
    setProfileLearningStyle(selectedProfileStudent.learningStyle || '');
    const unsub = subscribeToStudentLessons(profile.id, selectedProfileStudent.id, (lessons) => {
      setStudentLessons(lessons);
    });
    return () => unsub();
  }, [profile.id, selectedProfileStudent]);

  // Filter students
  const filteredStudents = students.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.whatsapp && s.whatsapp.includes(searchQuery)) ||
      s.subject.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === 'all' || s.classType === typeFilter;
    const matchesPayment = paymentFilter === 'all' || s.paymentStatus === paymentFilter;
    return matchesSearch && matchesType && matchesPayment;
  });

  const handleOpenAddModal = () => {
    setEditingStudent(null);
    setFormName('');
    setFormWhatsapp('');
    setFormSubject(profile.subject || 'رياضيات');
    setFormClassType('private');
    setFormMonthlyFee(300);
    setFormLearningStyle('');
    setFormNotes('');
    setFormSchedules([]);
    setFormColor('purple');
    setShowAddModal(true);
  };

  const handleOpenEditModal = (student: Student) => {
    setEditingStudent(student);
    setFormName(student.name);
    setFormWhatsapp(student.whatsapp || '');
    setFormSubject(student.subject);
    setFormClassType(student.classType);
    setFormMonthlyFee(student.monthlyFee || 0);
    setFormLearningStyle(student.learningStyle || '');
    setFormNotes(student.notes || '');
    setFormColor(student.color || 'purple');
    setFormSchedules([]);
    setShowAddModal(true);
  };

  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return; // WhatsApp is optional!
    setIsSubmitting(true);

    try {
      if (editingStudent) {
        await updateStudent(profile.id, editingStudent.id, {
          name: formName.trim(),
          whatsapp: formWhatsapp.trim(),
          subject: formSubject.trim(),
          classType: formClassType,
          monthlyFee: Number(formMonthlyFee) || 0,
          learningStyle: formLearningStyle.trim(),
          notes: formNotes.trim(),
          color: formColor,
        });
      } else {
        const newStudentId = await addStudent(profile.id, {
          name: formName.trim(),
          whatsapp: formWhatsapp.trim(),
          subject: formSubject.trim(),
          classType: formClassType,
          monthlyFee: Number(formMonthlyFee) || 0,
          paymentStatus: 'unpaid',
          learningStyle: formLearningStyle.trim(),
          notes: formNotes.trim(),
          color: formColor,
        });

        // Automatically save weekly schedules to timetable
        if (newStudentId && formSchedules.length > 0) {
          for (const s of formSchedules) {
            await addSchedule(profile.id, {
              studentId: newStudentId,
              studentName: formName.trim(),
              dayOfWeek: Number(s.dayOfWeek),
              time: s.time,
              duration: Number(s.duration) || 60,
              recurrence: 'weekly',
              classType: formClassType,
              color: formColor,
            });
          }
        }
      }
      setShowAddModal(false);
    } catch (err) {
      console.error('Error saving student', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteStudent = async (studentId: string) => {
    try {
      await deleteStudent(profile.id, studentId);
      setShowDeleteConfirm(null);
      if (selectedProfileStudent?.id === studentId) {
        setSelectedProfileStudent(null);
      }
    } catch (err) {
      console.error('Error deleting student', err);
    }
  };

  const handleAddLessonSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProfileStudent || !newLessonTopic.trim()) return;
    try {
      const todayStr = new Intl.DateTimeFormat('en-CA').format(new Date());
      await addLessonLog(profile.id, selectedProfileStudent.id, {
        date: todayStr,
        topic: newLessonTopic.trim(),
        homework: newLessonHomework.trim(),
        attendance: newLessonAttendance,
        rating: newLessonRating,
        notes: '',
      });
      setNewLessonTopic('');
      setNewLessonHomework('');
      setShowAddLessonInsideProfile(false);
    } catch (err) {
      console.error('Error adding lesson log', err);
    }
  };

  const handleSaveLearningStyle = async () => {
    if (!selectedProfileStudent) return;
    setSavingLearningStyle(true);
    try {
      await updateStudent(profile.id, selectedProfileStudent.id, {
        learningStyle: profileLearningStyle.trim(),
      });
      setSelectedProfileStudent({
        ...selectedProfileStudent,
        learningStyle: profileLearningStyle.trim(),
      });
    } catch (e) {
      console.error('Error saving learning style', e);
    } finally {
      setSavingLearningStyle(false);
    }
  };

  // Generate Monthly Report for WhatsApp
  const currentMonthName = new Intl.DateTimeFormat('ar-EG', { month: 'long', year: 'numeric' }).format(new Date());
  const presentCount = studentLessons.filter((l) => l.attendance === 'present').length;
  const absentCount = studentLessons.filter((l) => l.attendance === 'absent').length;
  const excusedCount = studentLessons.filter((l) => l.attendance === 'excused').length;
  const totalLessons = studentLessons.length;
  const ratings = studentLessons.map((l) => l.rating || 5);
  const avgRating = ratings.length > 0 ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : '5.0';

  const generateMonthlyReportText = () => {
    if (!selectedProfileStudent) return '';
    const lessonsSummary = studentLessons
      .slice(0, 5)
      .map((l, i) => `  ${i + 1}. [${l.date}] ${l.topic}`)
      .join('\n');

    return (
      `السلام عليكم ورحمة الله وبركاته 🌷\n` +
      `تقرير المتابعة الشهري لشهر (${currentMonthName})\n` +
      `👤 الطالب/ـة: ${selectedProfileStudent.name}\n` +
      `📚 المادة: ${selectedProfileStudent.subject}\n` +
      `👨‍🏫 المعلم: أ. ${profile.name}\n\n` +
      `📊 ملخص الحضور والالتزام:\n` +
      `• إجمالي الحصص المنفذة: ${totalLessons} حصة\n` +
      `• عدد مرات الحضور: ${presentCount} ✅\n` +
      (absentCount > 0 ? `• مرات الغياب: ${absentCount} ❌\n` : '') +
      (excusedCount > 0 ? `• اعتذارات مسبقة: ${excusedCount} ⚠️\n` : '') +
      `• متوسط التقييم العام: ${avgRating} من 5 ⭐\n\n` +
      (lessonsSummary ? `📖 أهم ما تم شرحه ودراسته:\n${lessonsSummary}\n\n` : '') +
      (selectedProfileStudent.learningStyle ? `💡 ملاحظات المعلم:\n${selectedProfileStudent.learningStyle}\n\n` : '') +
      `مع خالص تمنياتنا بالتفوق والنجاح الباهر دائماً 🌟`
    );
  };

  const handleSendMonthlyReport = () => {
    if (!selectedProfileStudent) return;
    const text = generateMonthlyReportText();
    const cleanPhone = selectedProfileStudent.whatsapp ? selectedProfileStudent.whatsapp.replace(/[^0-9]/g, '') : '';
    const phoneParam = cleanPhone ? (cleanPhone.startsWith('0') ? '2' + cleanPhone : cleanPhone) : '';
    const url = phoneParam
      ? `https://wa.me/${phoneParam}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const handleCopyReport = () => {
    const text = generateMonthlyReportText();
    navigator.clipboard.writeText(text);
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 2500);
  };

  // Payment Reminder WhatsApp Generator
  const handleSendPaymentReminder = () => {
    if (!selectedProfileStudent) return;
    const text = encodeURIComponent(
      `السلام عليكم ورحمة الله وبركاته 🌷\n` +
      `تحية طيبة لولي أمر الطالب/ـة المتميز/ة: ${selectedProfileStudent.name}\n` +
      `نود تذكيركم بمصروفات حصص مادة (${selectedProfileStudent.subject}) لشهر (${currentMonthName}) وقدرها: ${selectedProfileStudent.monthlyFee} ج.م.\n\n` +
      `شاكرين ومقدرين حسن تعاونكم وحرصكم الدائم على متابعة الطالب 🌟\n` +
      `معلمكم: أ. ${profile.name}`
    );
    const cleanPhone = selectedProfileStudent.whatsapp ? selectedProfileStudent.whatsapp.replace(/[^0-9]/g, '') : '';
    const phoneParam = cleanPhone ? (cleanPhone.startsWith('0') ? '2' + cleanPhone : cleanPhone) : '';
    const url = phoneParam
      ? `https://wa.me/${phoneParam}?text=${text}`
      : `https://wa.me/?text=${text}`;
    window.open(url, '_blank');
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
          <h2 className="text-lg font-bold text-white">سجل الطلاب ({students.length})</h2>
          <p className="text-xs text-slate-400">إدارة الطلاب، الحضور، التقارير والمدفوعات</p>
        </div>
        <button
          onClick={handleOpenAddModal}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-lg shadow-purple-950/50 active:scale-95 transition cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          <span>إضافة طالب</span>
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div className="space-y-2">
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث بالاسم، المادة، أو رقم الهاتف..."
            className="w-full rounded-xl bg-slate-900/90 border border-slate-700/80 px-3.5 py-2.5 pr-10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-400"
          />
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-[11px]">
          <span className="text-slate-400 flex items-center gap-1">
            <Filter className="w-3 h-3" />
            <span>النوع:</span>
          </span>
          {(['all', 'private', 'online', 'center'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer whitespace-nowrap ${
                typeFilter === t
                  ? 'bg-purple-600 text-white shadow'
                  : 'bg-slate-800/80 text-slate-400 hover:text-white'
              }`}
            >
              {t === 'all' ? 'الكل' : t === 'private' ? 'برايفيت' : t === 'online' ? 'أونلاين' : 'سنتر'}
            </button>
          ))}

          <span className="text-slate-400 mr-2">الدفع:</span>
          {(['all', 'paid', 'unpaid'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPaymentFilter(p)}
              className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer whitespace-nowrap ${
                paymentFilter === p
                  ? 'bg-purple-600 text-white shadow'
                  : 'bg-slate-800/80 text-slate-400 hover:text-white'
              }`}
            >
              {p === 'all' ? 'الكل' : p === 'paid' ? 'دفع ✅' : 'لم يدفع ❌'}
            </button>
          ))}
        </div>
      </div>

      {/* Students List */}
      {filteredStudents.length === 0 ? (
        <div className="rounded-2xl bg-slate-900/50 border border-slate-800 p-8 text-center">
          <BookOpen className="w-10 h-10 mx-auto text-purple-400/60 mb-2" />
          <p className="text-sm font-bold text-slate-200">
            {students.length === 0 ? 'لم تقم بإضافة أي طالب بعد' : 'لا توجد نتائج مطابقة للبحث'}
          </p>
          <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
            {students.length === 0
              ? 'أضف أول طالب لك لبدء تسجيل الحضور ومتابعة الدروس والمدفوعات.'
              : 'جرب تغيير معايير البحث أو الفلترة.'}
          </p>
          {students.length === 0 && (
            <button
              onClick={handleOpenAddModal}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 text-white text-xs font-bold hover:bg-purple-500 transition cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>إضافة أول طالب</span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredStudents.map((s) => (
            <div
              key={s.id}
              className="rounded-2xl bg-slate-900/80 border border-purple-500/20 p-3.5 hover:border-purple-400/40 transition"
            >
              <div className="flex items-start justify-between">
                {/* Student Info Clickable */}
                <div
                  onClick={() => setSelectedProfileStudent(s)}
                  className="cursor-pointer flex-1"
                >
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-white hover:text-purple-300 transition">
                      {s.name}
                    </h3>
                    {getClassTypeBadge(s.classType)}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    مادة: <span className="text-purple-300">{s.subject}</span> •{' '}
                    <span className="font-mono">{s.monthlyFee} ج.م/شهرياً</span>
                    {s.learningStyle && (
                      <span className="mr-2 text-[11px] text-amber-300/90 truncate max-w-[150px] inline-block align-middle">
                        🧠 {s.learningStyle}
                      </span>
                    )}
                  </p>
                </div>

                {/* Quick Payment Status Toggle */}
                <button
                  type="button"
                  onClick={() => toggleStudentPaymentStatus(profile.id, s.id, s.paymentStatus)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold transition cursor-pointer ${
                    s.paymentStatus === 'paid'
                      ? 'bg-emerald-950/70 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/60'
                      : 'bg-rose-950/70 border border-rose-500/40 text-rose-300 hover:bg-rose-900/60'
                  }`}
                  title="اضغط لتغيير حالة دفع هذا الشهر"
                >
                  {s.paymentStatus === 'paid' ? (
                    <>
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      <span>دفع</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-3 h-3 text-rose-400" />
                      <span>لم يدفع</span>
                    </>
                  )}
                </button>
              </div>

              {/* Action Buttons Row */}
              <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  {s.whatsapp ? (
                    <a
                      href={`https://wa.me/${s.whatsapp.replace(/[^0-9]/g, '')}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-900/50 transition"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>واتساب</span>
                    </a>
                  ) : (
                    <span className="text-[11px] text-slate-500 px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800">
                      بدون واتساب
                    </span>
                  )}
                  <button
                    onClick={() => setSelectedProfileStudent(s)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-950/60 border border-purple-500/30 text-purple-300 hover:bg-purple-900/50 transition cursor-pointer"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>متابعة وتقارير</span>
                  </button>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleOpenEditModal(s)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                    title="تعديل"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(s)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition cursor-pointer"
                    title="حذف"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Student Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-purple-500/30 rounded-3xl p-5 shadow-2xl text-right max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-purple-900/40 pb-3 mb-3">
              <h3 className="text-base font-bold text-white">
                {editingStudent ? 'تعديل بيانات الطالب' : 'إضافة طالب جديد'}
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveStudent} className="space-y-3 overflow-y-auto pr-1">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">اسم الطالب *</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="مثال: يوسف خالد"
                  required
                  className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-400"
                />
              </div>

              {/* WHATSAPP IS NOW OPTIONAL AS REQUESTED */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  رقم الواتساب (للطالب أو ولي الأمر) <span className="text-slate-400 font-normal">(اختياري)</span>
                </label>
                <input
                  type="tel"
                  value={formWhatsapp}
                  onChange={(e) => setFormWhatsapp(e.target.value)}
                  placeholder="01012345678 (اختياري)"
                  dir="ltr"
                  className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-400 text-right"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">المادة</label>
                  <input
                    type="text"
                    value={formSubject}
                    onChange={(e) => setFormSubject(e.target.value)}
                    placeholder="مثال: رياضيات"
                    required
                    className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">نوع الحصة</label>
                  <select
                    value={formClassType}
                    onChange={(e) => setFormClassType(e.target.value as ClassType)}
                    className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-400 cursor-pointer"
                  >
                    <option value="private">برايفيت (خاص)</option>
                    <option value="online">أونلاين</option>
                    <option value="center">سنتر / مجموعة</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  المصروفات الشهرية (ج.م)
                </label>
                <input
                  type="number"
                  value={formMonthlyFee}
                  onChange={(e) => setFormMonthlyFee(Number(e.target.value))}
                  placeholder="300"
                  min={0}
                  className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-400"
                />
              </div>

              {/* How does this student learn best (Learning Style & Smart Notes) */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1.5">
                  <Brain className="w-3.5 h-3.5 text-amber-300" />
                  <span>إزاي الطالب ده بيتعلم أحسن؟ (ملاحظات أسلوب التعلم) (اختياري)</span>
                </label>
                <textarea
                  value={formLearningStyle}
                  onChange={(e) => setFormLearningStyle(e.target.value)}
                  placeholder="مثال: نمط بصري يفضل الرسوم التوضيحية، يحتاج تشجيع مستمر، يستوعب المسائل بالتطبيق العملي..."
                  rows={2}
                  className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  ملاحظات إضافية (اختياري)
                </label>
                <textarea
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="ملاحظات حول المواعيد أو متطلبات خاصة..."
                  rows={2}
                  className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-400"
                />
              </div>

              {/* SECTION: Weekly Class Schedules (Optional) - مواعيد الحصص الأسبوعية (اختياري) */}
              {!editingStudent && (
                <div className="pt-3 border-t border-purple-900/40 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-amber-300" />
                        <span>مواعيد الحصص الأسبوعية (اختياري)</span>
                      </h4>
                      <p className="text-[10px] text-purple-300/80">
                        تُسقط الحصص تلقائياً في الجدول الشبكي
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddScheduleRow}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-purple-600/30 hover:bg-purple-600/50 border border-purple-400/40 text-purple-200 text-xs font-bold transition cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ إضافة موعد للحصة</span>
                    </button>
                  </div>

                  {/* Color Palette Selector for Student */}
                  <div className="bg-slate-950/70 p-2.5 rounded-2xl border border-slate-800 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-300 font-medium flex items-center gap-1">
                        <Palette className="w-3 h-3 text-purple-400" />
                        <span>لون الحصة / الطالب في الجدول:</span>
                      </span>
                      <span className="text-purple-300 font-bold">
                        {getColorStyle(formColor).name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 overflow-x-auto py-1">
                      {CLASS_COLORS.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setFormColor(c.id)}
                          className={`w-6 h-6 rounded-full border-2 transition cursor-pointer flex-shrink-0 flex items-center justify-center ${
                            formColor === c.id ? 'border-white scale-110 shadow-lg' : 'border-transparent opacity-70 hover:opacity-100'
                          }`}
                          style={{ backgroundColor: c.hex }}
                          title={c.name}
                        >
                          {formColor === c.id && <Check className="w-3 h-3 text-white" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Schedule Rows */}
                  {formSchedules.length > 0 && (
                    <div className="space-y-2">
                      {formSchedules.map((row, idx) => (
                        <div
                          key={row.id}
                          className="rounded-2xl bg-slate-950 p-2.5 border border-purple-500/30 space-y-2 text-right relative shadow-md"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-amber-300">
                              موعد الحصة #{idx + 1}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemoveScheduleRow(row.id)}
                              className="p-1 rounded-lg text-slate-400 hover:text-rose-400 transition cursor-pointer"
                              title="حذف هذا الموعد"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="grid grid-cols-3 gap-2">
                            {/* Day */}
                            <div>
                              <label className="block text-[10px] text-slate-400 mb-1">اليوم</label>
                              <select
                                value={row.dayOfWeek}
                                onChange={(e) => handleUpdateScheduleRow(row.id, { dayOfWeek: Number(e.target.value) })}
                                className="w-full rounded-xl bg-slate-900 border border-slate-700 px-2 py-1.5 text-xs text-white focus:outline-none focus:border-purple-400 cursor-pointer"
                              >
                                {WEEK_DAYS.map((d) => (
                                  <option key={d.dayIndex} value={d.dayIndex}>
                                    {d.name}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* Start Time (12-hour 30-min intervals) */}
                            <div>
                              <label className="block text-[10px] text-slate-400 mb-1">وقت البداية</label>
                              <select
                                value={row.time}
                                onChange={(e) => handleUpdateScheduleRow(row.id, { time: e.target.value })}
                                className="w-full rounded-xl bg-slate-900 border border-slate-700 px-2 py-1.5 text-xs text-white focus:outline-none focus:border-purple-400 cursor-pointer"
                              >
                                {TIME_SLOTS.map((t) => (
                                  <option key={t.time24} value={t.time24}>
                                    {t.label}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* Duration */}
                            <div>
                              <label className="block text-[10px] text-slate-400 mb-1">المدة</label>
                              <select
                                value={row.duration}
                                onChange={(e) => handleUpdateScheduleRow(row.id, { duration: Number(e.target.value) })}
                                className="w-full rounded-xl bg-slate-900 border border-slate-700 px-2 py-1.5 text-xs text-white focus:outline-none focus:border-purple-400 cursor-pointer"
                              >
                                {DURATION_OPTIONS.map((opt) => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full rounded-xl bg-purple-600 hover:bg-purple-500 py-2.5 text-xs font-bold text-white transition active:scale-95 disabled:opacity-50 cursor-pointer shadow-lg shadow-purple-950/50"
                >
                  {isSubmitting ? 'جارٍ الحفظ...' : editingStudent ? 'حفظ التعديلات' : 'إضافة الطالب'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Student Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-slate-900 border border-rose-500/30 rounded-3xl p-5 shadow-2xl text-right">
            <h3 className="text-base font-bold text-white mb-2">تأكيد حذف الطالب</h3>
            <p className="text-xs text-slate-300 mb-4 leading-relaxed">
              هل أنت متأكد من حذف الطالب <span className="font-bold text-rose-400">"{showDeleteConfirm.name}"</span>؟ سيتم حذف جميع سجلات حصصه ومواعيده.
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleDeleteStudent(showDeleteConfirm.id)}
                className="flex-1 rounded-xl bg-rose-600 hover:bg-rose-500 py-2 text-xs font-bold text-white transition cursor-pointer"
              >
                نعم، احذف
              </button>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 rounded-xl bg-slate-800 hover:bg-slate-700 py-2 text-xs font-bold text-slate-300 transition cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Student Detailed Profile Modal (With Reports, Payments, and Learning Style) */}
      {selectedProfileStudent && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-purple-500/30 rounded-3xl p-5 shadow-2xl text-right max-h-[92vh] flex flex-col space-y-3.5">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-purple-900/40 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-white">{selectedProfileStudent.name}</h3>
                  {getClassTypeBadge(selectedProfileStudent.classType)}
                </div>
                <p className="text-xs text-purple-300 mt-0.5">
                  {selectedProfileStudent.whatsapp ? (
                    <span>واتساب: <strong dir="ltr">{selectedProfileStudent.whatsapp}</strong> • </span>
                  ) : (
                    <span>بدون رقم واتساب • </span>
                  )}
                  مادة: {selectedProfileStudent.subject}
                </p>
              </div>
              <button
                onClick={() => {
                  setSelectedProfileStudent(null);
                  setShowMonthlyReportModal(false);
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Actions (Monthly Report & Record Lesson) */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setShowMonthlyReportModal(true)}
                className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:brightness-110 text-white text-xs font-bold transition cursor-pointer shadow-md"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>تقرير الشهر لولي الأمر 📄</span>
              </button>

              <button
                onClick={() => setShowAddLessonInsideProfile(!showAddLessonInsideProfile)}
                className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{showAddLessonInsideProfile ? 'إغلاق النموذج' : 'تسجيل حصة جديدة ✏️'}</span>
              </button>
            </div>

            {/* SECTION 1: SECTION "تابع حصص ودفع الطالب" */}
            <div className="rounded-2xl bg-slate-950/70 border border-purple-500/20 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <CreditCard className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold text-white">تابع حصص ودفع الطالب</span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    toggleStudentPaymentStatus(
                      profile.id,
                      selectedProfileStudent.id,
                      selectedProfileStudent.paymentStatus
                    )
                  }
                  className={`text-[11px] font-bold px-2 py-0.5 rounded-full border transition cursor-pointer ${
                    selectedProfileStudent.paymentStatus === 'paid'
                      ? 'bg-emerald-950 border-emerald-500/40 text-emerald-300'
                      : 'bg-rose-950 border-rose-500/40 text-rose-300'
                  }`}
                >
                  {selectedProfileStudent.paymentStatus === 'paid' ? 'دفع هذا الشهر ✅' : 'لم يدفع بعد ❌'}
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">إجمالي الحصص</span>
                  <span className="font-bold text-white font-mono text-sm">{totalLessons}</span>
                </div>
                <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">المصروفات</span>
                  <span className="font-bold text-amber-300 font-mono text-sm">
                    {selectedProfileStudent.monthlyFee} ج.م
                  </span>
                </div>
                <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">نسبة الحضور</span>
                  <span className="font-bold text-emerald-400 font-mono text-sm">
                    {totalLessons > 0 ? Math.round((presentCount / totalLessons) * 100) : 100}%
                  </span>
                </div>
              </div>

              {/* WhatsApp Payment Reminder Button */}
              {selectedProfileStudent.whatsapp && (
                <button
                  onClick={handleSendPaymentReminder}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 text-xs font-semibold transition cursor-pointer"
                >
                  <MessageCircle className="w-3.5 h-3.5 text-amber-300" />
                  <span>تجهيز رسالة تذكير بالمصروفات عبر واتساب</span>
                </button>
              )}
            </div>

            {/* SECTION 2: SECTION "إزاي الطالب ده بيتعلم أحسن؟" (Learning Style & Smart Assistant) */}
            <div className="rounded-2xl bg-gradient-to-r from-purple-950/40 to-indigo-950/40 border border-purple-500/25 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Brain className="w-4 h-4 text-amber-300" />
                  <span className="text-xs font-bold text-white">إزاي الطالب ده بيتعلم أحسن؟</span>
                </div>
                <span className="text-[10px] text-purple-300 font-medium">مساعد التدريس الذكي</span>
              </div>

              {/* Quick Learning Style Tags */}
              <div className="flex flex-wrap gap-1 text-[10px]">
                {[
                  'نمط بصري 👁️',
                  'نمط سمعي 👂',
                  'تطبيقي وحركي ✍️',
                  'يحتاج تشجيع مستمر 🌟',
                  'سريع الاستيعاب 🚀',
                  'خطوة بخطوة 📐',
                ].map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => {
                      const current = profileLearningStyle;
                      if (!current.includes(tag)) {
                        setProfileLearningStyle(current ? `${current} • ${tag}` : tag);
                      }
                    }}
                    className="px-2 py-0.5 rounded-lg bg-purple-900/40 hover:bg-purple-800/60 border border-purple-500/30 text-purple-200 transition cursor-pointer"
                  >
                    + {tag}
                  </button>
                ))}
              </div>

              {/* Editable Notes Field */}
              <div className="space-y-1.5">
                <textarea
                  value={profileLearningStyle}
                  onChange={(e) => setProfileLearningStyle(e.target.value)}
                  placeholder="سجل ملاحظاتك عن أسلوب استيعاب الطالب ونقاط قوته..."
                  rows={2}
                  className="w-full rounded-xl bg-slate-950/80 border border-slate-700/80 p-2 text-xs text-slate-200 focus:outline-none focus:border-purple-400"
                />

                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-400">
                    💡 احفظ الملاحظات ليتم تضمينها تلقائياً في تقارير المتابعة
                  </span>
                  <button
                    type="button"
                    disabled={savingLearningStyle}
                    onClick={handleSaveLearningStyle}
                    className="px-3 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-[11px] font-bold transition disabled:opacity-50 cursor-pointer"
                  >
                    {savingLearningStyle ? 'جارٍ الحفظ...' : 'حفظ الملاحظة'}
                  </button>
                </div>
              </div>
            </div>

            {/* SECTION: 📅 مواعيد الحصص الأسبوعية */}
            {(() => {
              const studentSchedules = schedules.filter(
                (sched) => sched.studentId === selectedProfileStudent.id
              );
              return (
                <div className="rounded-2xl bg-slate-950/80 border border-purple-500/30 p-3.5 space-y-3 shadow-lg">
                  {/* Card Header with prominent title & buttons */}
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-amber-300" />
                      <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                        <span>📅 مواعيد الحصص الأسبوعية</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-900/60 border border-purple-500/40 text-purple-200">
                          {studentSchedules.length > 0
                            ? `${studentSchedules.length} مواعيد`
                            : 'لا توجد مواعيد'}
                        </span>
                      </h4>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {studentSchedules.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsManagingSchedules(!isManagingSchedules);
                            setShowAddScheduleInsideProfile(false);
                            setEditingScheduleSlot(null);
                          }}
                          className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold transition cursor-pointer border ${
                            isManagingSchedules
                              ? 'bg-amber-600/30 text-amber-300 border-amber-500/50'
                              : 'bg-slate-800 text-slate-300 hover:text-white border-slate-700'
                          }`}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          <span>✏️ تعديل المواعيد</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setShowAddScheduleInsideProfile(!showAddScheduleInsideProfile);
                          setEditingScheduleSlot(null);
                          setIsManagingSchedules(false);
                          setNewSchedColor(selectedProfileStudent.color || 'purple');
                        }}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition cursor-pointer shadow"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>+ إضافة موعد</span>
                      </button>
                    </div>
                  </div>

                  {/* Form for adding a new schedule */}
                  {showAddScheduleInsideProfile && (
                    <form
                      onSubmit={handleAddScheduleForProfileStudent}
                      className="p-3 rounded-2xl bg-slate-900 border border-purple-500/40 space-y-2.5 text-right shadow-md"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-amber-300 flex items-center gap-1">
                          <Plus className="w-3.5 h-3.5" />
                          <span>إضافة موعد حصة جديد لهذا الطالب</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowAddScheduleInsideProfile(false)}
                          className="p-1 rounded-lg text-slate-400 hover:text-white"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        {/* Day */}
                        <div>
                          <label className="block text-[10px] text-slate-400 mb-1">اليوم</label>
                          <select
                            value={newSchedDay}
                            onChange={(e) => setNewSchedDay(Number(e.target.value))}
                            className="w-full rounded-xl bg-slate-950 border border-slate-700 px-2 py-1.5 text-xs text-white focus:outline-none focus:border-purple-400 cursor-pointer"
                          >
                            {WEEK_DAYS.map((d) => (
                              <option key={d.dayIndex} value={d.dayIndex}>
                                {d.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Start Time (12-hour 30-min intervals) */}
                        <div>
                          <label className="block text-[10px] text-slate-400 mb-1">وقت البداية</label>
                          <select
                            value={newSchedTime}
                            onChange={(e) => setNewSchedTime(e.target.value)}
                            className="w-full rounded-xl bg-slate-950 border border-slate-700 px-2 py-1.5 text-xs text-white focus:outline-none focus:border-purple-400 cursor-pointer"
                          >
                            {TIME_SLOTS.map((t) => (
                              <option key={t.time24} value={t.time24}>
                                {t.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Duration */}
                        <div>
                          <label className="block text-[10px] text-slate-400 mb-1">المدة</label>
                          <select
                            value={newSchedDuration}
                            onChange={(e) => setNewSchedDuration(Number(e.target.value))}
                            className="w-full rounded-xl bg-slate-950 border border-slate-700 px-2 py-1.5 text-xs text-white focus:outline-none focus:border-purple-400 cursor-pointer"
                          >
                            {DURATION_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] text-slate-400 mb-1">نوع الحصة</label>
                          <select
                            value={newSchedClassType}
                            onChange={(e) => setNewSchedClassType(e.target.value as ClassType)}
                            className="w-full rounded-xl bg-slate-950 border border-slate-700 px-2 py-1.5 text-xs text-white focus:outline-none focus:border-purple-400 cursor-pointer"
                          >
                            <option value="private">برايفيت (خاص)</option>
                            <option value="online">أونلاين</option>
                            <option value="center">سنتر / مجموعة</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[10px] text-slate-400 mb-1">لون الحصة في الجدول</label>
                          <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
                            {CLASS_COLORS.map((c) => (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => setNewSchedColor(c.id)}
                                className={`w-5 h-5 rounded-full border transition cursor-pointer flex-shrink-0 flex items-center justify-center ${
                                  newSchedColor === c.id
                                    ? 'border-white scale-110 shadow'
                                    : 'border-transparent opacity-60 hover:opacity-100'
                                }`}
                                style={{ backgroundColor: c.hex }}
                                title={c.name}
                              >
                                {newSchedColor === c.id && <Check className="w-2.5 h-2.5 text-white" />}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="submit"
                          disabled={savingSchedInProfile}
                          className="flex-1 rounded-xl bg-purple-600 hover:bg-purple-500 py-1.5 text-xs font-bold text-white transition disabled:opacity-50 cursor-pointer shadow"
                        >
                          {savingSchedInProfile ? 'جارٍ الحفظ...' : 'حفظ الموعد بالجدول'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowAddScheduleInsideProfile(false)}
                          className="px-3 rounded-xl bg-slate-800 hover:bg-slate-700 py-1.5 text-xs font-semibold text-slate-300 transition cursor-pointer"
                        >
                          إلغاء
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Form for editing a specific schedule slot */}
                  {editingScheduleSlot && (
                    <form
                      onSubmit={handleSaveEditScheduleSlot}
                      className="p-3 rounded-2xl bg-slate-900 border border-amber-500/40 space-y-2.5 text-right shadow-md"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-amber-300 flex items-center gap-1">
                          <Edit2 className="w-3.5 h-3.5" />
                          <span>تعديل موعد الحصة</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => setEditingScheduleSlot(null)}
                          className="p-1 rounded-lg text-slate-400 hover:text-white"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        {/* Day */}
                        <div>
                          <label className="block text-[10px] text-slate-400 mb-1">اليوم</label>
                          <select
                            value={editSchedDay}
                            onChange={(e) => setEditSchedDay(Number(e.target.value))}
                            className="w-full rounded-xl bg-slate-950 border border-slate-700 px-2 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400 cursor-pointer"
                          >
                            {WEEK_DAYS.map((d) => (
                              <option key={d.dayIndex} value={d.dayIndex}>
                                {d.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Start Time */}
                        <div>
                          <label className="block text-[10px] text-slate-400 mb-1">وقت البداية</label>
                          <select
                            value={editSchedTime}
                            onChange={(e) => setEditSchedTime(e.target.value)}
                            className="w-full rounded-xl bg-slate-950 border border-slate-700 px-2 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400 cursor-pointer"
                          >
                            {TIME_SLOTS.map((t) => (
                              <option key={t.time24} value={t.time24}>
                                {t.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Duration */}
                        <div>
                          <label className="block text-[10px] text-slate-400 mb-1">المدة</label>
                          <select
                            value={editSchedDuration}
                            onChange={(e) => setEditSchedDuration(Number(e.target.value))}
                            className="w-full rounded-xl bg-slate-950 border border-slate-700 px-2 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400 cursor-pointer"
                          >
                            {DURATION_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] text-slate-400 mb-1">نوع الحصة</label>
                          <select
                            value={editSchedClassType}
                            onChange={(e) => setEditSchedClassType(e.target.value as ClassType)}
                            className="w-full rounded-xl bg-slate-950 border border-slate-700 px-2 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400 cursor-pointer"
                          >
                            <option value="private">برايفيت (خاص)</option>
                            <option value="online">أونلاين</option>
                            <option value="center">سنتر / مجموعة</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[10px] text-slate-400 mb-1">لون الحصة في الجدول</label>
                          <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
                            {CLASS_COLORS.map((c) => (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => setEditSchedColor(c.id)}
                                className={`w-5 h-5 rounded-full border transition cursor-pointer flex-shrink-0 flex items-center justify-center ${
                                  editSchedColor === c.id
                                    ? 'border-white scale-110 shadow'
                                    : 'border-transparent opacity-60 hover:opacity-100'
                                }`}
                                style={{ backgroundColor: c.hex }}
                                title={c.name}
                              >
                                {editSchedColor === c.id && <Check className="w-2.5 h-2.5 text-white" />}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="submit"
                          disabled={savingSchedInProfile}
                          className="flex-1 rounded-xl bg-amber-600 hover:bg-amber-500 py-1.5 text-xs font-bold text-white transition disabled:opacity-50 cursor-pointer shadow"
                        >
                          {savingSchedInProfile ? 'جارٍ الحفظ...' : 'حفظ التعديلات في الجدول'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingScheduleSlot(null)}
                          className="px-3 rounded-xl bg-slate-800 hover:bg-slate-700 py-1.5 text-xs font-semibold text-slate-300 transition cursor-pointer"
                        >
                          إلغاء
                        </button>
                      </div>
                    </form>
                  )}

                  {/* List of Student Schedules */}
                  {studentSchedules.length === 0 ? (
                    <div className="py-3 px-3 text-center rounded-xl bg-slate-900/60 border border-dashed border-slate-700/80">
                      <p className="text-xs text-slate-400">
                        لا توجد مواعيد محددة لهذا الطالب في الجدول الأسبوعي حالياً.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setShowAddScheduleInsideProfile(true);
                          setNewSchedColor(selectedProfileStudent.color || 'purple');
                        }}
                        className="mt-2 inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/40 text-purple-200 text-xs font-bold transition cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>+ إضافة موعد للحصة الآن</span>
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {isManagingSchedules && (
                        <p className="text-[11px] text-amber-300/90 bg-amber-950/40 border border-amber-500/30 p-2 rounded-xl">
                          اضغط على أيقونة التعديل ✏️ لتعديل موعد الحصة أو مدتها، أو أيقونة السلة 🗑️ لحذف الموعد من الجدول.
                        </p>
                      )}
                      {studentSchedules.map((slot) => {
                        const colorInfo = getColorStyle(slot.color || selectedProfileStudent.color);
                        return (
                          <div
                            key={slot.id}
                            className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-purple-500/40 transition group"
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className="w-3 h-3 rounded-full flex-shrink-0 shadow-sm"
                                style={{ backgroundColor: colorInfo.hex }}
                              />
                              <span className="text-xs font-medium text-slate-100">
                                {formatScheduleDisplayArabic(slot)}
                              </span>
                            </div>

                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleStartEditScheduleSlot(slot)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-amber-300 hover:bg-slate-800 transition cursor-pointer"
                                title="تعديل الموعد"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteScheduleSlot(slot.id)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition cursor-pointer"
                                title="حذف الموعد"
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
              );
            })()}

            {/* Add Lesson Form inside profile */}
            {showAddLessonInsideProfile && (
              <form onSubmit={handleAddLessonSubmit} className="p-3 rounded-2xl bg-slate-800/90 border border-purple-500/30 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-300">تسجيل حصة لهذا الطالب</span>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setNewLessonRating(star)}
                        className="cursor-pointer"
                      >
                        <Star
                          className={`w-4 h-4 ${
                            star <= newLessonRating ? 'text-amber-400 fill-amber-400' : 'text-slate-600'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-1.5">
                  {(['present', 'absent', 'excused'] as const).map((a) => (
                    <button
                      key={a}
                      type="button"
                      onClick={() => setNewLessonAttendance(a)}
                      className={`py-1 rounded-lg text-[10px] font-bold border transition cursor-pointer ${
                        newLessonAttendance === a
                          ? 'bg-purple-600 border-purple-400 text-white'
                          : 'bg-slate-700/60 border-slate-600 text-slate-300'
                      }`}
                    >
                      {a === 'present' ? 'حاضر ✅' : a === 'absent' ? 'غائب ❌' : 'معتذر ⚠️'}
                    </button>
                  ))}
                </div>

                <input
                  type="text"
                  value={newLessonTopic}
                  onChange={(e) => setNewLessonTopic(e.target.value)}
                  placeholder="ما تم شرحه اليوم بالتفصيل..."
                  required
                  className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-1.5 text-xs text-white focus:outline-none focus:border-purple-400"
                />

                <input
                  type="text"
                  value={newLessonHomework}
                  onChange={(e) => setNewLessonHomework(e.target.value)}
                  placeholder="الواجب المطلوب للمرة القادمة..."
                  className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-1.5 text-xs text-white focus:outline-none focus:border-purple-400"
                />

                <button
                  type="submit"
                  className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-500 py-1.5 text-xs font-bold text-white transition cursor-pointer"
                >
                  حفظ الحصة في السجل
                </button>
              </form>
            )}

            {/* Attendance & Lessons History List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-0.5 min-h-[140px]">
              <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-purple-400" />
                <span>سجل الحصص السابقة ({studentLessons.length})</span>
              </h4>

              {studentLessons.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400 bg-slate-950/40 rounded-xl border border-slate-800">
                  لا توجد حصص مسجلة لهذا الطالب حتى الآن.
                </div>
              ) : (
                studentLessons.map((l) => (
                  <div
                    key={l.id}
                    className="rounded-xl bg-slate-800/60 border border-slate-700/60 p-3 space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-purple-300 font-bold">{l.date}</span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                            l.attendance === 'present'
                              ? 'bg-emerald-950 border border-emerald-500/30 text-emerald-400'
                              : l.attendance === 'absent'
                              ? 'bg-rose-950 border border-rose-500/30 text-rose-400'
                              : 'bg-amber-950 border border-amber-500/30 text-amber-400'
                          }`}
                        >
                          {l.attendance === 'present' ? 'حاضر' : l.attendance === 'absent' ? 'غائب' : 'معتذر'}
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        {l.rating && (
                          <div className="flex items-center text-amber-400 text-xs">
                            {'★'.repeat(l.rating)}
                          </div>
                        )}
                        <button
                          onClick={() => deleteLessonLog(profile.id, selectedProfileStudent.id, l.id)}
                          className="p-1 text-slate-500 hover:text-rose-400 transition cursor-pointer"
                          title="حذف هذا السجل"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    <p className="text-xs text-slate-200">
                      <strong className="text-purple-300">الشرح: </strong>
                      {l.topic}
                    </p>

                    {l.homework && (
                      <p className="text-xs text-slate-300">
                        <strong className="text-amber-300">الواجب: </strong>
                        {l.homework}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: MONTHLY REPORT FOR PARENTS */}
      {showMonthlyReportModal && selectedProfileStudent && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-emerald-500/40 rounded-3xl p-5 shadow-2xl text-right max-h-[90vh] flex flex-col space-y-3">
            <div className="flex items-center justify-between border-b border-emerald-900/40 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white">تقرير الشهر لولي الأمر</h3>
              </div>
              <button
                onClick={() => setShowMonthlyReportModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300">
              تقرير جاهز ومنسق بناءً على حصص وتقييمات الشهر الحالي ({currentMonthName}) لإرساله بضغطة زر:
            </p>

            {/* Report Preview Box */}
            <div className="flex-1 overflow-y-auto bg-slate-950/80 border border-slate-800 rounded-2xl p-3.5 text-xs text-slate-200 font-mono whitespace-pre-wrap leading-relaxed select-text">
              {generateMonthlyReportText()}
            </div>

            {/* Actions */}
            <div className="space-y-2 pt-1">
              <button
                onClick={handleSendMonthlyReport}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition cursor-pointer shadow-lg shadow-emerald-950/50"
              >
                <Send className="w-4 h-4" />
                <span>إرسال التقرير عبر واتساب الآن</span>
              </button>

              <button
                onClick={handleCopyReport}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition cursor-pointer"
              >
                {copiedReport ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                <span>{copiedReport ? 'تم نسخ التقرير بنجاح!' : 'نسخ نص التقرير'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
