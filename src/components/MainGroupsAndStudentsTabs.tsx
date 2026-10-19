import React, { useState, useMemo } from 'react';
import { Group, Student, EducationalCenter, GroupMembership } from '../types';
import {
  Users,
  User,
  Search,
  Building2,
  BookOpen,
  GraduationCap,
  Plus,
  Clock,
  DollarSign,
  Filter,
  CheckCircle2,
  ChevronRight,
  Sparkles,
  Phone,
  MessageCircle,
  Archive,
  RotateCcw,
} from 'lucide-react';

interface MainGroupsAndStudentsTabsProps {
  groups: Group[];
  students: Student[];
  centers: EducationalCenter[];
  memberships: GroupMembership[];
  currency?: string;
  onOpenAddChoice: () => void;
  onOpenAddGroup: () => void;
  onOpenAddStudent: () => void;
  onSelectGroup: (group: Group) => void;
  onSelectStudent?: (student: Student) => void;
  onRestoreGroup?: (groupId: string) => void;
}

const WEEK_DAYS_NAMES: Record<number, string> = {
  0: 'الأحد',
  1: 'الإثنين',
  2: 'الثلاثاء',
  3: 'الأربعاء',
  4: 'الخميس',
  5: 'الجمعة',
  6: 'السبت',
};

export const MainGroupsAndStudentsTabs: React.FC<MainGroupsAndStudentsTabsProps> = ({
  groups,
  students,
  centers,
  memberships,
  currency = 'ج.م',
  onOpenAddChoice,
  onOpenAddGroup,
  onOpenAddStudent,
  onSelectGroup,
  onSelectStudent,
  onRestoreGroup,
}) => {
  // Main Tab: 'groups' or 'individuals'
  const [activeTab, setActiveTab] = useState<'groups' | 'individuals'>('groups');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [centerFilter, setCenterFilter] = useState('all');
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [gradeFilter, setGradeFilter] = useState('all');
  const [showFiltersBar, setShowFiltersBar] = useState(false);

  // Group membership counts
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

  // Unique centers for filter
  const centerOptions = useMemo(() => {
    const set = new Set<string>();
    groups.forEach((g) => {
      if (g.centerName) set.add(g.centerName.trim());
    });
    centers.forEach((c) => {
      if (c.name) set.add(c.name.trim());
    });
    return Array.from(set).filter(Boolean);
  }, [groups, centers]);

  // Unique subjects for filter
  const subjectOptions = useMemo(() => {
    const set = new Set<string>();
    groups.forEach((g) => {
      if (g.subject) set.add(g.subject.trim());
    });
    students.forEach((s) => {
      if (s.subject) set.add(s.subject.trim());
    });
    return Array.from(set).filter(Boolean);
  }, [groups, students]);

  // Unique grades for filter
  const gradeOptions = useMemo(() => {
    const set = new Set<string>();
    groups.forEach((g) => {
      if (g.grade) set.add(g.grade.trim());
    });
    return Array.from(set).filter(Boolean);
  }, [groups]);

  // Active (non-archived) groups
  const activeGroups = useMemo(() => {
    return groups.filter((g) => !g.archived);
  }, [groups]);

  // Filtered Groups
  const filteredGroups = useMemo(() => {
    return activeGroups.filter((g) => {
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchName = g.name.toLowerCase().includes(q);
        const matchCenter = (g.centerName || '').toLowerCase().includes(q);
        const matchSubject = (g.subject || '').toLowerCase().includes(q);
        if (!matchName && !matchCenter && !matchSubject) return false;
      }
      // Center filter
      if (centerFilter !== 'all' && g.centerName !== centerFilter) {
        return false;
      }
      // Subject filter
      if (subjectFilter !== 'all' && g.subject !== subjectFilter) {
        return false;
      }
      // Grade filter
      if (gradeFilter !== 'all' && g.grade !== gradeFilter) {
        return false;
      }
      return true;
    });
  }, [activeGroups, searchQuery, centerFilter, subjectFilter, gradeFilter]);

  // Individual Students (students with no group or isIndividual or classType === 'private'/'online')
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
        const matchName = s.name.toLowerCase().includes(q);
        const matchPhone = (s.phone || s.whatsapp || '').includes(q);
        const matchSubject = (s.subject || '').toLowerCase().includes(q);
        if (!matchName && !matchPhone && !matchSubject) return false;
      }
      if (subjectFilter !== 'all' && s.subject !== subjectFilter) {
        return false;
      }
      return true;
    });
  }, [individualStudents, searchQuery, subjectFilter]);

  const activeFiltersCount =
    (centerFilter !== 'all' ? 1 : 0) +
    (subjectFilter !== 'all' ? 1 : 0) +
    (gradeFilter !== 'all' ? 1 : 0);

  const handleClearFilters = () => {
    setSearchQuery('');
    setCenterFilter('all');
    setSubjectFilter('all');
    setGradeFilter('all');
  };

  return (
    <div className="space-y-4" dir="rtl">
      {/* Top Main Tabs Header: Groups vs Individual Students */}
      <div className="flex items-center justify-between gap-2 border-b border-purple-900/30 pb-3">
        <div className="flex items-center gap-2 p-1 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-inner">
          <button
            type="button"
            onClick={() => setActiveTab('groups')}
            className={`flex items-center gap-2 py-2 px-4 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeTab === 'groups'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-950/40 scale-[1.02]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>المجموعات (السناتر)</span>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                activeTab === 'groups' ? 'bg-purple-800/80 text-white' : 'bg-slate-800 text-slate-400'
              }`}
            >
              {activeGroups.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('individuals')}
            className={`flex items-center gap-2 py-2 px-4 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeTab === 'individuals'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-950/40 scale-[1.02]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <User className="w-4 h-4" />
            <span>الطلاب الفرديين</span>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                activeTab === 'individuals' ? 'bg-indigo-800/80 text-white' : 'bg-slate-800 text-slate-400'
              }`}
            >
              {individualStudents.length}
            </span>
          </button>
        </div>

        {/* Quick Add Button Header */}
        <button
          type="button"
          onClick={activeTab === 'groups' ? onOpenAddGroup : onOpenAddStudent}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-md shadow-purple-950/40 transition active:scale-95 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">
            {activeTab === 'groups' ? 'إضافة مجموعة' : 'إضافة طالب'}
          </span>
          <span className="sm:hidden">إضافة</span>
        </button>
      </div>

      {/* Search & Filter Bar */}
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

          {/* Toggle Filter Button */}
          <button
            type="button"
            onClick={() => setShowFiltersBar((prev) => !prev)}
            className={`p-2.5 rounded-2xl border transition cursor-pointer flex items-center gap-1.5 text-xs font-bold ${
              showFiltersBar || activeFiltersCount > 0
                ? 'bg-purple-950/60 border-purple-500/50 text-purple-300'
                : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
            }`}
            title="تصفية وفلاتر متقدمة"
          >
            <Filter className="w-4 h-4" />
            {activeFiltersCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-purple-600 text-white text-[10px] flex items-center justify-center">
                {activeFiltersCount}
              </span>
            )}
          </button>
        </div>

        {/* Collapsible Filters Dropdowns */}
        {showFiltersBar && (
          <div className="p-3 rounded-2xl bg-slate-900/90 border border-purple-500/20 space-y-2.5 animate-in fade-in duration-150">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {/* Center Filter (Groups only) */}
              {activeTab === 'groups' && (
                <div>
                  <label className="block text-[10px] text-slate-400 font-bold mb-1">السنتر:</label>
                  <select
                    value={centerFilter}
                    onChange={(e) => setCenterFilter(e.target.value)}
                    className="w-full rounded-xl bg-slate-950 border border-slate-800 p-2 text-xs text-white focus:outline-none"
                  >
                    <option value="all">كل السناتر</option>
                    {centerOptions.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Subject Filter */}
              <div>
                <label className="block text-[10px] text-slate-400 font-bold mb-1">المادة الدراسية:</label>
                <select
                  value={subjectFilter}
                  onChange={(e) => setSubjectFilter(e.target.value)}
                  className="w-full rounded-xl bg-slate-950 border border-slate-800 p-2 text-xs text-white focus:outline-none"
                >
                  <option value="all">كل المواد</option>
                  {subjectOptions.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              {/* Grade Filter (Groups only) */}
              {activeTab === 'groups' && (
                <div>
                  <label className="block text-[10px] text-slate-400 font-bold mb-1">الصف الدراسي:</label>
                  <select
                    value={gradeFilter}
                    onChange={(e) => setGradeFilter(e.target.value)}
                    className="w-full rounded-xl bg-slate-950 border border-slate-800 p-2 text-xs text-white focus:outline-none"
                  >
                    <option value="all">كل الصفوف</option>
                    {gradeOptions.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {activeFiltersCount > 0 && (
              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="text-[11px] text-purple-300 hover:text-white underline cursor-pointer"
                >
                  إعادة ضبط الفلاتر
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* TAB 1: GROUPS VIEW                                           */}
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
                  {activeGroups.length === 0
                    ? 'لسه مفيش مجموعات، اضغط + لإضافة أول مجموعة'
                    : 'لا توجد مجموعات مطابقة للبحث أو الفلتر'}
                </h4>
                <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
                  {activeGroups.length === 0
                    ? 'نظّم طلاب السناتر في مجموعات مع جدول حصص أسبوعي وسعر اشتراك شهري ثابت.'
                    : 'جرّب البحث باسم سنتر أو مادة أخرى أو تفريغ الفلاتر.'}
                </p>
              </div>

              {activeGroups.length === 0 ? (
                <button
                  type="button"
                  onClick={onOpenAddGroup}
                  className="mt-2 inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-black shadow-lg shadow-purple-950/40 transition active:scale-95 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>إضافة أول مجموعة الآن ✨</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white text-xs font-bold transition cursor-pointer"
                >
                  <span>عرض جميع المجموعات</span>
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filteredGroups.map((group) => {
                const count = groupStudentCounts[group.id] || 0;
                return (
                  <div
                    key={group.id}
                    onClick={() => onSelectGroup(group)}
                    className="group relative p-4 rounded-3xl bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 hover:border-purple-500/50 shadow-lg hover:shadow-purple-950/30 transition-all cursor-pointer space-y-3 active:scale-[0.99]"
                  >
                    {/* Top Row: Color Tag & Status & Center Badge */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3.5 h-3.5 rounded-full border border-white/30 shadow-sm"
                          style={{ backgroundColor: group.color || '#7c3aed' }}
                        />
                        <span className="text-xs font-black text-white group-hover:text-purple-300 transition-colors">
                          {group.name}
                        </span>
                      </div>

                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                          group.status === 'active'
                            ? 'bg-emerald-950/70 border-emerald-500/30 text-emerald-300'
                            : 'bg-amber-950/70 border-amber-500/30 text-amber-300'
                        }`}
                      >
                        {group.status === 'active' ? 'نشطة' : 'متوقفة'}
                      </span>
                    </div>

                    {/* Center & Subject & Grade Chips */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[11px] px-2.5 py-0.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 flex items-center gap-1 font-bold">
                        <Building2 className="w-3 h-3 text-purple-400" />
                        {group.centerName}
                      </span>
                      <span className="text-[11px] px-2.5 py-0.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 flex items-center gap-1">
                        <BookOpen className="w-3 h-3 text-indigo-400" />
                        {group.subject}
                      </span>
                      {group.grade && (
                        <span className="text-[11px] px-2.5 py-0.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-400">
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
      {/* TAB 2: INDIVIDUAL STUDENTS VIEW                               */}
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
                  يمكنك إضافة طالب خصوصي مستقل يحاسب بالساعة أو الحصة أو الباقة.
                </p>
              </div>

              {individualStudents.length === 0 && (
                <button
                  type="button"
                  onClick={onOpenAddStudent}
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
                  className="p-4 rounded-3xl bg-slate-900/90 border border-slate-800 hover:border-indigo-500/40 transition space-y-2.5 cursor-pointer active:scale-[0.99]"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-indigo-600/20 text-indigo-300 flex items-center justify-center font-bold text-xs">
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
    </div>
  );
};
