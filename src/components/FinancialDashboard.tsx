import React, { useState, useEffect } from 'react';
import { TeacherProfile, Student, LessonLog } from '../types';
import { fetchAllStudentLessons, settleStudentAccount } from '../firebase';
import {
  DollarSign,
  Clock,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  CreditCard,
  UserCheck,
  MessageCircle,
  RefreshCw,
  Search,
  Filter,
  ChevronRight,
  Sparkles,
  ArrowDownLeft,
  ArrowUpRight,
  Calendar,
  X,
  Send,
  Copy,
  Check,
} from 'lucide-react';

interface FinancialDashboardProps {
  profile: TeacherProfile;
  students: Student[];
  onBackToApp: () => void;
  onOpenStudentDetails?: (student: Student) => void;
}

export const FinancialDashboard: React.FC<FinancialDashboardProps> = ({
  profile,
  students,
  onBackToApp,
  onOpenStudentDetails,
}) => {
  const [loadingLessons, setLoadingLessons] = useState(true);
  const [lessonsMap, setLessonsMap] = useState<Record<string, LessonLog[]>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDues, setFilterDues] = useState<'all' | 'pending' | 'settled'>('all');
  const [settlingStudentId, setSettlingStudentId] = useState<string | null>(null);
  const [showConfirmSettle, setShowConfirmSettle] = useState<Student | null>(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState<Student | null>(null);
  const [editableInvoiceText, setEditableInvoiceText] = useState('');
  const [copiedInvoice, setCopiedInvoice] = useState(false);

  // Load all lessons for students
  const loadLessons = async () => {
    setLoadingLessons(true);
    try {
      const data = await fetchAllStudentLessons(profile.id, students);
      setLessonsMap(data);
    } catch (err) {
      console.error('Error fetching lessons for finance:', err);
    } finally {
      setLoadingLessons(false);
    }
  };

  useEffect(() => {
    if (students.length > 0) {
      loadLessons();
    } else {
      setLoadingLessons(false);
    }
  }, [profile.id, students]);

  // Current month prefix YYYY-MM
  const now = new Date();
  const currentMonthPrefix = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
  const currentMonthName = new Intl.DateTimeFormat('ar-EG', { month: 'long', year: 'numeric' }).format(now);

  // Calculate calculations per student
  const studentFinancials = students.map((st) => {
    const studentLessons = lessonsMap[st.id] || [];
    const hourlyRate = st.hourlyRate || (st.monthlyFee ? Math.round(st.monthlyFee / 4) : 100);

    let totalMinutesAll = 0;
    let totalMinutesMonth = 0;
    let pendingMinutes = 0;
    let pendingAmount = 0;
    let collectedAmount = 0;
    let monthTotalAmount = 0;

    studentLessons.forEach((l) => {
      const dur = l.duration || 60;
      const rate = l.hourlyRate || hourlyRate;
      const cost = l.cost !== undefined ? l.cost : Math.round((dur / 60) * rate);

      totalMinutesAll += dur;

      if (l.date && l.date.startsWith(currentMonthPrefix)) {
        totalMinutesMonth += dur;
        monthTotalAmount += cost;
      }

      if (l.settled) {
        collectedAmount += cost;
      } else {
        pendingMinutes += dur;
        pendingAmount += cost;
      }
    });

    const pendingHours = (pendingMinutes / 60).toFixed(1);
    const totalHoursAll = (totalMinutesAll / 60).toFixed(1);
    const monthHours = (totalMinutesMonth / 60).toFixed(1);

    return {
      student: st,
      hourlyRate,
      lessonsCount: studentLessons.length,
      totalMinutesAll,
      totalHoursAll: Number(totalHoursAll),
      monthHours: Number(monthHours),
      pendingHours: Number(pendingHours),
      pendingAmount,
      collectedAmount,
      monthTotalAmount,
    };
  });

  // Global Aggregates
  const totalMonthEarnings = studentFinancials.reduce((sum, item) => sum + item.monthTotalAmount, 0);
  const totalTeachingMinutes = studentFinancials.reduce((sum, item) => sum + item.totalMinutesAll, 0);
  const totalTeachingHours = (totalTeachingMinutes / 60).toFixed(1);
  const totalPendingDues = studentFinancials.reduce((sum, item) => sum + item.pendingAmount, 0);
  const totalCollectedDues = studentFinancials.reduce((sum, item) => sum + item.collectedAmount, 0);

  // Filtered List
  const filteredList = studentFinancials.filter((item) => {
    const matchesSearch =
      item.student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.student.subject.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;

    if (filterDues === 'pending') return item.pendingAmount > 0;
    if (filterDues === 'settled') return item.pendingAmount === 0;
    return true;
  });

  // Handle Settle
  const handleConfirmSettleAccount = async (student: Student) => {
    setSettlingStudentId(student.id);
    try {
      await settleStudentAccount(profile.id, student.id);
      await loadLessons();
      setShowConfirmSettle(null);
    } catch (err) {
      console.error('Error settling student account:', err);
    } finally {
      setSettlingStudentId(null);
    }
  };

  // Generate Invoice/Statement Text for WhatsApp
  const handleOpenInvoiceModal = (item: (typeof studentFinancials)[0]) => {
    const st = item.student;
    const unsettledLessons = (lessonsMap[st.id] || []).filter((l) => !l.settled);
    const lessonsListText = unsettledLessons
      .map(
        (l, i) =>
          `  ${i + 1}. [${l.date}] ${l.topic} (${l.duration || 60} دقيقة) - ${l.cost || Math.round(((l.duration || 60) / 60) * item.hourlyRate)} ج.م`
      )
      .join('\n');

    const text =
      `السلام عليكم ورحمة الله وبركاته 🌷\n` +
      `🧾 كشف حساب ومطالبة مالية - مادة (${st.subject})\n\n` +
      `👤 الطالب/ـة: ${st.name}\n` +
      `👨‍🏫 إعداد المعلم: أ. ${profile.name}\n` +
      `📅 التاريخ: ${new Intl.DateTimeFormat('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())}\n\n` +
      `📊 تفاصيل الحساب الحالي:\n` +
      `• سعر الساعة: ${item.hourlyRate} ج.م/ساعة\n` +
      `• عدد الساعات المنفذة: ${item.pendingHours} ساعة (${unsettledLessons.length} حصص)\n` +
      `• إجمالي المستحقات المطلوبة: ${item.pendingAmount} ج.م 💰\n\n` +
      (lessonsListText ? `📋 تفاصيل الحصص المنفذة غير المصفاة:\n${lessonsListText}\n\n` : '') +
      `شاكرين ومقدرين لكم حسن التعاون والاهتمام الدائم 🌟`;

    setEditableInvoiceText(text);
    setShowInvoiceModal(st);
  };

  const handleSendInvoiceWhatsApp = () => {
    if (!showInvoiceModal) return;
    const cleanPhone = showInvoiceModal.whatsapp ? showInvoiceModal.whatsapp.replace(/[^0-9]/g, '') : '';
    const phoneParam = cleanPhone.startsWith('0') ? '2' + cleanPhone : cleanPhone;
    const url = phoneParam
      ? `https://wa.me/${phoneParam}?text=${encodeURIComponent(editableInvoiceText)}`
      : `https://wa.me/?text=${encodeURIComponent(editableInvoiceText)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="space-y-4 pb-20 select-none text-right">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-purple-900/30 pb-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBackToApp}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-purple-900/50 hover:bg-purple-800/70 border border-purple-500/40 text-xs font-bold text-purple-200 hover:text-white transition cursor-pointer"
          >
            <ChevronRight className="w-4 h-4 text-amber-300" />
            <span>العودة للرئيسية</span>
          </button>
          <h2 className="text-base font-extrabold text-white flex items-center gap-2">
            <span>الملخص المالي والأرباح 💰</span>
          </h2>
        </div>

        <button
          type="button"
          disabled={loadingLessons}
          onClick={loadLessons}
          className="p-2 rounded-xl bg-slate-900 border border-purple-500/30 text-purple-300 hover:text-white transition cursor-pointer disabled:opacity-50"
          title="تحديث الحسابات والأرباح"
        >
          <RefreshCw className={`w-4 h-4 ${loadingLessons ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* 4 Hero KPI Cards */}
      <div className="grid grid-cols-2 gap-2.5">
        {/* Card 1: إجمالي أرباح الشهر */}
        <div className="rounded-2xl bg-gradient-to-br from-purple-950/80 via-slate-900 to-indigo-950/80 border border-purple-500/40 p-3.5 space-y-2 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-purple-200">أرباح هذا الشهر ({currentMonthName})</span>
            <div className="w-7 h-7 rounded-xl bg-purple-600/30 text-amber-300 flex items-center justify-center border border-purple-400/30 shadow">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-black text-white font-mono">{totalMonthEarnings.toLocaleString()}</span>
              <span className="text-xs text-amber-300 font-bold">ج.م</span>
            </div>
            <p className="text-[10px] text-purple-300/80 mt-0.5">محسوبة لكافة الطلاب لشهر {currentMonthName}</p>
          </div>
        </div>

        {/* Card 2: إجمالي ساعات التدريس */}
        <div className="rounded-2xl bg-gradient-to-br from-indigo-950/80 via-slate-900 to-slate-950 border border-indigo-500/40 p-3.5 space-y-2 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-indigo-200">إجمالي ساعات التدريس</span>
            <div className="w-7 h-7 rounded-xl bg-indigo-600/30 text-indigo-300 flex items-center justify-center border border-indigo-400/30 shadow">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-black text-white font-mono">{totalTeachingHours}</span>
              <span className="text-xs text-indigo-300 font-bold">ساعة</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">مجموع الساعات المنفذة كلياً</p>
          </div>
        </div>

        {/* Card 3: المستحقات المعلقة */}
        <div className="rounded-2xl bg-gradient-to-br from-amber-950/70 via-slate-900 to-slate-950 border border-amber-500/40 p-3.5 space-y-2 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-200">المستحقات المعلقة</span>
            <div className="w-7 h-7 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30 shadow">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-black text-amber-300 font-mono">{totalPendingDues.toLocaleString()}</span>
              <span className="text-xs text-amber-400 font-bold">ج.م</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">مبالغ بانتظار استلام الأجر والتصفية</p>
          </div>
        </div>

        {/* Card 4: المبالغ المحصلة */}
        <div className="rounded-2xl bg-gradient-to-br from-emerald-950/70 via-slate-900 to-slate-950 border border-emerald-500/40 p-3.5 space-y-2 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-200">المبالغ المحصلة</span>
            <div className="w-7 h-7 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30 shadow">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-black text-emerald-400 font-mono">{totalCollectedDues.toLocaleString()}</span>
              <span className="text-xs text-emerald-300 font-bold">ج.م</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">تم تصفية حسابها واستلامها بالفعل</p>
          </div>
        </div>
      </div>

      {/* Hourly Rate Engine Equation Banner */}
      <div className="rounded-2xl bg-slate-900/90 border border-purple-500/30 p-3 text-xs flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-xl bg-purple-600/30 text-amber-300 flex items-center justify-center border border-purple-400/30 flex-shrink-0">
          <Sparkles className="w-4 h-4" />
        </div>
        <div className="flex-1">
          <p className="font-bold text-white text-[11px]">محرك الحساب التلقائي بالساعة (Hourly Rate Engine):</p>
          <p className="text-[10px] text-purple-300/90 font-mono mt-0.5">
            قيمة الحصة = (مدة الحصة بالدقائق / 60) × سعر الساعة
          </p>
        </div>
      </div>

      {/* Search & Filter Controls */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث بالاسم أو المادة..."
              className="w-full rounded-xl bg-slate-900 border border-slate-800 pr-9 pl-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-400"
            />
          </div>

          <div className="flex items-center gap-1 text-xs">
            {(['all', 'pending', 'settled'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setFilterDues(mode)}
                className={`px-2.5 py-2 rounded-xl font-bold transition cursor-pointer text-[11px] ${
                  filterDues === mode
                    ? 'bg-purple-600 text-white shadow'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                {mode === 'all' ? 'الكل' : mode === 'pending' ? 'مستحقات معلقة' : 'مصفاة ✅'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Detailed Student Financial Cards */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-300">
            قائمة حسابات الطلاب والمستحقات ({filteredList.length})
          </h3>
          {totalPendingDues > 0 && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
              إجمالي المعلق: {totalPendingDues.toLocaleString()} ج.م
            </span>
          )}
        </div>

        {loadingLessons ? (
          <div className="py-8 text-center text-xs text-purple-300 bg-slate-900/50 rounded-2xl border border-slate-800">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-purple-400" />
            <p>جارٍ جمع واحتساب الساعات والحسابات لجميع الطلاب...</p>
          </div>
        ) : filteredList.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400 bg-slate-900/40 rounded-2xl border border-slate-800">
            لا توجد حسابات مطابقة للبحث المحدد.
          </div>
        ) : (
          filteredList.map((item) => {
            const st = item.student;
            const hasPending = item.pendingAmount > 0;

            return (
              <div
                key={st.id}
                className={`rounded-2xl bg-slate-900/90 border p-3.5 space-y-3 transition shadow-md ${
                  hasPending ? 'border-amber-500/30 hover:border-amber-400/50' : 'border-slate-800 hover:border-purple-500/40'
                }`}
              >
                {/* Card Header: Student Name & Hourly Rate */}
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-white">{st.name}</h4>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-950/80 border border-purple-500/30 text-purple-300">
                        {st.subject}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      سعر الساعة: <span className="font-bold text-amber-300 font-mono">{item.hourlyRate} ج.م/ساعة</span>
                      {st.whatsapp && ` • ${st.whatsapp}`}
                    </p>
                  </div>

                  {/* Pending Badge */}
                  {hasPending ? (
                    <div className="text-right">
                      <span className="inline-block text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono">
                        {item.pendingAmount.toLocaleString()} ج.م
                      </span>
                      <span className="block text-[9px] text-amber-400/80 mt-0.5">مستحقات معلقة</span>
                    </div>
                  ) : (
                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-950 border border-emerald-500/30 text-emerald-400">
                      تمت التصفية ✅
                    </span>
                  )}
                </div>

                {/* 3 Metrics Mini Grid */}
                <div className="grid grid-cols-3 gap-2 bg-slate-950/70 p-2.5 rounded-xl border border-slate-800 text-center text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 block">الساعات المعلقة</span>
                    <span className="font-bold text-white font-mono text-xs">
                      {item.pendingHours} <span className="text-[9px] text-slate-400">ساعة</span>
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">إجمالي المنفذ كلياً</span>
                    <span className="font-bold text-indigo-300 font-mono text-xs">
                      {item.totalHoursAll} <span className="text-[9px] text-slate-400">ساعة</span>
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">المحصل سابقاً</span>
                    <span className="font-bold text-emerald-400 font-mono text-xs">
                      {item.collectedAmount.toLocaleString()} <span className="text-[9px] text-slate-400">ج.م</span>
                    </span>
                  </div>
                </div>

                {/* Action Buttons Row */}
                <div className="flex items-center gap-2 pt-1 border-t border-slate-800/80">
                  {hasPending ? (
                    <button
                      type="button"
                      disabled={settlingStudentId === st.id}
                      onClick={() => setShowConfirmSettle(st)}
                      className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition cursor-pointer shadow flex items-center justify-center gap-1.5 active:scale-98"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>تصفية الحساب ({item.pendingAmount} ج.م)</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleOpenInvoiceModal(item)}
                      className="flex-1 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <span>كشف حساب الطالب</span>
                    </button>
                  )}

                  {hasPending && (
                    <button
                      type="button"
                      onClick={() => handleOpenInvoiceModal(item)}
                      className="py-2 px-3 rounded-xl bg-emerald-950/70 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-300 font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1"
                      title="إرسال فاتورة ومطالبة عبر واتساب"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>مطالبة واتساب</span>
                    </button>
                  )}

                  {onOpenStudentDetails && (
                    <button
                      type="button"
                      onClick={() => {
                        onBackToApp();
                        onOpenStudentDetails(st);
                      }}
                      className="py-2 px-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
                      title="عرض سجل حصص الطالب"
                    >
                      <span>السجل ←</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* MODAL: Confirmation Settle Account */}
      {showConfirmSettle && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 text-right">
          <div className="w-full max-w-sm bg-gradient-to-b from-slate-900 to-slate-950 border border-emerald-500/40 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center border border-emerald-500/30 flex-shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">تأكيد تصفية واستلام الحساب</h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  الطالب/ـة: <span className="font-bold text-emerald-400">{showConfirmSettle.name}</span>
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed bg-slate-950 p-3 rounded-xl border border-slate-800">
              هل تم استلام كامل المستحقات لهذا الطالب وبدء دورة حسابية جديدة؟ سيتم تعليم جميع الحصص السابقة كمصفاة ومحصلة بنجاح.
            </p>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                disabled={settlingStudentId === showConfirmSettle.id}
                onClick={() => handleConfirmSettleAccount(showConfirmSettle)}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition cursor-pointer shadow-lg shadow-emerald-950/50 active:scale-98 disabled:opacity-50"
              >
                {settlingStudentId === showConfirmSettle.id ? 'جارٍ التصفية...' : 'تأكيد التصفية ✅'}
              </button>
              <button
                type="button"
                onClick={() => setShowConfirmSettle(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition cursor-pointer active:scale-98"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Invoice / Statement WhatsApp Text Preview & Edit */}
      {showInvoiceModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 text-right">
          <div className="w-full max-w-lg bg-slate-900 border border-emerald-500/40 rounded-3xl p-5 shadow-2xl text-right max-h-[92vh] flex flex-col space-y-3">
            <div className="flex items-center justify-between border-b border-emerald-900/40 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center border border-emerald-500/30">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">معاينة وتعديل كشف الحساب والمطالبة</h3>
                  <p className="text-[10px] text-slate-400">
                    الطالب/ـة: {showInvoiceModal.name} {showInvoiceModal.whatsapp ? `• ${showInvoiceModal.whatsapp}` : ''}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowInvoiceModal(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300">
              يمكنك تعديل نص المطالبة المالية بحرية داخل مربع النص قبل الضغط على زر الإرسال عبر الواتساب:
            </p>

            {/* Editable Textarea */}
            <div className="flex-1 flex flex-col">
              <textarea
                value={editableInvoiceText}
                onChange={(e) => setEditableInvoiceText(e.target.value)}
                rows={11}
                className="w-full rounded-2xl bg-slate-950/90 border border-emerald-500/30 focus:border-emerald-400 p-3.5 text-xs text-slate-100 font-sans leading-relaxed focus:outline-none focus:ring-1 focus:ring-emerald-500/40 transition resize-y"
                placeholder="نص المطالبة المالية..."
              />
            </div>

            {/* Action Buttons */}
            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={handleSendInvoiceWhatsApp}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition cursor-pointer shadow-lg shadow-emerald-950/50 active:scale-98"
              >
                <Send className="w-4 h-4" />
                <span>إرسال المطالبة المالية عبر واتساب الآن 💬</span>
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(editableInvoiceText);
                    setCopiedInvoice(true);
                    setTimeout(() => setCopiedInvoice(false), 2000);
                  }}
                  className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition cursor-pointer active:scale-98"
                >
                  {copiedInvoice ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedInvoice ? 'تم النسخ بنجاح!' : 'نسخ نص المطالبة'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowInvoiceModal(null)}
                  className="flex items-center justify-center py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer active:scale-98"
                >
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
