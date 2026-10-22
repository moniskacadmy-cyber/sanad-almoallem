import React, { useState, useEffect, useMemo } from 'react';
import {
  Group,
  Student,
  EducationalCenter,
  GroupMembership,
  GroupScheduleItem,
  TeacherProfile,
  ScheduleSlot,
} from '../types';
import {
  subscribeToGroups,
  subscribeToCenters,
  subscribeToMemberships,
  subscribeToStudents,
  subscribeToSchedules,
  addGroup,
  addCenter,
  addStudent,
  archiveGroup,
  normalizeArabicText,
} from '../firebase';
import { hasConflict } from '../services/conflictService';
import { GroupDetailsModal } from './GroupDetailsModal';
import { useBackHandler } from '../services/backHandler';
import {
  Users,
  User,
  Plus,
  X,
  Building2,
  BookOpen,
  GraduationCap,
  Calendar,
  Clock,
  DollarSign,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  Trash2,
  ChevronRight,
  Palette,
  Check,
  Sparkles,
  Phone,
  MessageCircle,
  HelpCircle,
} from 'lucide-react';

export interface GroupManagementTabProps {
  teacherId: string;
  profile?: TeacherProfile;
  currency?: string;
  defaultSubject?: string;
  initialGroups?: Group[];
  initialStudents?: Student[];
  onSelectStudent?: (student: Student) => void;
  onOpenAddStudent?: () => void;
  onOpenAddGroup?: () => void;
}

const COMMON_SUBJECTS = [
  'القرآن الكريم',
  'اللغة العربية',
  'الرياضيات',
  'العلوم',
  'اللغة الإنجليزية',
  'الفيزياء',
  'الكيمياء',
  'الأحياء',
  'التاريخ',
  'الجغرافيا',
  'الدراسات الاجتماعية',
  'الفرنساوي',
  'الألماني',
  'الحاسب الآلي',
  'أخرى',
];

const COMMON_GRADES = [
  'الرابع الابتدائي',
  'الخامس الابتدائي',
  'السادس الابتدائي',
  'الأول الإعدادي',
  'الثاني الإعدادي',
  'الثالث الإعدادي',
  'الأول الثانوي',
  'الثاني الثانوي',
  'الثالث الثانوي',
  'جامعي',
  'عام / دورة تدريبية',
];

const WEEK_DAYS = [
  { index: 6, name: 'السبت' },
  { index: 0, name: 'الأحد' },
  { index: 1, name: 'الإثنين' },
  { index: 2, name: 'الثلاثاء' },
  { index: 3, name: 'الأربعاء' },
  { index: 4, name: 'الخميس' },
  { index: 5, name: 'الجمعة' },
];

const WEEK_DAYS_NAMES: Record<number, string> = {
  0: 'الأحد',
  1: 'الإثنين',
  2: 'الثلاثاء',
  3: 'الأربعاء',
  4: 'الخميس',
  5: 'الجمعة',
  6: 'السبت',
};

const PALETTE_COLORS = [
  '#7c3aed', // Purple
  '#2563eb', // Blue
  '#059669', // Emerald
  '#d97706', // Amber
  '#e11d48', // Rose
  '#0891b2', // Cyan
  '#4f46e5', // Indigo
  '#be185d', // Pink
];

export const GroupManagementTab: React.FC<GroupManagementTabProps> = ({
  teacherId,
  profile,
  currency = profile?.currency || 'ج.م',
  defaultSubject = profile?.subject || 'اللغة العربية',
  initialGroups,
  initialStudents,
  onSelectStudent,
  onOpenAddStudent,
  onOpenAddGroup,
}) => {
  // Tabs: 'groups' or 'individuals'
  const [activeTab, setActiveTab] = useState<'groups' | 'individuals'>('groups');

  // Real-time Firestore State
  const [groups, setGroups] = useState<Group[]>(initialGroups || []);
  const [students, setStudents] = useState<Student[]>(initialStudents || []);
  const [centers, setCenters] = useState<EducationalCenter[]>([]);
  const [memberships, setMemberships] = useState<GroupMembership[]>([]);
  const [schedules, setSchedules] = useState<ScheduleSlot[]>([]);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCenterFilter, setSelectedCenterFilter] = useState('all');
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState('all');
  const [selectedGradeFilter, setSelectedGradeFilter] = useState('all');
  const [showFiltersBar, setShowFiltersBar] = useState(false);

  // Modals state
  const [showChoiceModal, setShowChoiceModal] = useState(false);
  const [showAddGroupModal, setShowAddGroupModal] = useState(false);
  const [showAddIndividualModal, setShowAddIndividualModal] = useState(false);
  const [selectedGroupForDetails, setSelectedGroupForDetails] = useState<Group | null>(null);

  // Register modals on back handler stack so mobile back closes them
  useBackHandler(showChoiceModal, () => setShowChoiceModal(false), 'gm_choice_modal');
  useBackHandler(showAddGroupModal, () => setShowAddGroupModal(false), 'gm_add_group_modal');
  useBackHandler(showAddIndividualModal, () => setShowAddIndividualModal(false), 'gm_add_individual_modal');
  useBackHandler(!!selectedGroupForDetails, () => setSelectedGroupForDetails(null), 'gm_group_details_modal');

  // Toast Notifications
  const [toast, setToast] = useState<{ message: string; isError?: boolean } | null>(null);

  const showToast = (message: string, isError = false) => {
    setToast({ message, isError });
    setTimeout(() => {
      setToast((curr) => (curr?.message === message ? null : curr));
    }, 4000);
  };

  // -------------------------------------------------------------
  // Group Creation Form State
  // -------------------------------------------------------------
  const [groupName, setGroupName] = useState('');
  const [groupCenterName, setGroupCenterName] = useState('');
  const [groupSubject, setGroupSubject] = useState(defaultSubject || 'اللغة العربية');
  const [groupCustomSubject, setGroupCustomSubject] = useState('');
  const [groupGrade, setGroupGrade] = useState('الثالث الإعدادي');
  const [groupMonthlyFee, setGroupMonthlyFee] = useState<string>('300');
  const [groupColor, setGroupColor] = useState('#7c3aed');
  const [groupNotes, setGroupNotes] = useState('');
  const [groupSchedule, setGroupSchedule] = useState<GroupScheduleItem[]>([
    { day: 6, time: '17:00', duration: 90 },
    { day: 2, time: '17:00', duration: 90 },
  ]);
  const [isSubmittingGroup, setIsSubmittingGroup] = useState(false);
  const [groupFormError, setGroupFormError] = useState<string | null>(null);

  // -------------------------------------------------------------
  // Individual Student Creation Form State
  // -------------------------------------------------------------
  const [individualName, setIndividualName] = useState('');
  const [individualPhone, setIndividualPhone] = useState('');
  const [individualSubject, setIndividualSubject] = useState(defaultSubject || 'اللغة العربية');
  const [individualHourlyRate, setIndividualHourlyRate] = useState<string>('100');
  const [individualClassType, setIndividualClassType] = useState<'private' | 'online'>('private');
  const [individualNotes, setIndividualNotes] = useState('');
  const [isSubmittingIndividual, setIsSubmittingIndividual] = useState(false);
  const [individualFormError, setIndividualFormError] = useState<string | null>(null);

  // -------------------------------------------------------------
  // Firestore Subscriptions
  // -------------------------------------------------------------
  useEffect(() => {
    if (!teacherId) return;

    const unsubGroups = subscribeToGroups(teacherId, (items) => {
      setGroups(items);
    });

    const unsubCenters = subscribeToCenters(teacherId, (items) => {
      setCenters(items);
    });

    const unsubMemberships = subscribeToMemberships(teacherId, (items) => {
      setMemberships(items);
    });

    const unsubStudents = subscribeToStudents(teacherId, (items) => {
      setStudents(items);
    });

    const unsubSchedules = subscribeToSchedules(teacherId, (items) => {
      setSchedules(items);
    });

    return () => {
      unsubGroups();
      unsubCenters();
      unsubMemberships();
      unsubStudents();
      unsubSchedules();
    };
  }, [teacherId]);

  // Keep selectedGroupForDetails in sync with real-time updates
  useEffect(() => {
    if (selectedGroupForDetails) {
      const refreshed = groups.find((g) => g.id === selectedGroupForDetails.id);
      if (refreshed) {
        setSelectedGroupForDetails(refreshed);
      }
    }
  }, [groups]);

  // Student counts per group
  const groupStudentCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const g of groups) {
      const activeMembers = memberships.filter((m) => m.groupId === g.id && m.active);
      const studentMatches = students.filter(
        (s) => !s.archived && s.groupIds && s.groupIds.includes(g.id)
      );
      counts[g.id] = Math.max(activeMembers.length, studentMatches.length);
    }
    return counts;
  }, [groups, memberships, students]);

  // Center suggestions for dropdown
  const centerSuggestions = useMemo(() => {
    const set = new Set<string>();
    centers.forEach((c) => {
      if (c.name) set.add(c.name.trim());
    });
    groups.forEach((g) => {
      if (g.centerName) set.add(g.centerName.trim());
    });
    return Array.from(set).filter(Boolean);
  }, [centers, groups]);

  // Active (non-archived) groups
  const activeGroups = useMemo(() => {
    return groups.filter((g) => !g.archived);
  }, [groups]);

  // Filtered Groups
  const filteredGroups = useMemo(() => {
    return activeGroups.filter((g) => {
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchName = (g.name || '').toLowerCase().includes(q);
        const matchCenter = (g.centerName || '').toLowerCase().includes(q);
        const matchSubject = (g.subject || '').toLowerCase().includes(q);
        if (!matchName && !matchCenter && !matchSubject) return false;
      }
      if (selectedCenterFilter !== 'all' && g.centerName !== selectedCenterFilter) {
        return false;
      }
      if (selectedSubjectFilter !== 'all' && g.subject !== selectedSubjectFilter) {
        return false;
      }
      if (selectedGradeFilter !== 'all' && g.grade !== selectedGradeFilter) {
        return false;
      }
      return true;
    });
  }, [activeGroups, searchQuery, selectedCenterFilter, selectedSubjectFilter, selectedGradeFilter]);

  // Individual Students (solo or without group)
  const individualStudents = useMemo(() => {
    return students.filter((s) => {
      if (s.archived) return false;
      const isSolo =
        s.isIndividual ||
        !s.groupIds ||
        s.groupIds.length === 0 ||
        s.classType === 'private' ||
        s.classType === 'online';
      return isSolo;
    });
  }, [students]);

  // Filtered Individual Students
  const filteredIndividualStudents = useMemo(() => {
    return individualStudents.filter((s) => {
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchName = (s.name || '').toLowerCase().includes(q);
        const matchPhone = (s.phone || s.whatsapp || '').includes(q);
        const matchSubject = (s.subject || '').toLowerCase().includes(q);
        if (!matchName && !matchPhone && !matchSubject) return false;
      }
      if (selectedSubjectFilter !== 'all' && s.subject !== selectedSubjectFilter) {
        return false;
      }
      return true;
    });
  }, [individualStudents, searchQuery, selectedSubjectFilter]);

  // -------------------------------------------------------------
  // Schedule Slot Management for Group Form
  // -------------------------------------------------------------
  const handleAddScheduleSlot = () => {
    setGroupSchedule((prev) => [...prev, { day: 0, time: '16:00', duration: 90 }]);
  };

  const handleRemoveScheduleSlot = (idx: number) => {
    setGroupSchedule((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleUpdateScheduleSlot = (idx: number, updates: Partial<GroupScheduleItem>) => {
    setGroupSchedule((prev) =>
      prev.map((slot, i) => (i === idx ? { ...slot, ...updates } : slot))
    );
  };

  // -------------------------------------------------------------
  // Group Submission Handler
  // -------------------------------------------------------------
  const handleCreateGroupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingGroup) return;

    setGroupFormError(null);
    const cleanName = groupName.trim();
    const cleanCenter = groupCenterName.trim();
    const cleanSubject = groupSubject === 'أخرى' ? groupCustomSubject.trim() : groupSubject.trim();
    const feeNum = parseFloat(groupMonthlyFee);

    if (!cleanName) {
      setGroupFormError('يرجى كتابة اسم المجموعة (مثال: مجموعة أبطال الرياضيات)');
      return;
    }
    if (!cleanCenter) {
      setGroupFormError('يرجى كتابة أو اختيار اسم السنتر / القاعة');
      return;
    }
    if (!cleanSubject) {
      setGroupFormError('يرجى تحديد المادة الدراسية');
      return;
    }
    if (isNaN(feeNum) || feeNum < 0) {
      setGroupFormError('يرجى تحديد اشتراك الشهر بشكل صحيح (0 أو أكثر)');
      return;
    }

    // Check for schedule conflicts with teacher's other individual and group classes
    const existingGroupSlots: ScheduleSlot[] = groups
      .filter((g) => g.status !== 'archived')
      .flatMap((g) =>
        (g.schedule || []).map((slot, idx) => ({
          id: `group_${g.id}_${idx}`,
          teacherId,
          studentId: `group_${g.id}`,
          studentName: `مجموعة ${g.name}`,
          dayOfWeek: slot.day,
          time: slot.time,
          duration: slot.duration || 90,
          recurrence: 'weekly' as const,
          classType: 'center' as const,
          color: g.color || '#8b5cf6',
        }))
      );
    const allExistingSlots = [...schedules, ...existingGroupSlots];

    for (const slot of groupSchedule) {
      const conflictRes = hasConflict(
        {
          dayOfWeek: Number(slot.day),
          time: slot.time,
          duration: Number(slot.duration) || 90,
          studentName: cleanName,
        },
        allExistingSlots
      );

      if (conflictRes.hasConflict) {
        setGroupFormError(
          conflictRes.message || 'عفواً، لديك حصة أو مجموعة أخرى في نفس هذا الموعد'
        );
        return;
      }
    }

    setIsSubmittingGroup(true);
    try {
      // 1. Ensure Center exists
      let targetCenter = centers.find(
        (c) => !c.archived && normalizeArabicText(c.name || '') === normalizeArabicText(cleanCenter)
      );
      let centerId = targetCenter?.id;
      if (!centerId) {
        centerId = await addCenter(teacherId, cleanCenter);
      }

      // 2. Add Group
      const newGroupId = await addGroup(teacherId, {
        name: cleanName,
        centerId: centerId || 'center_default',
        centerName: cleanCenter,
        subject: cleanSubject,
        grade: groupGrade.trim(),
        schedule: groupSchedule,
        monthlyFee: feeNum,
        color: groupColor,
        status: 'active',
        notes: groupNotes.trim(),
      });

      // Reset form
      setGroupName('');
      setGroupCenterName('');
      setGroupMonthlyFee('300');
      setGroupNotes('');
      setShowAddGroupModal(false);
      showToast(`تم إنشاء المجموعة "${cleanName}" بنجاح! 🎉`);

      // Optionally select the new group
      const created = groups.find((g) => g.id === newGroupId);
      if (created) setSelectedGroupForDetails(created);
    } catch (err: any) {
      console.error('Error creating group:', err);
      setGroupFormError(err.message || 'حدث خطأ أثناء حفظ المجموعة، يرجى المحاولة مرة أخرى.');
    } finally {
      setIsSubmittingGroup(false);
    }
  };

  // -------------------------------------------------------------
  // Individual Student Submission Handler
  // -------------------------------------------------------------
  const handleCreateIndividualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingIndividual) return;

    setIndividualFormError(null);
    const cleanName = individualName.trim();
    const cleanPhone = individualPhone.trim();
    const rateNum = parseFloat(individualHourlyRate);

    if (!cleanName) {
      setIndividualFormError('يرجى كتابة اسم الطالب');
      return;
    }
    if (isNaN(rateNum) || rateNum < 0) {
      setIndividualFormError('يرجى تحديد سعر الساعة بشكل صحيح');
      return;
    }

    setIsSubmittingIndividual(true);
    try {
      await addStudent(teacherId, {
        name: cleanName,
        whatsapp: cleanPhone,
        phone: cleanPhone,
        subject: individualSubject,
        classType: individualClassType,
        hourlyRate: rateNum,
        notes: individualNotes.trim(),
        isIndividual: true,
      });

      setIndividualName('');
      setIndividualPhone('');
      setIndividualNotes('');
      setShowAddIndividualModal(false);
      showToast(`تم إضافة الطالب "${cleanName}" بنجاح! 🎉`);
    } catch (err: any) {
      console.error('Error creating student:', err);
      setIndividualFormError(err.message || 'حدث خطأ أثناء إضافة الطالب');
    } finally {
      setIsSubmittingIndividual(false);
    }
  };

  return (
    <div className="space-y-4 relative pb-24" dir="rtl">
      {/* Toast Notification Alert */}
      {toast && (
        <div
          className={`fixed top-4 left-1/2 -translate-x-1/2 z-[100] max-w-sm w-full mx-auto p-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-top duration-300 border ${
            toast.isError
              ? 'bg-rose-950/95 border-rose-500/80 text-rose-200'
              : 'bg-emerald-950/95 border-emerald-500/80 text-emerald-200'
          }`}
        >
          {toast.isError ? (
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-400" />
          ) : (
            <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-400" />
          )}
          <span className="text-xs font-bold flex-1">{toast.message}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="text-slate-400 hover:text-white text-xs p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TABS HEADER: 'المجموعات' vs 'الطلاب الفرديين'                 */}
      {/* ------------------------------------------------------------- */}
      <div className="flex items-center justify-between gap-2 border-b border-purple-900/30 pb-3">
        <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-inner w-full sm:w-auto">
          {/* Tab 1: Groups */}
          <button
            type="button"
            onClick={() => setActiveTab('groups')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 py-2 px-4 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeTab === 'groups'
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-950/40 scale-[1.02]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>المجموعات (السناتر)</span>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                activeTab === 'groups'
                  ? 'bg-purple-900/80 text-purple-200'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              {activeGroups.length}
            </span>
          </button>

          {/* Tab 2: Individual Students */}
          <button
            type="button"
            onClick={() => setActiveTab('individuals')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 py-2 px-4 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeTab === 'individuals'
                ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-lg shadow-indigo-950/40 scale-[1.02]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <User className="w-4 h-4" />
            <span>الطلاب الفرديين</span>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                activeTab === 'individuals'
                  ? 'bg-indigo-900/80 text-indigo-200'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              {individualStudents.length}
            </span>
          </button>
        </div>

        {/* Quick Add Button in Header */}
        <button
          type="button"
          onClick={() => setShowChoiceModal(true)}
          className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-md shadow-purple-950/40 transition active:scale-95 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>إضافة جديدة</span>
        </button>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* Search & Filter Bar                                           */}
      {/* ------------------------------------------------------------- */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                activeTab === 'groups'
                  ? 'بحث باسم المجموعة، السنتر، أو المادة...'
                  : 'بحث باسم الطالب، المادة، أو رقم الهاتف...'
              }
              className="w-full rounded-2xl bg-slate-900/90 border border-slate-700/80 px-4 py-2.5 pr-10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-400 transition"
            />
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute left-3 top-2.5 text-slate-400 hover:text-white text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* Filter Toggle */}
          <button
            type="button"
            onClick={() => setShowFiltersBar((prev) => !prev)}
            className={`p-2.5 rounded-2xl border transition cursor-pointer flex items-center gap-1.5 text-xs font-bold ${
              showFiltersBar
                ? 'bg-purple-950/60 border-purple-500/50 text-purple-300'
                : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
            }`}
            title="تصفية وفلاتر متقدمة"
          >
            <Filter className="w-4 h-4" />
          </button>
        </div>

        {/* Collapsible Filter Dropdowns */}
        {showFiltersBar && (
          <div className="p-3 rounded-2xl bg-slate-900/90 border border-purple-500/20 space-y-2.5 animate-in fade-in duration-150">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {activeTab === 'groups' && (
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">السنتر:</label>
                  <select
                    value={selectedCenterFilter}
                    onChange={(e) => setSelectedCenterFilter(e.target.value)}
                    className="w-full rounded-xl bg-slate-950 border border-slate-800 px-2.5 py-1.5 text-xs text-white"
                  >
                    <option value="all">جميع السناتر</option>
                    {centerSuggestions.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">المادة الدراسية:</label>
                <select
                  value={selectedSubjectFilter}
                  onChange={(e) => setSelectedSubjectFilter(e.target.value)}
                  className="w-full rounded-xl bg-slate-950 border border-slate-800 px-2.5 py-1.5 text-xs text-white"
                >
                  <option value="all">جميع المواد</option>
                  {COMMON_SUBJECTS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              {activeTab === 'groups' && (
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">الصف الدراسي:</label>
                  <select
                    value={selectedGradeFilter}
                    onChange={(e) => setSelectedGradeFilter(e.target.value)}
                    className="w-full rounded-xl bg-slate-950 border border-slate-800 px-2.5 py-1.5 text-xs text-white"
                  >
                    <option value="all">جميع الصفوف</option>
                    {COMMON_GRADES.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                setSelectedCenterFilter('all');
                setSelectedSubjectFilter('all');
                setSelectedGradeFilter('all');
                setSearchQuery('');
              }}
              className="text-[11px] text-purple-400 hover:text-purple-300 font-bold"
            >
              إعادة ضبط الفلاتر ↺
            </button>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* VIEW 1: GROUPS TAB                                            */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'groups' && (
        <div className="space-y-3">
          {filteredGroups.length === 0 ? (
            <div className="p-8 rounded-3xl bg-slate-900/60 border border-purple-500/20 text-center space-y-3">
              <div className="w-14 h-14 rounded-3xl bg-purple-600/20 text-purple-300 flex items-center justify-center mx-auto border border-purple-500/30 shadow-inner">
                <Users className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-extrabold text-white">
                  {groups.length === 0 ? 'لا توجد أي مجموعات بعد' : 'لا توجد نتائج مطابقة للبحث'}
                </h4>
                <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
                  أنشئ أول مجموعة دراسية وحدد السنتر والمواعيد الأسبوعية وقيمة الاشتراك الشهري.
                </p>
              </div>

              {groups.length === 0 && (
                <button
                  type="button"
                  onClick={() => setShowAddGroupModal(true)}
                  className="mt-2 inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-black shadow-lg shadow-purple-950/40 transition active:scale-95 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>إنشاء أول مجموعة الآن</span>
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filteredGroups.map((group) => {
                const count = groupStudentCounts[group.id] || 0;
                const accentColor = group.color || '#7c3aed';

                return (
                  <div
                    key={group.id}
                    onClick={() => setSelectedGroupForDetails(group)}
                    style={{ borderRightColor: accentColor, borderRightWidth: '4px' }}
                    className="p-4 rounded-3xl bg-slate-900/90 border border-slate-800 hover:border-purple-500/40 transition space-y-3 cursor-pointer active:scale-[0.99] shadow-lg shadow-slate-950/40 relative overflow-hidden group"
                  >
                    {/* Top Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div
                          style={{ backgroundColor: `${accentColor}25`, color: accentColor }}
                          className="w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-sm border border-purple-500/20 shadow-inner flex-shrink-0"
                        >
                          <Users className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-sm font-black text-white group-hover:text-purple-300 transition-colors">
                            {group.name}
                          </h4>
                          <span className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                            <Building2 className="w-3 h-3 text-purple-400" />
                            {group.centerName}
                          </span>
                        </div>
                      </div>

                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                          group.status === 'active'
                            ? 'bg-emerald-950/90 text-emerald-300 border border-emerald-500/30'
                            : 'bg-amber-950/90 text-amber-300 border border-amber-500/30'
                        }`}
                      >
                        {group.status === 'active' ? 'نشطة' : 'متوقفة'}
                      </span>
                    </div>

                    {/* Chips: Subject & Grade */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] px-2.5 py-0.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 flex items-center gap-1">
                        <BookOpen className="w-3 h-3 text-indigo-400" />
                        {group.subject}
                      </span>
                      {group.grade && (
                        <span className="text-[10px] px-2.5 py-0.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 flex items-center gap-1">
                          <GraduationCap className="w-3 h-3 text-amber-400" />
                          {group.grade}
                        </span>
                      )}
                    </div>

                    {/* Schedule Time Chips */}
                    {group.schedule && group.schedule.length > 0 && (
                      <div className="flex items-center gap-1 flex-wrap">
                        {group.schedule.map((slot, idx) => (
                          <span
                            key={idx}
                            className="text-[10px] px-2 py-0.5 rounded-lg bg-purple-950/40 text-purple-300 border border-purple-500/20 font-mono flex items-center gap-0.5"
                          >
                            <Clock className="w-2.5 h-2.5" />
                            {WEEK_DAYS_NAMES[slot.day] || ''} {slot.time}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Bottom Row: Students Count & Monthly Fee */}
                    <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                      <span className="text-slate-400 flex items-center gap-1 font-bold">
                        <Users className="w-3.5 h-3.5 text-purple-400" />
                        <strong className="text-white font-mono">{count}</strong> طلاب
                      </span>

                      <div className="flex items-center gap-1">
                        <span className="text-emerald-400 font-mono font-bold">
                          {group.monthlyFee} {currency}
                        </span>
                        <span className="text-[10px] text-slate-400">/ شهر</span>
                        <ChevronRight className="w-4 h-4 text-purple-400 rotate-180 mr-1" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* VIEW 2: INDIVIDUAL STUDENTS TAB                               */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'individuals' && (
        <div className="space-y-3">
          {filteredIndividualStudents.length === 0 ? (
            <div className="p-8 rounded-3xl bg-slate-900/60 border border-indigo-500/20 text-center space-y-3">
              <div className="w-14 h-14 rounded-3xl bg-indigo-600/20 text-indigo-300 flex items-center justify-center mx-auto border border-indigo-500/30 shadow-inner">
                <User className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-extrabold text-white">
                  {individualStudents.length === 0
                    ? 'لا يوجد طلاب فرديين حالياً'
                    : 'لا توجد نتائج مطابقة للبحث'}
                </h4>
                <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
                  يمكنك إضافة طالب درس خصوصي مستقل بحساب الساعة أو الحصة.
                </p>
              </div>

              {individualStudents.length === 0 && (
                <button
                  type="button"
                  onClick={() => setShowAddIndividualModal(true)}
                  className="mt-2 inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black shadow-lg shadow-indigo-950/40 transition active:scale-95 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>إضافة طالب فردي الآن</span>
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filteredIndividualStudents.map((st) => (
                <div
                  key={st.id}
                  onClick={() => onSelectStudent && onSelectStudent(st)}
                  className="p-4 rounded-3xl bg-slate-900/90 border border-slate-800 hover:border-indigo-500/40 transition space-y-2.5 cursor-pointer active:scale-[0.99] shadow-md shadow-slate-950/30"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-2xl bg-indigo-600/20 text-indigo-300 flex items-center justify-center font-bold text-xs border border-indigo-500/30">
                        {st.name.charAt(0)}
                      </div>
                      <div>
                        <span className="text-xs font-bold text-white block">{st.name}</span>
                        <span className="text-[10px] text-slate-400">{st.subject}</span>
                      </div>
                    </div>

                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-950 border border-indigo-500/30 text-indigo-300 font-bold">
                      {st.classType === 'online' ? 'أونلاين 🌐' : 'خاص / منزلي 👤'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-800/80">
                    <span className="text-slate-400 text-[11px]">
                      الحساب: <strong className="text-white font-mono">{st.hourlyRate}</strong> {currency}/ساعة
                    </span>

                    {(st.phone || st.whatsapp) && (
                      <span className="text-slate-400 font-mono text-[10px]" dir="ltr">
                        {st.phone || st.whatsapp}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* FLOATING ACTION BUTTON (FAB)                                  */}
      {/* ------------------------------------------------------------- */}
      <div className="fixed bottom-20 left-5 sm:left-7 z-40">
        <button
          type="button"
          onClick={() => setShowChoiceModal(true)}
          className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-tr from-purple-600 via-indigo-600 to-purple-500 text-white flex items-center justify-center shadow-2xl shadow-purple-600/60 hover:shadow-purple-600/90 hover:scale-105 active:scale-95 transition-all cursor-pointer border-2 border-purple-400/50 group animate-in zoom-in-75 duration-200 focus:outline-none focus:ring-4 focus:ring-purple-500/40"
          title="إضافة جديدة"
          aria-label="إضافة جديدة (طالب فردي أو مجموعة)"
        >
          <Plus className="w-7 h-7 sm:w-8 sm:h-8 group-hover:rotate-90 transition-transform duration-300" />
        </button>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* MODAL 1: ADD CHOICE (نافذة اختيار: إضافة طالب فردي / إضافة مجموعة) */}
      {/* ------------------------------------------------------------- */}
      {showChoiceModal && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/85 backdrop-blur-md flex items-end sm:items-center justify-center p-3 sm:p-4 text-right animate-in fade-in duration-200"
          dir="rtl"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowChoiceModal(false);
          }}
        >
          <div className="w-full max-w-md bg-gradient-to-b from-slate-900 to-slate-950 border border-purple-500/30 rounded-3xl p-5 sm:p-6 shadow-2xl relative space-y-4 animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-purple-900/30 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-300 flex items-center justify-center border border-purple-500/30">
                  <Plus className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">إضافة جديدة</h3>
                  <p className="text-xs text-purple-300/70">اختر نوع التسجيل للبدء</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowChoiceModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/60 transition cursor-pointer"
                aria-label="إغلاق"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Selection Options: زرين كبيرين */}
            <div className="grid grid-cols-1 gap-3.5 py-1">
              {/* الزر الأول: إضافة طالب فردي */}
              <button
                type="button"
                onClick={() => {
                  setShowChoiceModal(false);
                  if (onOpenAddStudent) {
                    onOpenAddStudent();
                  } else {
                    setShowAddIndividualModal(true);
                  }
                }}
                className="group relative flex items-center gap-4 p-4.5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/40 border-2 border-slate-800 hover:border-indigo-500/60 hover:bg-slate-850 hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer text-right shadow-lg shadow-black/30"
              >
                <div className="w-14 h-14 rounded-2xl bg-indigo-600/20 text-indigo-300 flex items-center justify-center border border-indigo-500/30 group-hover:bg-indigo-600 group-hover:text-white group-hover:shadow-lg group-hover:shadow-indigo-600/40 transition-all shrink-0">
                  <User className="w-7 h-7" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-black text-white group-hover:text-indigo-300 transition-colors">
                      إضافة طالب فردي
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-bold">
                      خصوصي
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    تسجيل طالب فردي مستقل (درس خاص / منزلي / أونلاين) مع تحديد سعر الساعة والمادة.
                  </p>
                </div>
              </button>

              {/* الزر الثاني: إضافة مجموعة */}
              <button
                type="button"
                onClick={() => {
                  setShowChoiceModal(false);
                  if (onOpenAddGroup) {
                    onOpenAddGroup();
                  } else {
                    setShowAddGroupModal(true);
                  }
                }}
                className="group relative flex items-center gap-4 p-4.5 rounded-2xl bg-gradient-to-r from-purple-950/50 via-slate-900 to-slate-900 border-2 border-purple-500/40 hover:border-purple-400 hover:bg-purple-950/30 hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer text-right shadow-xl shadow-purple-950/30"
              >
                <div className="w-14 h-14 rounded-2xl bg-purple-600/30 text-purple-300 flex items-center justify-center border border-purple-500/40 group-hover:bg-purple-600 group-hover:text-white group-hover:shadow-lg group-hover:shadow-purple-600/40 transition-all shrink-0">
                  <Users className="w-7 h-7" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-black text-white group-hover:text-purple-300 transition-colors">
                      إضافة مجموعة
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/25 text-purple-300 border border-purple-500/40 font-bold">
                      سنتر / دفعة
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    إنشاء مجموعة دراسية في سنتر، مع جدول الحصص الأسبوعية واشتراك شهري ثابت.
                  </p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 2: GROUP CREATION INTERFACE (الاسم، السنتر، المادة، الصف، السعر، الجدول) */}
      {/* ------------------------------------------------------------- */}
      {showAddGroupModal && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 text-right animate-in fade-in duration-200"
          dir="rtl"
        >
          <div className="w-full max-w-lg bg-slate-900 border border-purple-500/30 rounded-3xl p-5 sm:p-6 shadow-2xl relative space-y-4 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-purple-900/30 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-2xl bg-purple-600/30 text-purple-300 flex items-center justify-center border border-purple-500/30">
                  <Users className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">إنشاء مجموعة جديدة (سنتر)</h3>
                  <p className="text-xs text-slate-400">بيانات المجموعة، المواعيد الأسبوعية، والاشتراك</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddGroupModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Error Message */}
            {groupFormError && (
              <div className="p-3 rounded-2xl bg-rose-950/80 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
                <span>{groupFormError}</span>
              </div>
            )}

            <form onSubmit={handleCreateGroupSubmit} className="space-y-4">
              {/* Field 1: الاسم (Group Name) */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-purple-400" />
                  اسم المجموعة <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="مثال: مجموعة أبطال الرياضيات، مجموعة التفوق..."
                  className="w-full rounded-2xl bg-slate-950 border border-slate-700/80 px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-400 transition"
                />
              </div>

              {/* Field 2: السنتر (Center Name) */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-purple-400" />
                  السنتر / القاعة التعليمية <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={groupCenterName}
                  onChange={(e) => setGroupCenterName(e.target.value)}
                  placeholder="مثال: سنتر الأوائل، قاعة النخبة، سنتر المستقبل..."
                  className="w-full rounded-2xl bg-slate-950 border border-slate-700/80 px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-400 transition"
                />

                {/* Suggestions Pills */}
                {centerSuggestions.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap mt-2">
                    <span className="text-[10px] text-slate-400">سناتر سابقة:</span>
                    {centerSuggestions.map((cName) => (
                      <button
                        key={cName}
                        type="button"
                        onClick={() => setGroupCenterName(cName)}
                        className={`text-[10px] px-2.5 py-0.5 rounded-full transition cursor-pointer border ${
                          groupCenterName === cName
                            ? 'bg-purple-600 text-white border-purple-500'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {cName}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Field 3 & 4: المادة (Subject) & الصف (Grade) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Subject */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1 flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-purple-400" />
                    المادة الدراسية <span className="text-rose-400">*</span>
                  </label>
                  <select
                    value={groupSubject}
                    onChange={(e) => setGroupSubject(e.target.value)}
                    className="w-full rounded-2xl bg-slate-950 border border-slate-700/80 px-3 py-2.5 text-xs text-white focus:outline-none focus:border-purple-400 transition"
                  >
                    {COMMON_SUBJECTS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>

                  {groupSubject === 'أخرى' && (
                    <input
                      type="text"
                      required
                      value={groupCustomSubject}
                      onChange={(e) => setGroupCustomSubject(e.target.value)}
                      placeholder="اكتب اسم المادة..."
                      className="mt-2 w-full rounded-2xl bg-slate-950 border border-purple-500/40 px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-400"
                    />
                  )}
                </div>

                {/* Grade */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1 flex items-center gap-1.5">
                    <GraduationCap className="w-3.5 h-3.5 text-purple-400" />
                    الصف الدراسي
                  </label>
                  <select
                    value={groupGrade}
                    onChange={(e) => setGroupGrade(e.target.value)}
                    className="w-full rounded-2xl bg-slate-950 border border-slate-700/80 px-3 py-2.5 text-xs text-white focus:outline-none focus:border-purple-400 transition"
                  >
                    {COMMON_GRADES.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Field 5: السعر (Price / Monthly fee) & اللون */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Monthly Fee */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1 flex items-center gap-1.5">
                    <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                    الاشتراك الشهري لكل طالب <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      required
                      value={groupMonthlyFee}
                      onChange={(e) => setGroupMonthlyFee(e.target.value)}
                      className="w-full rounded-2xl bg-slate-950 border border-slate-700/80 px-4 py-2.5 pl-14 text-xs text-white font-mono placeholder-slate-500 focus:outline-none focus:border-purple-400 transition"
                    />
                    <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-bold">
                      {currency}
                    </span>
                  </div>
                </div>

                {/* Group Color */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1 flex items-center gap-1.5">
                    <Palette className="w-3.5 h-3.5 text-purple-400" />
                    لون تمييز المجموعة
                  </label>
                  <div className="flex items-center gap-2 pt-1">
                    {PALETTE_COLORS.map((col) => (
                      <button
                        key={col}
                        type="button"
                        onClick={() => setGroupColor(col)}
                        style={{ backgroundColor: col }}
                        className={`w-7 h-7 rounded-xl transition-transform flex items-center justify-center cursor-pointer ${
                          groupColor === col ? 'scale-125 ring-2 ring-white shadow-lg' : 'opacity-70 hover:opacity-100'
                        }`}
                      >
                        {groupColor === col && <Check className="w-3.5 h-3.5 text-white" />}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Field 6: الجدول (Weekly Schedule Slots) */}
              <div className="space-y-2 p-3.5 rounded-2xl bg-slate-950/70 border border-purple-900/40">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-purple-400" />
                    <span className="text-xs font-bold text-white">الجدول الأسبوعي للمجموعة</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddScheduleSlot}
                    className="flex items-center gap-1 text-[11px] font-bold text-purple-400 hover:text-purple-300 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>إضافة موعد آخر</span>
                  </button>
                </div>

                {/* Slots Rows */}
                <div className="space-y-2 pt-1">
                  {groupSchedule.map((slot, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 p-2 rounded-xl bg-slate-900 border border-slate-800"
                    >
                      {/* Day */}
                      <select
                        value={slot.day}
                        onChange={(e) =>
                          handleUpdateScheduleSlot(idx, { day: parseInt(e.target.value) })
                        }
                        className="rounded-lg bg-slate-950 border border-slate-700 px-2 py-1.5 text-xs text-white"
                      >
                        {WEEK_DAYS.map((d) => (
                          <option key={d.index} value={d.index}>
                            {d.name}
                          </option>
                        ))}
                      </select>

                      {/* Time */}
                      <input
                        type="time"
                        value={slot.time}
                        onChange={(e) =>
                          handleUpdateScheduleSlot(idx, { time: e.target.value })
                        }
                        className="rounded-lg bg-slate-950 border border-slate-700 px-2 py-1 text-xs text-white font-mono"
                      />

                      {/* Duration */}
                      <select
                        value={slot.duration || 90}
                        onChange={(e) =>
                          handleUpdateScheduleSlot(idx, {
                            duration: parseInt(e.target.value),
                          })
                        }
                        className="rounded-lg bg-slate-950 border border-slate-700 px-2 py-1.5 text-xs text-white"
                      >
                        <option value={45}>45 دقيقة</option>
                        <option value={60}>60 دقيقة</option>
                        <option value={90}>90 دقيقة (ساعة ونصف)</option>
                        <option value={120}>120 دقيقة (ساعتان)</option>
                      </select>

                      {/* Remove Slot */}
                      {groupSchedule.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveScheduleSlot(idx)}
                          className="p-1 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 transition mr-auto"
                          title="حذف هذا الموعد"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Notes (Optional) */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  ملاحظات المجموعة (اختياري)
                </label>
                <textarea
                  rows={2}
                  value={groupNotes}
                  onChange={(e) => setGroupNotes(e.target.value)}
                  placeholder="أي تعليمات أو ملاحظات خاصة بطلاب هذه المجموعة..."
                  className="w-full rounded-2xl bg-slate-950 border border-slate-700/80 px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-400 transition"
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="submit"
                  disabled={isSubmittingGroup}
                  className="flex-1 py-3 px-4 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-black shadow-lg shadow-purple-950/50 transition active:scale-95 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                >
                  {isSubmittingGroup ? (
                    <span>جارٍ حفظ المجموعة...</span>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>حفظ وإنشاء المجموعة</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setShowAddGroupModal(false)}
                  className="py-3 px-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 3: INDIVIDUAL STUDENT CREATION INTERFACE                */}
      {/* ------------------------------------------------------------- */}
      {showAddIndividualModal && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 text-right animate-in fade-in duration-200"
          dir="rtl"
        >
          <div className="w-full max-w-md bg-slate-900 border border-indigo-500/30 rounded-3xl p-5 sm:p-6 shadow-2xl relative space-y-4 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-indigo-900/30 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-2xl bg-indigo-600/30 text-indigo-300 flex items-center justify-center border border-indigo-500/30">
                  <User className="w-5 h-5 text-indigo-400" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">إضافة طالب فردي</h3>
                  <p className="text-xs text-slate-400">طالب خصوصي بحساب الساعة أو الحصة</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddIndividualModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Error Message */}
            {individualFormError && (
              <div className="p-3 rounded-2xl bg-rose-950/80 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
                <span>{individualFormError}</span>
              </div>
            )}

            <form onSubmit={handleCreateIndividualSubmit} className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-indigo-400" />
                  اسم الطالب <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={individualName}
                  onChange={(e) => setIndividualName(e.target.value)}
                  placeholder="اسم الطالب ثلاثي..."
                  className="w-full rounded-2xl bg-slate-950 border border-slate-700/80 px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-400 transition"
                />
              </div>

              {/* Phone / WhatsApp */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-indigo-400" />
                  رقم الهاتف أو الواتساب
                </label>
                <input
                  type="tel"
                  value={individualPhone}
                  onChange={(e) => setIndividualPhone(e.target.value)}
                  placeholder="01xxxxxxxxx"
                  dir="ltr"
                  className="w-full rounded-2xl bg-slate-950 border border-slate-700/80 px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-400 transition text-right"
                />
              </div>

              {/* Subject & Type */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">المادة</label>
                  <select
                    value={individualSubject}
                    onChange={(e) => setIndividualSubject(e.target.value)}
                    className="w-full rounded-2xl bg-slate-950 border border-slate-700/80 px-3 py-2.5 text-xs text-white"
                  >
                    {COMMON_SUBJECTS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">طبيعة الدرس</label>
                  <select
                    value={individualClassType}
                    onChange={(e) => setIndividualClassType(e.target.value as any)}
                    className="w-full rounded-2xl bg-slate-950 border border-slate-700/80 px-3 py-2.5 text-xs text-white"
                  >
                    <option value="private">خاص / منزلي 👤</option>
                    <option value="online">أونلاين 🌐</option>
                  </select>
                </div>
              </div>

              {/* Hourly Rate */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1 flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                  سعر الساعة <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    required
                    value={individualHourlyRate}
                    onChange={(e) => setIndividualHourlyRate(e.target.value)}
                    className="w-full rounded-2xl bg-slate-950 border border-slate-700/80 px-4 py-2.5 pl-14 text-xs text-white font-mono placeholder-slate-500 focus:outline-none focus:border-indigo-400 transition"
                  />
                  <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-bold">
                    {currency}
                  </span>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  ملاحظات إضافية (اختياري)
                </label>
                <textarea
                  rows={2}
                  value={individualNotes}
                  onChange={(e) => setIndividualNotes(e.target.value)}
                  placeholder="أي ملاحظات حول الطالب أو الاتفاق المالي..."
                  className="w-full rounded-2xl bg-slate-950 border border-slate-700/80 px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-400 transition"
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="submit"
                  disabled={isSubmittingIndividual}
                  className="flex-1 py-3 px-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black shadow-lg shadow-indigo-950/50 transition active:scale-95 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                >
                  {isSubmittingIndividual ? (
                    <span>جارٍ إضافة الطالب...</span>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>حفظ وإضافة الطالب</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setShowAddIndividualModal(false)}
                  className="py-3 px-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 4: GROUP DETAILS & MANAGEMENT (قائمة الطلاب، الحضور...)  */}
      {/* ------------------------------------------------------------- */}
      {selectedGroupForDetails && (
        <GroupDetailsModal
          isOpen={true}
          onClose={() => setSelectedGroupForDetails(null)}
          group={selectedGroupForDetails}
          allGroups={groups}
          allStudents={students}
          memberships={memberships}
          teacherId={teacherId}
          currency={currency}
          onShowToast={showToast}
        />
      )}
    </div>
  );
};
