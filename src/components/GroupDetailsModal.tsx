import React, { useState, useMemo, useEffect } from 'react';
import { Group, Student, GroupMembership, PaymentStatus, StudentPaymentRecord } from '../types';
import {
  addStudentToGroup,
  removeStudentFromGroup,
  moveStudentGroup,
  convertStudentToIndividual,
  bulkAddStudentsToGroup,
  archiveGroup,
  updateGroup,
  addStudent,
  recordStudentPayment,
  subscribeToMonthlyPayments,
  getPaymentRecordId,
} from '../firebase';
import { useBackHandler } from '../services/backHandler';
import { PaymentDialog } from './PaymentDialog';
import {
  Users,
  X,
  UserPlus,
  Building2,
  Calendar,
  Clock,
  DollarSign,
  ArrowRightLeft,
  UserCheck,
  UserMinus,
  Edit2,
  Archive,
  Phone,
  MessageCircle,
  CheckCircle2,
  AlertCircle,
  Search,
  Sparkles,
  ClipboardList,
  Check,
} from 'lucide-react';

interface GroupDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  group: Group;
  allGroups: Group[];
  allStudents: Student[];
  memberships: GroupMembership[];
  teacherId: string;
  currency?: string;
  onShowToast: (message: string, isError?: boolean) => void;
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

export const GroupDetailsModal: React.FC<GroupDetailsModalProps> = ({
  isOpen,
  onClose,
  group,
  allGroups,
  allStudents,
  memberships,
  teacherId,
  currency = 'ج.م',
  onShowToast,
}) => {
  useBackHandler(isOpen, onClose, 'group_details_modal');

  const currentMonth = useMemo(() => new Date().toISOString().substring(0, 7), []);
  const [paymentsMap, setPaymentsMap] = useState<Record<string, StudentPaymentRecord>>({});

  useEffect(() => {
    if (!isOpen || !teacherId) return;
    const unsub = subscribeToMonthlyPayments(teacherId, currentMonth, (records) => {
      const map: Record<string, StudentPaymentRecord> = {};
      records.forEach((r) => {
        if (r.groupId === group.id) {
          map[r.studentId] = r;
        }
      });
      setPaymentsMap(map);
    });
    return () => unsub();
  }, [isOpen, teacherId, group.id, currentMonth]);

  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedStudentForPayment, setSelectedStudentForPayment] = useState<Student | null>(null);

  const handleOpenPaymentDialog = (student: Student) => {
    setSelectedStudentForPayment(student);
    setPaymentDialogOpen(true);
  };

  const [activeSubTab, setActiveSubTab] = useState<'students' | 'add' | 'edit'>('students');
  const [addMode, setAddMode] = useState<'single' | 'existing' | 'bulk'>('single');

  // Single Student State
  const [singleName, setSingleName] = useState('');
  const [singlePhone, setSinglePhone] = useState('');
  const [singleParentPhone, setSingleParentPhone] = useState('');
  const [singleNotes, setSingleNotes] = useState('');

  // Existing Student State
  const [selectedExistingStudentId, setSelectedExistingStudentId] = useState('');

  // Bulk Students State
  const [bulkText, setBulkText] = useState('');

  // Edit Group State
  const [editName, setEditName] = useState(group.name);
  const [editCenter, setEditCenter] = useState(group.centerName);
  const [editFee, setEditFee] = useState(group.monthlyFee.toString());
  const [editStatus, setEditStatus] = useState<'active' | 'paused'>(group.status || 'active');

  // Move Student State
  const [movingStudent, setMovingStudent] = useState<Student | null>(null);
  const [targetGroupId, setTargetGroupId] = useState('');

  // Search in enrolled students
  const [studentSearch, setStudentSearch] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Active enrolled students for this group
  const groupStudents = useMemo(() => {
    const activeMemberIds = memberships
      .filter((m) => m.groupId === group.id && m.active)
      .map((m) => m.studentId);

    return allStudents.filter(
      (s) => !s.archived && (activeMemberIds.includes(s.id) || (s.groupIds && s.groupIds.includes(group.id)))
    );
  }, [memberships, allStudents, group.id]);

  // Filtered by search
  const filteredStudents = useMemo(() => {
    if (!studentSearch.trim()) return groupStudents;
    const q = studentSearch.trim().toLowerCase();
    return groupStudents.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.phone && s.phone.includes(q)) ||
        (s.whatsapp && s.whatsapp.includes(q))
    );
  }, [groupStudents, studentSearch]);

  // Students available to be added from existing
  const availableExistingStudents = useMemo(() => {
    const enrolledIds = new Set(groupStudents.map((s) => s.id));
    return allStudents.filter((s) => !s.archived && !enrolledIds.has(s.id));
  }, [allStudents, groupStudents]);

  if (!isOpen) return null;

  // Handler: Add Single New Student
  const handleAddSingleStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!singleName.trim() || isProcessing) return;

    setIsProcessing(true);
    try {
      const studentId = await addStudent(teacherId, {
        name: singleName.trim(),
        whatsapp: singlePhone.trim(),
        subject: group.subject || 'عام',
        classType: 'center',
        hourlyRate: 100,
        notes: singleNotes.trim(),
        groupIds: [group.id],
      });

      if (!studentId) {
        throw new Error('فشل إضافة الطالب');
      }

      await addStudentToGroup(
        teacherId,
        studentId,
        group.id,
        singleName.trim(),
        group.name,
        group.centerName
      );

      setSingleName('');
      setSinglePhone('');
      setSingleParentPhone('');
      setSingleNotes('');
      setActiveSubTab('students');
      onShowToast(`تمت إضافة الطالب "${singleName.trim()}" إلى المجموعة بنجاح! 🎉`);
    } catch (err: any) {
      console.error('Error adding single student to group:', err);
      onShowToast(err.message || 'حدث خطأ أثناء إضافة الطالب', true);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handler: Add Existing Student
  const handleAddExistingStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedExistingStudentId || isProcessing) return;

    const student = allStudents.find((s) => s.id === selectedExistingStudentId);
    if (!student) return;

    setIsProcessing(true);
    try {
      await addStudentToGroup(
        teacherId,
        student.id,
        group.id,
        student.name,
        group.name,
        group.centerName
      );

      setSelectedExistingStudentId('');
      setActiveSubTab('students');
      onShowToast(`تم ضم الطالب "${student.name}" إلى المجموعة بنجاح! ✨`);
    } catch (err: any) {
      console.error('Error adding existing student:', err);
      onShowToast(err.message || 'حدث خطأ أثناء ضم الطالب', true);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handler: Bulk Add Students
  const handleBulkAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const names = bulkText
      .split('\n')
      .map((n) => n.trim())
      .filter((n) => n.length > 0);

    if (names.length === 0 || isProcessing) return;

    setIsProcessing(true);
    try {
      const addedCount = await bulkAddStudentsToGroup(
        teacherId,
        group.id,
        group.name,
        group.centerName,
        names,
        group.subject
      );

      setBulkText('');
      setActiveSubTab('students');
      onShowToast(`تمت إضافة ${addedCount} طلاب دفعة واحدة بنجاح! 🚀`);
    } catch (err: any) {
      console.error('Error bulk adding students:', err);
      onShowToast(err.message || 'حدث خطأ أثناء إضافة الطلاب دفعة واحدة', true);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handler: Move Student to Another Group
  const handleConfirmMoveStudent = async () => {
    if (!movingStudent || !targetGroupId || isProcessing) return;
    const targetGroup = allGroups.find((g) => g.id === targetGroupId);
    if (!targetGroup) return;

    setIsProcessing(true);
    try {
      await moveStudentGroup(
        teacherId,
        movingStudent.id,
        movingStudent.name,
        group.id,
        targetGroup.id,
        targetGroup.name,
        targetGroup.centerName
      );

      onShowToast(`تم نقل الطالب "${movingStudent.name}" إلى مجموعة "${targetGroup.name}" بنجاح! 🔄`);
      setMovingStudent(null);
      setTargetGroupId('');
    } catch (err: any) {
      console.error('Error moving student:', err);
      onShowToast(err.message || 'حدث خطأ أثناء نقل الطالب', true);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handler: Convert Student to Individual
  const handleConvertToIndividual = async (student: Student) => {
    if (isProcessing) return;
    const confirmConvert = window.confirm(
      `هل أنت متأكد من تحويل الطالب "${student.name}" إلى طالب فردي؟ سيتم نقله لتبويب الطلاب الفرديين مع الاحتفاظ بكامل سجله القديم.`
    );
    if (!confirmConvert) return;

    setIsProcessing(true);
    try {
      await convertStudentToIndividual(teacherId, student.id, group.id);
      onShowToast(`تم تحويل "${student.name}" إلى طالب فردي بنجاح 👤`);
    } catch (err: any) {
      console.error('Error converting student to individual:', err);
      onShowToast(err.message || 'حدث خطأ أثناء التحويل', true);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handler: Remove Student from Group
  const handleRemoveStudent = async (student: Student) => {
    if (isProcessing) return;
    const confirmRemove = window.confirm(`هل أنت متأكد من إزالة الطالب "${student.name}" من هذه المجموعة؟`);
    if (!confirmRemove) return;

    setIsProcessing(true);
    try {
      await removeStudentFromGroup(teacherId, student.id, group.id);
      onShowToast(`تمت إزالة "${student.name}" من المجموعة.`);
    } catch (err: any) {
      console.error('Error removing student from group:', err);
      onShowToast(err.message || 'حدث خطأ أثناء إزالة الطالب', true);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handler: Save Group Edits
  const handleSaveGroupEdits = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim() || isProcessing) return;

    setIsProcessing(true);
    try {
      await updateGroup(teacherId, group.id, {
        name: editName.trim(),
        centerName: editCenter.trim(),
        monthlyFee: parseFloat(editFee) || 0,
        status: editStatus,
        active: editStatus === 'active',
      });

      setActiveSubTab('students');
      onShowToast('تم تحديث بيانات المجموعة بنجاح! ✅');
    } catch (err: any) {
      console.error('Error updating group:', err);
      onShowToast(err.message || 'حدث خطأ أثناء تعديل المجموعة', true);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handler: Archive Group
  const handleArchiveGroup = async () => {
    if (isProcessing) return;
    const confirmArchive = window.confirm(
      `هل أنت متأكد من أرشفة مجموعة "${group.name}"؟ ستختفي من القائمة النشطة مع إمكانية استرجاعها لاحقاً.`
    );
    if (!confirmArchive) return;

    setIsProcessing(true);
    try {
      await archiveGroup(teacherId, group.id, true);
      onShowToast(`تمت أرشفة مجموعة "${group.name}" بنجاح 📦`);
      onClose();
    } catch (err: any) {
      console.error('Error archiving group:', err);
      onShowToast(err.message || 'حدث خطأ أثناء أرشفة المجموعة', true);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 text-right animate-in fade-in duration-200"
      dir="rtl"
    >
      <div className="w-full max-w-lg bg-gradient-to-b from-slate-900 to-slate-950 border border-purple-500/30 rounded-3xl p-5 sm:p-6 shadow-2xl relative space-y-4 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-purple-900/30 pb-3 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <span
              className="w-4 h-4 rounded-full border border-white/40 shadow-sm"
              style={{ backgroundColor: group.color || '#7c3aed' }}
            />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-white">{group.name}</h3>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                    group.status === 'active'
                      ? 'bg-emerald-950/70 border-emerald-500/30 text-emerald-300'
                      : 'bg-amber-950/70 border-amber-500/30 text-amber-300'
                  }`}
                >
                  {group.status === 'active' ? 'نشطة ✅' : 'متوقفة ⏸️'}
                </span>
              </div>
              <p className="text-xs text-purple-300/80 flex items-center gap-2 mt-0.5">
                <span className="flex items-center gap-1">
                  <Building2 className="w-3 h-3" />
                  {group.centerName}
                </span>
                <span>•</span>
                <span>{group.subject}</span>
                {group.grade && <span>• {group.grade}</span>}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/60 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Info Strip */}
        <div className="grid grid-cols-3 gap-2 p-3 rounded-2xl bg-slate-950/70 border border-purple-500/20 text-center flex-shrink-0">
          <div>
            <span className="text-[10px] text-slate-400 block">عدد الطلاب</span>
            <span className="text-sm font-bold text-white font-mono">{groupStudents.length} طلاب</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 block">سعر الشهر</span>
            <span className="text-sm font-bold text-emerald-400 font-mono">
              {group.monthlyFee} {currency}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 block">الحصص الأسبوعية</span>
            <span className="text-xs font-bold text-purple-300 font-mono">
              {group.schedule?.length || 0} مواعيد
            </span>
          </div>
        </div>

        {/* Weekly Schedule Display */}
        {group.schedule && group.schedule.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap flex-shrink-0">
            <span className="text-[11px] text-slate-400 font-bold">المواعيد:</span>
            {group.schedule.map((slot, idx) => (
              <span
                key={idx}
                className="text-[11px] px-2.5 py-0.5 rounded-xl bg-purple-950/60 border border-purple-500/30 text-purple-200 flex items-center gap-1"
              >
                <Clock className="w-3 h-3 text-purple-400" />
                {WEEK_DAYS_NAMES[slot.day] || 'يوم'}: {slot.time}
              </span>
            ))}
          </div>
        )}

        {/* Sub Navigation Tabs */}
        <div className="flex items-center gap-2 p-1 rounded-2xl bg-slate-950 border border-slate-800 flex-shrink-0 text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveSubTab('students')}
            className={`flex-1 py-2 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 ${
              activeSubTab === 'students'
                ? 'bg-purple-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>طلاب المجموعة ({groupStudents.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('add')}
            className={`flex-1 py-2 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 ${
              activeSubTab === 'add'
                ? 'bg-purple-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>إضافة طلاب</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('edit')}
            className={`py-2 px-3 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 ${
              activeSubTab === 'edit'
                ? 'bg-purple-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span>تعديل</span>
          </button>
        </div>

        {/* Tab 1: Enrolled Students List */}
        {activeSubTab === 'students' && (
          <div className="flex-1 overflow-y-auto space-y-3 min-h-[220px]">
            {/* Search Bar */}
            <div className="relative">
              <input
                type="text"
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                placeholder="بحث في طلاب المجموعة..."
                className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3.5 py-2 pr-9 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-400"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5" />
            </div>

            {/* Students List */}
            {filteredStudents.length === 0 ? (
              <div className="p-6 rounded-2xl bg-slate-950/40 border border-slate-800/80 text-center space-y-2">
                <Users className="w-8 h-8 text-slate-500 mx-auto" />
                <h4 className="text-xs font-bold text-slate-300">لا يوجد طلاب في هذه المجموعة بعد</h4>
                <p className="text-[11px] text-slate-400">
                  اضغط على تبويب "إضافة طلاب" لإضافة طالب جديد أو لصق قائمة الأسماء دفعة واحدة.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveSubTab('add')}
                  className="mt-2 text-xs px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold transition inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>إضافة طلاب الآن</span>
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredStudents.map((st) => (
                  <div
                    key={st.id}
                    className="p-3 rounded-2xl bg-slate-950 border border-slate-800/80 hover:border-purple-500/30 transition space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-xl bg-purple-600/20 text-purple-300 flex items-center justify-center font-bold text-xs">
                          {st.name.charAt(0)}
                        </div>
                        <div>
                          <span className="text-xs font-bold text-white block">{st.name}</span>
                          {(st.phone || st.whatsapp) && (
                            <span className="text-[10px] text-slate-400 font-mono" dir="ltr">
                              {st.phone || st.whatsapp}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* 1-Click Monthly Payment Status Button */}
                      <div className="flex items-center gap-2">
                      {/* Manual Payment Entry Button */}
                      <button
                        type="button"
                        onClick={() => handleOpenPaymentDialog(st)}
                        className="px-2.5 py-1 rounded-xl text-[11px] font-bold border bg-purple-950/40 border-purple-500/30 text-purple-200 hover:bg-purple-900/60 transition cursor-pointer flex items-center gap-1"
                      >
                        <DollarSign className="w-3 h-3" />
                        <span>دفع يدوي</span>
                      </button>
                      </div>

                      {/* Quick Contact & Actions */}
                      <div className="flex items-center gap-1.5">
                        {st.whatsapp && (
                          <a
                            href={`https://wa.me/${st.whatsapp.replace(/[^0-9]/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg bg-emerald-950/60 text-emerald-400 hover:bg-emerald-900 transition"
                            title="مراسلة واتساب"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => setMovingStudent(st)}
                          className="text-[11px] px-2 py-1 rounded-lg bg-slate-900 hover:bg-purple-950/70 border border-slate-700 hover:border-purple-500/40 text-purple-300 transition cursor-pointer flex items-center gap-1"
                          title="نقل لمجموعة أخرى"
                        >
                          <ArrowRightLeft className="w-3 h-3" />
                          <span>نقل</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleConvertToIndividual(st)}
                          className="text-[11px] px-2 py-1 rounded-lg bg-slate-900 hover:bg-indigo-950/70 border border-slate-700 hover:border-indigo-500/40 text-indigo-300 transition cursor-pointer"
                          title="تحويل لطالب فردي"
                        >
                          <span>فردي</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveStudent(st)}
                          className="p-1 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 transition cursor-pointer"
                          title="إزالة من المجموعة"
                        >
                          <UserMinus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Add Students (Single, Existing, Bulk) */}
        {activeSubTab === 'add' && (
          <div className="flex-1 overflow-y-auto space-y-4">
            {/* Add Mode Selector */}
            <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-bold">
              <button
                type="button"
                onClick={() => setAddMode('single')}
                className={`py-1.5 rounded-lg transition cursor-pointer ${
                  addMode === 'single' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                طالب جديد 👤
              </button>
              <button
                type="button"
                onClick={() => setAddMode('existing')}
                className={`py-1.5 rounded-lg transition cursor-pointer ${
                  addMode === 'existing' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                طالب موجود 📋
              </button>
              <button
                type="button"
                onClick={() => setAddMode('bulk')}
                className={`py-1.5 rounded-lg transition cursor-pointer ${
                  addMode === 'bulk' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                دفعة واحدة 📝
              </button>
            </div>

            {/* Mode 1: Single New Student */}
            {addMode === 'single' && (
              <form onSubmit={handleAddSingleStudent} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    اسم الطالب <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={singleName}
                    onChange={(e) => setSingleName(e.target.value)}
                    placeholder="مثال: يوسف إبراهيم"
                    className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-purple-400"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">هاتف الطالب</label>
                    <input
                      type="tel"
                      value={singlePhone}
                      onChange={(e) => setSinglePhone(e.target.value)}
                      placeholder="01xxxxxxxxx"
                      className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-purple-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">هاتف ولي الأمر</label>
                    <input
                      type="tel"
                      value={singleParentPhone}
                      onChange={(e) => setSingleParentPhone(e.target.value)}
                      placeholder="01xxxxxxxxx"
                      className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-purple-400"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">ملاحظات</label>
                  <input
                    type="text"
                    value={singleNotes}
                    onChange={(e) => setSingleNotes(e.target.value)}
                    placeholder="ملاحظات حول مستوى الطالب..."
                    className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-400"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isProcessing || !singleName.trim()}
                  className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-bold transition shadow-md cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>إضافة الطالب للمجموعة</span>
                </button>
              </form>
            )}

            {/* Mode 2: Select Existing Student */}
            {addMode === 'existing' && (
              <form onSubmit={handleAddExistingStudent} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    اختر طالباً من قائمة طلابك
                  </label>
                  {availableExistingStudents.length === 0 ? (
                    <p className="text-xs text-slate-400 py-2">
                      جميع طلابك المسجلين منضمون بالفعل لهذه المجموعة!
                    </p>
                  ) : (
                    <select
                      value={selectedExistingStudentId}
                      onChange={(e) => setSelectedExistingStudentId(e.target.value)}
                      className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2.5 text-xs text-white focus:outline-none focus:border-purple-400"
                      required
                    >
                      <option value="">-- اضغط للاختيار --</option>
                      {availableExistingStudents.map((st) => (
                        <option key={st.id} value={st.id}>
                          {st.name} {st.subject ? `(${st.subject})` : ''}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={isProcessing || !selectedExistingStudentId}
                  className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-bold transition shadow-md cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <UserCheck className="w-4 h-4" />
                  <span>ضم الطالب للمجموعة</span>
                </button>
              </form>
            )}

            {/* Mode 3: Bulk Add by Pasting Names */}
            {addMode === 'bulk' && (
              <form onSubmit={handleBulkAdd} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    لصق قائمة أسماء الطلاب (اسم في كل سطر)
                  </label>
                  <textarea
                    rows={5}
                    required
                    value={bulkText}
                    onChange={(e) => setBulkText(e.target.value)}
                    placeholder={`أحمد محمد علي\nمحمود حسن إبراهيم\nزياد سامح كمال\nسارة عبد الرحمن`}
                    className="w-full rounded-xl bg-slate-950 border border-slate-700 p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-400 font-sans leading-relaxed"
                  />
                  <p className="text-[11px] text-purple-300/80 mt-1">
                    انسخ الأسماء من ملف إكسل أو رسالة واتساب والصفها هنا مباشرة، وسيتم تسجيل كل سطر كطالب في المجموعة.
                  </p>
                </div>
                <button
                  type="submit"
                  disabled={isProcessing || !bulkText.trim()}
                  className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold transition shadow-md cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>إضافة جميع الطلاب دفعة واحدة</span>
                </button>
              </form>
            )}
          </div>
        )}

        {/* Tab 3: Edit Group & Archive */}
        {activeSubTab === 'edit' && (
          <form onSubmit={handleSaveGroupEdits} className="flex-1 overflow-y-auto space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">اسم المجموعة</label>
              <input
                type="text"
                required
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-purple-400"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">اسم السنتر / القاعة</label>
              <input
                type="text"
                required
                value={editCenter}
                onChange={(e) => setEditCenter(e.target.value)}
                className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-purple-400"
              />
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">سعر الشهر ({currency})</label>
                <input
                  type="number"
                  min="0"
                  required
                  value={editFee}
                  onChange={(e) => setEditFee(e.target.value)}
                  className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-purple-400"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">حالة المجموعة</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as 'active' | 'paused')}
                  className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-xs text-white focus:outline-none"
                >
                  <option value="active">نشطة ✅</option>
                  <option value="paused">متوقفة ⏸️</option>
                </select>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 space-y-2">
              <button
                type="submit"
                disabled={isProcessing}
                className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition cursor-pointer"
              >
                حفظ التعديلات
              </button>
              <button
                type="button"
                onClick={handleArchiveGroup}
                disabled={isProcessing}
                className="w-full py-2.5 rounded-xl bg-rose-950/60 hover:bg-rose-900/60 border border-rose-500/30 text-rose-300 text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Archive className="w-3.5 h-3.5" />
                <span>أرشفة المجموعة (إخفاء)</span>
              </button>
            </div>
          </form>
        )}

        {/* Modal Overlay: Move Student to Another Group */}
        {movingStudent && (
          <div className="fixed inset-0 z-60 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-sm bg-slate-900 border border-purple-500/40 rounded-2xl p-4 space-y-3 text-right">
              <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                <ArrowRightLeft className="w-4 h-4 text-purple-400" />
                <span>نقل الطالب "{movingStudent.name}" إلى مجموعة أخرى</span>
              </h4>
              <p className="text-[11px] text-slate-400">
                سيتم نقله للمجموعة الجديدة مع الحفاظ التام على كامل سجلات الحضور والدفع السابقة في المجموعة القديمة.
              </p>
              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">المجموعة المستهدفة:</label>
                <select
                  value={targetGroupId}
                  onChange={(e) => setTargetGroupId(e.target.value)}
                  className="w-full rounded-xl bg-slate-950 border border-slate-700 p-2 text-xs text-white focus:outline-none"
                >
                  <option value="">-- اختر المجموعة الجديدة --</option>
                  {allGroups
                    .filter((g) => g.id !== group.id && !g.archived)
                    .map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name} ({g.centerName})
                      </option>
                    ))}
                </select>
              </div>
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  disabled={!targetGroupId || isProcessing}
                  onClick={handleConfirmMoveStudent}
                  className="flex-1 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-bold transition cursor-pointer"
                >
                  تأكيد النقل
                </button>
                <button
                  type="button"
                  onClick={() => setMovingStudent(null)}
                  className="py-2 px-3 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold transition cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        )}
        {paymentDialogOpen && selectedStudentForPayment && (
          <PaymentDialog
            isOpen={paymentDialogOpen}
            onClose={() => setPaymentDialogOpen(false)}
            student={selectedStudentForPayment}
            group={group}
            initialAmountDue={group.monthlyFee}
            onSave={async (data) => {
              // Implementation here using recordStudentPayment
              await recordStudentPayment(teacherId, {
                studentId: selectedStudentForPayment.id,
                studentName: selectedStudentForPayment.name,
                groupId: group.id,
                groupName: group.name,
                month: currentMonth,
                ...data
              });
              onShowToast('تم تسجيل الدفعة بنجاح!');
            }}
          />
        )}
        {paymentDialogOpen && selectedStudentForPayment && (
          <PaymentDialog
            isOpen={paymentDialogOpen}
            onClose={() => setPaymentDialogOpen(false)}
            student={selectedStudentForPayment}
            group={group}
            initialAmountDue={group.monthlyFee}
            onSave={async (data) => {
              // Implementation here using recordStudentPayment
              await recordStudentPayment(teacherId, {
                studentId: selectedStudentForPayment.id,
                studentName: selectedStudentForPayment.name,
                groupId: group.id,
                groupName: group.name,
                month: currentMonth,
                ...data
              });
              onShowToast('تم تسجيل الدفعة بنجاح!');
            }}
          />
        )}
      </div>
    </div>
  );
};
