import React, { useState, useEffect } from 'react';
import { TeacherProfile, Student, LessonLog } from '../types';
import { fetchAllStudentLessons, settleStudentAccount } from '../firebase';
import { useBackHandler } from '../services/backHandler';
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  CreditCard,
  MessageCircle,
  RefreshCw,
  Search,
  ChevronRight,
  Sparkles,
  Calendar,
  X,
  Send,
  Copy,
  Check,
  FileText,
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
  const currency = profile.currency || 'ج.م';
  const [loadingLessons, setLoadingLessons] = useState(true);
  const [lessonsMap, setLessonsMap] = useState<Record<string, LessonLog[]>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDues, setFilterDues] = useState<'all' | 'pending' | 'settled'>('all');
  const [settlingStudentId, setSettlingStudentId] = useState<string | null>(null);
  const [showConfirmSettle, setShowConfirmSettle] = useState<Student | null>(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState<Student | null>(null);
  const [editableInvoiceText, setEditableInvoiceText] = useState('');
  const [copiedInvoice, setCopiedInvoice] = useState(false);

  // Register modals on back handler stack
  useBackHandler(!!showConfirmSettle, () => setShowConfirmSettle(null), 'financial_confirm_settle');
  useBackHandler(!!showInvoiceModal, () => setShowInvoiceModal(null), 'financial_invoice_modal');

  // Today's date key (e.g. "2026-10-01") and Current Month Key (e.g. "2026-10")
  const now = new Date();
  const todayKey = now.toISOString().split('T')[0];
  const currentMonthKey = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
  
  // Selected Month State (Default to current month key)
  const [selectedMonthKey, setSelectedMonthKey] = useState<string>(currentMonthKey);

  // Load all lessons for students from Firebase
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

  // Build dynamic list of months from lessons and past months
  const availableMonths = React.useMemo(() => {
    const keysSet = new Set<string>();
    keysSet.add(currentMonthKey);

    Object.values(lessonsMap).forEach((lessons) => {
      lessons.forEach((l) => {
        if (l.date && l.date.length >= 7) {
          keysSet.add(l.date.substring(0, 7));
        }
      });
    });

    for (let i = 0; i <= 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const k = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
      keysSet.add(k);
    }

    const sortedKeys = Array.from(keysSet).sort().reverse();

    return sortedKeys.map((k) => {
      const [y, m] = k.split('-').map(Number);
      const d = new Date(y, m - 1, 1);
      const label = new Intl.DateTimeFormat('ar-EG', { month: 'long', year: 'numeric' }).format(d);
      return {
        key: k,
        label,
        isCurrent: k === currentMonthKey,
      };
    });
  }, [lessonsMap, currentMonthKey]);

  const selectedMonthInfo = availableMonths.find((m) => m.key === selectedMonthKey) || {
    key: selectedMonthKey,
    label: selectedMonthKey === 'all' ? 'كامل السجل التراكمي' : selectedMonthKey,
    isCurrent: selectedMonthKey === currentMonthKey,
  };

  const isAllTime = selectedMonthKey === 'all';

  // Calculate statistics per student
  const studentFinancials = students.map((st) => {
    const studentLessons = lessonsMap[st.id] || [];
    const hourlyRate = st.hourlyRate || (st.monthlyFee ? Math.round(st.monthlyFee / 4) : 100);

    // 1. Filter lessons for the Selected Month / Period
    const periodLessons = isAllTime
      ? studentLessons
      : studentLessons.filter((l) => l.date && l.date.startsWith(selectedMonthKey));

    let periodMinutes = 0;
    let periodAmount = 0;
    let pendingMinutes = 0;
    let pendingAmount = 0;
    let collectedAmount = 0;

    periodLessons.forEach((l) => {
      const dur = l.duration || 60;
      const rate = l.hourlyRate || hourlyRate;
      const cost = l.cost !== undefined ? l.cost : Math.round((dur / 60) * rate);

      periodMinutes += dur;
      periodAmount += cost;

      if (l.settled) {
        collectedAmount += cost;
      } else {
        pendingMinutes += dur;
        pendingAmount += cost;
      }
    });

    const periodHours = Number((periodMinutes / 60).toFixed(1));

    // 2. Filter lessons specifically for TODAY (ساعات اليوم منفصلة)
    const todayLessons = studentLessons.filter((l) => l.date === todayKey);
    const todayMinutes = todayLessons.reduce((sum, l) => sum + (l.duration || 60), 0);
    const todayHours = Number((todayMinutes / 60).toFixed(1));
    const todayEarnings = todayLessons.reduce((sum, l) => {
      const dur = l.duration || 60;
      const rate = l.hourlyRate || hourlyRate;
      return sum + (l.cost !== undefined ? l.cost : Math.round((dur / 60) * rate));
    }, 0);

    return {
      student: st,
      hourlyRate,
      lessonsCount: periodLessons.length,
      periodMinutes,
      periodHours,
      periodAmount,
      pendingMinutes,
      pendingAmount,
      collectedAmount,
      todayLessonsCount: todayLessons.length,
      todayHours,
      todayEarnings,
    };
  });

  // Global Aggregates for Selected Period
  const totalPeriodEarnings = studentFinancials.reduce((sum, item) => sum + item.periodAmount, 0);
  const totalPeriodTeachingMinutes = studentFinancials.reduce((sum, item) => sum + item.periodMinutes, 0);
  const totalPeriodTeachingHours = (totalPeriodTeachingMinutes / 60).toFixed(1);
  const totalPeriodPendingDues = studentFinancials.reduce((sum, item) => sum + item.pendingAmount, 0);
  const totalPeriodCollectedDues = studentFinancials.reduce((sum, item) => sum + item.collectedAmount, 0);
  const totalPeriodLessonsCount = studentFinancials.reduce((sum, item) => sum + item.lessonsCount, 0);

  // Global Aggregates for TODAY (ساعات وأرباح اليوم الإجمالية)
  const totalTodayHours = studentFinancials.reduce((sum, item) => sum + item.todayHours, 0).toFixed(1);
  const totalTodayEarnings = studentFinancials.reduce((sum, item) => sum + item.todayEarnings, 0);
  const totalTodayLessonsCount = studentFinancials.reduce((sum, item) => sum + item.todayLessonsCount, 0);

  // Month navigation helpers
  const handlePrevMonth = () => {
    const currentIndex = availableMonths.findIndex((m) => m.key === selectedMonthKey);
    if (currentIndex !== -1 && currentIndex < availableMonths.length - 1) {
      setSelectedMonthKey(availableMonths[currentIndex + 1].key);
    }
  };

  const handleNextMonth = () => {
    const currentIndex = availableMonths.findIndex((m) => m.key === selectedMonthKey);
    if (currentIndex > 0) {
      setSelectedMonthKey(availableMonths[currentIndex - 1].key);
    }
  };

  // Filter list by search & status
  const filteredList = studentFinancials.filter((item) => {
    const matchesSearch =
      item.student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.student.subject.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;

    if (filterDues === 'pending') return item.pendingAmount > 0;
    if (filterDues === 'settled') return item.pendingAmount === 0 && item.collectedAmount > 0;
    return true;
  });

  // Settle Account Handler
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

  // WhatsApp Invoice Generator
  const handleOpenInvoiceModal = (item: (typeof studentFinancials)[0]) => {
    const st = item.student;
    const studentLessons = lessonsMap[st.id] || [];
    const targetLessons = isAllTime
      ? studentLessons.filter((l) => !l.settled)
      : studentLessons.filter((l) => l.date && l.date.startsWith(selectedMonthKey) && !l.settled);

    const lessonsListText = targetLessons
      .map(
        (l, i) =>
          `  ${i + 1}. [${l.date}] ${l.topic} (${l.duration || 60} دقيقة) - ${l.cost || Math.round(((l.duration || 60) / 60) * item.hourlyRate)} ${currency}`
      )
      .join('\n');

    const text =
      `السلام عليكم ورحمة الله وبركاته 🌷\n` +
      `🧾 كشف حساب ومطالبة مالية (${selectedMonthInfo.label}) - مادة (${st.subject})\n\n` +
      `👤 الطالب/ـة: ${st.name}\n` +
      `👨‍🏫 إعداد المعلم: أ. ${profile.name}\n` +
      `📅 الفترة: ${selectedMonthInfo.label}\n\n` +
      `📊 تفاصيل الحساب:\n` +
      `• سعر الساعة: ${item.hourlyRate} ${currency}\n` +
      `• عدد الساعات المنفذة: ${item.pendingMinutes / 60} ساعة\n` +
      `• إجمالي المستحقات المطلوبة: ${item.pendingAmount} ${currency} 💰\n\n` +
      (lessonsListText ? `📋 تفاصيل الحصص:\n${lessonsListText}\n\n` : '') +
      `شاكرين حسن تعاملك 🌟`;

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

  // Export PDF Report
  const handleExportPDF = () => {
    const printContent = `
      <!DOCTYPE html>
      <html lang="ar" dir="rtl">
        <head>
          <meta charset="UTF-8" />
          <title>التقرير المالي (${selectedMonthInfo.label}) - سند المعلم</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap');
            body { font-family: 'Cairo', sans-serif; direction: rtl; text-align: right; padding: 20px; color: #0f172a; }
            h1 { color: #4c1d95; font-size: 20px; margin-bottom: 5px; }
            p { font-size: 12px; color: #64748b; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 11px; }
            th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: right; }
            th { background: #f1f5f9; font-weight: bold; }
          </style>
        </head>
        <body>
          <h1>التقرير المالي والأرباح 💰</h1>
          <p>المعلم: أ. ${profile.name} • المادة: ${profile.subject || 'عام'} • الفترة: ${selectedMonthInfo.label}</p>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>اسم الطالب</th>
                <th>المادة</th>
                <th>سعر الساعة</th>
                <th>حصص الفترة</th>
                <th>ساعات الفترة</th>
                <th>المستحقات المعلقة</th>
                <th>المحصل</th>
              </tr>
            </thead>
            <tbody>
              ${studentFinancials.map((item, idx) => `
                <tr>
                  <td>${idx + 1}</td>
                  <td><strong>${item.student.name}</strong></td>
                  <td>${item.student.subject}</td>
                  <td>${item.hourlyRate}${currency}</td>
                  <td>${item.lessonsCount}</td>
                  <td>${item.periodHours} س</td>
                  <td>${item.pendingAmount}${currency}</td>
                  <td>${item.collectedAmount}${currency}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `;
    const printFrame = document.createElement('iframe');
    printFrame.style.display = 'none';
    document.body.appendChild(printFrame);
    const doc = printFrame.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(printContent);
      doc.close();
      setTimeout(() => {
        printFrame.contentWindow?.print();
        document.body.removeChild(printFrame);
      }, 500);
    }
  };

  return (
    <div className="space-y-4 pb-20 select-none text-right">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-purple-900/30 pb-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportPDF}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition cursor-pointer shadow"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>تصدير PDF</span>
          </button>
          <button
            type="button"
            onClick={onBackToApp}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-purple-900/50 hover:bg-purple-800/70 border border-purple-500/40 text-xs font-bold text-purple-200 transition cursor-pointer"
          >
            <ChevronRight className="w-4 h-4 text-amber-300" />
            <span>الرئيسية</span>
          </button>
          <h2 className="text-base font-extrabold text-white">الملخص المالي والأرباح 💰</h2>
        </div>

        <button
          type="button"
          disabled={loadingLessons}
          onClick={loadLessons}
          className="p-2 rounded-xl bg-slate-900 border border-purple-500/30 text-purple-300 hover:text-white transition cursor-pointer"
          title="تحديث الحسابات"
        >
          <RefreshCw className={`w-4 h-4 ${loadingLessons ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* TODAY'S QUICK STATS (ساعات وأرباح اليوم الواحد) */}
      <div className="rounded-2xl bg-gradient-to-r from-blue-950/80 via-slate-900 to-indigo-950/80 border border-blue-500/40 p-3.5 shadow-md flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-600/30 text-blue-300 flex items-center justify-center border border-blue-400/30">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <span className="text-xs font-bold text-white block">إنجاز اليوم ({todayKey})</span>
            <span className="text-[10px] text-blue-200/80">
              {totalTodayLessonsCount > 0 ? `${totalTodayLessonsCount} حصص منفذة اليوم` : 'لا توجد حصص مسجلة اليوم'}
            </span>
          </div>
        </div>
        <div className="text-left">
          <span className="text-sm font-black text-amber-300 font-mono">{totalTodayHours} ساعة</span>
          <span className="block text-[10px] text-slate-300 font-mono">({totalTodayEarnings} {currency})</span>
        </div>
      </div>

      {/* MONTH / YEAR ARCHIVE PICKER (فلتر الشهور المستقلة) */}
      <div className="rounded-2xl bg-gradient-to-r from-purple-950/80 via-slate-900 to-indigo-950/80 border border-purple-500/40 p-3.5 space-y-2.5 shadow-lg">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-purple-600/30 text-amber-300 flex items-center justify-center border border-purple-400/30">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-white">دورة الشهر المالي (أرشيف مستقل)</span>
                {selectedMonthInfo.isCurrent && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 border border-emerald-500/40 text-emerald-300 font-bold">
                    الشهر الحالي 🟢
                  </span>
                )}
              </div>
              <p className="text-[10px] text-purple-300/80">حساب الأرباح والساعات لكل شهر بشكل منفصل تماماً</p>
            </div>
          </div>

          {!selectedMonthInfo.isCurrent && (
            <button
              type="button"
              onClick={() => setSelectedMonthKey(currentMonthKey)}
              className="text-[11px] font-bold px-2.5 py-1 rounded-xl bg-purple-600 hover:bg-purple-500 text-white transition cursor-pointer"
            >
              الشهر الحالي ⚡
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={handlePrevMonth}
            disabled={selectedMonthKey === 'all' || availableMonths.findIndex((m) => m.key === selectedMonthKey) >= availableMonths.length - 1}
            className="px-2.5 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 hover:text-white disabled:opacity-40 text-xs font-bold transition cursor-pointer"
          >
            ‹ السابق
          </button>

          <div className="flex-1">
            <select
              value={selectedMonthKey}
              onChange={(e) => setSelectedMonthKey(e.target.value)}
              className="w-full rounded-xl bg-slate-950 border border-purple-500/40 px-3 py-1.5 text-xs font-bold text-white focus:outline-none cursor-pointer text-center"
            >
              {availableMonths.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label} {m.isCurrent ? '(الحالي)' : ''}
                </option>
              ))}
              <option value="all">📊 كامل السجل التراكمي</option>
            </select>
          </div>

          <button
            type="button"
            onClick={handleNextMonth}
            disabled={selectedMonthKey === 'all' || availableMonths.findIndex((m) => m.key === selectedMonthKey) <= 0}
            className="px-2.5 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 hover:text-white disabled:opacity-40 text-xs font-bold transition cursor-pointer"
          >
            التالي ›
          </button>
        </div>
      </div>

      {/* 4 HERO KPI CARDS */}
      <div className="grid grid-cols-2 gap-2.5">
        <div className="rounded-2xl bg-slate-900/90 border border-purple-500/40 p-3.5 space-y-1.5 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-purple-200">أرباح الفترة ({selectedMonthInfo.label})</span>
            <TrendingUp className="w-4 h-4 text-amber-300" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-black text-white font-mono">{totalPeriodEarnings.toLocaleString()}</span>
            <span className="text-xs text-amber-300 font-bold">{currency}</span>
          </div>
          <p className="text-[10px] text-purple-300/80">{totalPeriodLessonsCount} حصص منفذة</p>
        </div>

        <div className="rounded-2xl bg-slate-900/90 border border-indigo-500/40 p-3.5 space-y-1.5 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-indigo-200">ساعات تدريس الفترة</span>
            <Clock className="w-4 h-4 text-indigo-300" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-black text-white font-mono">{totalPeriodTeachingHours}</span>
            <span className="text-xs text-indigo-300 font-bold">ساعة</span>
          </div>
          <p className="text-[10px] text-slate-400">إجمالي مدة الحصص</p>
        </div>

        <div className="rounded-2xl bg-slate-900/90 border border-amber-500/40 p-3.5 space-y-1.5 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-200">المستحقات المعلقة</span>
            <AlertCircle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-black text-amber-300 font-mono">{totalPeriodPendingDues.toLocaleString()}</span>
            <span className="text-xs text-amber-400 font-bold">{currency}</span>
          </div>
          <p className="text-[10px] text-slate-400">تحت انتظار التحصيل</p>
        </div>

        <div className="rounded-2xl bg-slate-900/90 border border-emerald-500/40 p-3.5 space-y-1.5 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-200">المبالغ المحصلة</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-black text-emerald-400 font-mono">{totalPeriodCollectedDues.toLocaleString()}</span>
            <span className="text-xs text-emerald-300 font-bold">{currency}</span>
          </div>
          <p className="text-[10px] text-slate-400">تمت تصفيتها بنجاح</p>
        </div>
      </div>

      {/* Hourly Rate Rule Notice */}
      <div className="rounded-2xl bg-slate-900/90 border border-purple-500/30 p-3 text-xs flex items-center gap-2.5">
        <Sparkles className="w-4 h-4 text-amber-300 flex-shrink-0" />
        <p className="text-[11px] text-purple-200">
          <strong className="text-white">نظام الحساب الأوتوماتيكي:</strong> قيمة الحصة = (الدقائق ÷ 60) × سعر الساعة.
        </p>
      </div>

      {/* Search & Filters */}
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

          <div className="flex items-center gap-1">
            {(['all', 'pending', 'settled'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setFilterDues(mode)}
                className={`px-2.5 py-2 rounded-xl font-bold text-[11px] transition cursor-pointer ${
                  filterDues === mode ? 'bg-purple-600 text-white' : 'bg-slate-900 text-slate-400 border border-slate-800'
                }`}
              >
                {mode === 'all' ? 'الكل' : mode === 'pending' ? 'المعلق' : 'المصفى'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* STUDENTS LIST */}
      <div className="space-y-2.5">
        <h3 className="text-xs font-bold text-slate-300">
          حسابات الطلاب لفترة ({selectedMonthInfo.label}) ({filteredList.length})
        </h3>

        {loadingLessons ? (
          <div className="py-8 text-center text-xs text-purple-300 bg-slate-900/50 rounded-2xl border border-slate-800">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-purple-400" />
            <p>جارٍ تحميل الحسابات...</p>
          </div>
        ) : filteredList.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400 bg-slate-900/40 rounded-2xl border border-slate-800">
            لا توجد حسابات مطابقة لهذه الفترة.
          </div>
        ) : (
          filteredList.map((item) => {
            const st = item.student;
            const hasPending = item.pendingAmount > 0;

            return (
              <div
                key={st.id}
                className={`rounded-2xl bg-slate-900/90 border p-3.5 space-y-3 transition shadow-md ${
                  hasPending ? 'border-amber-500/40' : 'border-slate-800'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-white">{st.name}</h4>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-950 border border-purple-500/30 text-purple-300">
                        {st.subject}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      سعر الساعة: <span className="font-bold text-amber-300 font-mono">{item.hourlyRate} {currency}</span>
                      {st.whatsapp && ` • ${st.whatsapp}`}
                    </p>
                  </div>

                  {hasPending ? (
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono">
                      {item.pendingAmount.toLocaleString()} {currency}
                    </span>
                  ) : item.collectedAmount > 0 ? (
                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-950 border border-emerald-500/30 text-emerald-400">
                      مصفى ✅
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400">لا حصص</span>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 bg-slate-950/70 p-2 rounded-xl border border-slate-800 text-center text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 block">ساعات الفترة</span>
                    <span className="font-bold text-white font-mono">{item.periodHours} س ({item.lessonsCount})</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">المعلق</span>
                    <span className="font-bold text-amber-300 font-mono">{item.pendingAmount} {currency}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">المحصل</span>
                    <span className="font-bold text-emerald-400 font-mono">{item.collectedAmount} {currency}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1 border-t border-slate-800">
                  {hasPending ? (
                    <button
                      type="button"
                      disabled={settlingStudentId === st.id}
                      onClick={() => setShowConfirmSettle(st)}
                      className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>تصفية الحساب ({item.pendingAmount} {currency})</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleOpenInvoiceModal(item)}
                      className="flex-1 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition cursor-pointer flex items-center justify-center"
                    >
                      <span>كشف حساب الفترة</span>
                    </button>
                  )}

                  {hasPending && (
                    <button
                      type="button"
                      onClick={() => handleOpenInvoiceModal(item)}
                      className="py-2 px-3 rounded-xl bg-emerald-950/70 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-300 font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>واتساب</span>
                    </button>
                  )}

                  {onOpenStudentDetails && (
                    <button
                      type="button"
                      onClick={() => {
                        onBackToApp();
                        onOpenStudentDetails(st);
                      }}
                      className="py-2 px-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition cursor-pointer"
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

      {/* CONFIRM SETTLE MODAL */}
      {showConfirmSettle && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-slate-900 border border-emerald-500/40 rounded-3xl p-5 space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-white">تأكيد تصفية واستلام الحساب</h3>
            <p className="text-xs text-slate-300">
              هل أنت متأكد من استلام كامل مستحقات الطالب <span className="text-emerald-400 font-bold">{showConfirmSettle.name}</span>؟
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleConfirmSettleAccount(showConfirmSettle)}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-xs cursor-pointer"
              >
                تأكيد التصفية ✅
              </button>
              <button
                type="button"
                onClick={() => setShowConfirmSettle(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WHATSAPP INVOICE MODAL */}
      {showInvoiceModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-emerald-500/40 rounded-3xl p-5 space-y-3 shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-emerald-900/40 pb-2">
              <h3 className="text-sm font-bold text-white">مطالبة واتساب المالية</h3>
              <button type="button" onClick={() => setShowInvoiceModal(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <textarea
              value={editableInvoiceText}
              onChange={(e) => setEditableInvoiceText(e.target.value)}
              rows={10}
              className="w-full rounded-xl bg-slate-950 border border-emerald-500/30 p-3 text-xs text-slate-100 focus:outline-none"
            />
            <button
              type="button"
              onClick={handleSendInvoiceWhatsApp}
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow"
            >
              <Send className="w-4 h-4" />
              <span>إرسال عبر واتساب الآن 💬</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
