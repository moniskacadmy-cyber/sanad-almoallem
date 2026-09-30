import React, { useState, useEffect } from 'react';
import { TeacherProfile, Student, LessonLog, ClassType, PaymentStatus } from '../types';
import {
  addStudent,
  updateStudent,
  deleteStudent,
  toggleStudentPaymentStatus,
  subscribeToStudentLessons,
  addLessonLog,
  deleteLessonLog,
} from '../firebase';
import {
  UserPlus,
  Search,
  Phone,
  MessageCircle,
  CreditCard,
  CheckCircle2,
  XCircle,
  MoreVertical,
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
  Clock,
  Sparkles,
} from 'lucide-react';

interface StudentsTabProps {
  profile: TeacherProfile;
  students: Student[];
}

export const StudentsTab: React.FC<StudentsTabProps> = ({ profile, students }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | ClassType>('all');
  const [paymentFilter, setPaymentFilter] = useState<'all' | PaymentStatus>('all');

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [selectedProfileStudent, setSelectedProfileStudent] = useState<Student | null>(null);
  const [studentLessons, setStudentLessons] = useState<LessonLog[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<Student | null>(null);

  // Form fields for Add/Edit Student
  const [formName, setFormName] = useState('');
  const [formWhatsapp, setFormWhatsapp] = useState('');
  const [formSubject, setFormSubject] = useState(profile.subject || 'رياضيات');
  const [formClassType, setFormClassType] = useState<ClassType>('private');
  const [formMonthlyFee, setFormMonthlyFee] = useState<number>(300);
  const [formNotes, setFormNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // New Lesson form inside Student Profile
  const [showAddLessonInsideProfile, setShowAddLessonInsideProfile] = useState(false);
  const [newLessonTopic, setNewLessonTopic] = useState('');
  const [newLessonHomework, setNewLessonHomework] = useState('');
  const [newLessonAttendance, setNewLessonAttendance] = useState<'present' | 'absent' | 'excused'>('present');
  const [newLessonRating, setNewLessonRating] = useState<number>(5);

  // Subscribe to selected student's lessons
  useEffect(() => {
    if (!selectedProfileStudent) {
      setStudentLessons([]);
      return;
    }
    const unsub = subscribeToStudentLessons(profile.id, selectedProfileStudent.id, (lessons) => {
      setStudentLessons(lessons);
    });
    return () => unsub();
  }, [profile.id, selectedProfileStudent]);

  // Filter students
  const filteredStudents = students.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.whatsapp.includes(searchQuery) ||
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
    setFormNotes('');
    setShowAddModal(true);
  };

  const handleOpenEditModal = (student: Student) => {
    setEditingStudent(student);
    setFormName(student.name);
    setFormWhatsapp(student.whatsapp);
    setFormSubject(student.subject);
    setFormClassType(student.classType);
    setFormMonthlyFee(student.monthlyFee || 0);
    setFormNotes(student.notes || '');
    setShowAddModal(true);
  };

  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formWhatsapp.trim()) return;
    setIsSubmitting(true);

    try {
      if (editingStudent) {
        await updateStudent(profile.id, editingStudent.id, {
          name: formName.trim(),
          whatsapp: formWhatsapp.trim(),
          subject: formSubject.trim(),
          classType: formClassType,
          monthlyFee: Number(formMonthlyFee) || 0,
          notes: formNotes.trim(),
        });
      } else {
        await addStudent(profile.id, {
          name: formName.trim(),
          whatsapp: formWhatsapp.trim(),
          subject: formSubject.trim(),
          classType: formClassType,
          monthlyFee: Number(formMonthlyFee) || 0,
          paymentStatus: 'unpaid',
          notes: formNotes.trim(),
        });
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
          <p className="text-xs text-slate-400">إدارة الطلاب، الحضور، وما تم شرحه والمدفوعات</p>
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
            placeholder="بحث بالاسم أو رقم الواتساب..."
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
                  {s.whatsapp && (
                    <a
                      href={`https://wa.me/${s.whatsapp.replace(/[^0-9]/g, '')}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-900/50 transition"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>واتساب</span>
                    </a>
                  )}
                  <button
                    onClick={() => setSelectedProfileStudent(s)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-950/60 border border-purple-500/30 text-purple-300 hover:bg-purple-900/50 transition cursor-pointer"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>سجل الحصص</span>
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
          <div className="w-full max-w-md bg-slate-900 border border-purple-500/30 rounded-3xl p-5 shadow-2xl text-right">
            <div className="flex items-center justify-between border-b border-purple-900/40 pb-3 mb-4">
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

            <form onSubmit={handleSaveStudent} className="space-y-3.5">
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

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  رقم الواتساب (للطالب أو ولي الأمر) *
                </label>
                <input
                  type="tel"
                  value={formWhatsapp}
                  onChange={(e) => setFormWhatsapp(e.target.value)}
                  placeholder="01012345678"
                  required
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

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  ملاحظات إضافية (اختياري)
                </label>
                <textarea
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="ملاحظات حول مستوى الطالب أو متطلبات خاصة..."
                  rows={2}
                  className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-400"
                />
              </div>

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

      {/* Student Detailed Profile Modal (Attendance & Lessons Log) */}
      {selectedProfileStudent && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-purple-500/30 rounded-3xl p-5 shadow-2xl text-right max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-purple-900/40 pb-3 mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-white">{selectedProfileStudent.name}</h3>
                  {getClassTypeBadge(selectedProfileStudent.classType)}
                </div>
                <p className="text-xs text-purple-300 mt-0.5">
                  واتساب: <span dir="ltr">{selectedProfileStudent.whatsapp}</span> • مادة: {selectedProfileStudent.subject}
                </p>
              </div>
              <button
                onClick={() => setSelectedProfileStudent(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Actions inside profile */}
            <div className="grid grid-cols-2 gap-2 mb-3">
              <button
                onClick={() => setShowAddLessonInsideProfile(!showAddLessonInsideProfile)}
                className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{showAddLessonInsideProfile ? 'إغلاق النموذج' : 'تسجيل حصة جديدة'}</span>
              </button>

              <button
                onClick={() => toggleStudentPaymentStatus(profile.id, selectedProfileStudent.id, selectedProfileStudent.paymentStatus)}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold border transition cursor-pointer ${
                  selectedProfileStudent.paymentStatus === 'paid'
                    ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                    : 'bg-rose-950/60 border-rose-500/40 text-rose-300'
                }`}
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>
                  {selectedProfileStudent.paymentStatus === 'paid' ? 'تم دفع المصروفات ✅' : 'لم يتم الدفع بعد ❌'}
                </span>
              </button>
            </div>

            {/* Add Lesson Form inside profile */}
            {showAddLessonInsideProfile && (
              <form onSubmit={handleAddLessonSubmit} className="mb-4 p-3 rounded-2xl bg-slate-800/80 border border-purple-500/30 space-y-2.5">
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
            <div className="flex-1 overflow-y-auto space-y-2 pr-0.5">
              <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-purple-400" />
                <span>سجل الحصص السابقة ({studentLessons.length})</span>
              </h4>

              {studentLessons.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400">
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
    </div>
  );
};
