import React, { useState, useMemo, useEffect } from 'react';
import { Student, TeacherProfile, LessonLog, isLessonFinanciallyCounted, SUPPORTED_CURRENCIES } from '../types';
import { useBackHandler } from '../services/backHandler';
import {
  ReportType,
  ReportOptions,
  exportReportToPdf,
} from '../services/pdfReportService';
import {
  FileText,
  DollarSign,
  UserCheck,
  Calendar,
  Download,
  Printer,
  X,
  Sparkles,
  MessageCircle,
  Coins,
} from 'lucide-react';

interface StudentPdfExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: Student;
  teacher: TeacherProfile;
  lessons: LessonLog[];
  defaultReportType?: ReportType;
}

export const StudentPdfExportModal: React.FC<StudentPdfExportModalProps> = ({
  isOpen,
  onClose,
  student,
  teacher,
  lessons,
  defaultReportType = 'financial',
}) => {
  useBackHandler(isOpen, onClose, 'student_pdf_export_modal');

  const [reportType, setReportType] = useState<ReportType>(defaultReportType);
  const [dateFilterMode, setDateFilterMode] = useState<'all' | 'this_month' | 'last_month' | 'custom'>('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [teacherNote, setTeacherNote] = useState('');
  const [includeHomework, setIncludeHomework] = useState(true);

  // Compute actual start & end date for the selected filter
  const { startDate, endDate } = useMemo(() => {
    const now = new Date();
    if (dateFilterMode === 'this_month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return {
        startDate: new Intl.DateTimeFormat('en-CA').format(start),
        endDate: new Intl.DateTimeFormat('en-CA').format(end),
      };
    } else if (dateFilterMode === 'last_month') {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return {
        startDate: new Intl.DateTimeFormat('en-CA').format(start),
        endDate: new Intl.DateTimeFormat('en-CA').format(end),
      };
    } else if (dateFilterMode === 'custom') {
      return {
        startDate: customStartDate || undefined,
        endDate: customEndDate || undefined,
      };
    }
    return { startDate: undefined, endDate: undefined };
  }, [dateFilterMode, customStartDate, customEndDate]);

  const [currency, setCurrency] = useState(teacher.currency || 'ج.م');
  useEffect(() => {
    if (teacher.currency) setCurrency(teacher.currency);
  }, [teacher.currency]);

  const reportOptions: ReportOptions = useMemo(
    () => ({
      reportType,
      startDate,
      endDate,
      teacherNote: teacherNote.trim() || undefined,
      includeHomework,
      currency,
    }),
    [reportType, startDate, endDate, teacherNote, includeHomework, currency]
  );

  // Filter lessons for live metrics preview
  const filteredLessons = useMemo(() => {
    let list = [...lessons].sort((a, b) => b.date.localeCompare(a.date));
    if (startDate) list = list.filter((l) => l.date >= startDate);
    if (endDate) list = list.filter((l) => l.date <= endDate);
    return list;
  }, [lessons, startDate, endDate]);

  const hourlyRate =
    student.hourlyRate || (student.monthlyFee ? Math.round(student.monthlyFee / 4) : 100);

  const totalLessons = filteredLessons.length;
  const presentCount = filteredLessons.filter((l) => l.attendance === 'present').length;
  const absentCount = filteredLessons.filter((l) => l.attendance === 'absent').length;
  const excusedCount = filteredLessons.filter((l) => l.attendance === 'excused').length;
  const attRate = totalLessons > 0 ? Math.round((presentCount / totalLessons) * 100) : 100;

  const pendingAmount = filteredLessons
    .filter((l) => !l.settled && isLessonFinanciallyCounted(l))
    .reduce((acc, l) => {
      const dur = l.duration || 60;
      const rate = l.hourlyRate || hourlyRate;
      return acc + (l.cost !== undefined ? l.cost : Math.round((dur / 60) * rate));
    }, 0);

  const collectedAmount = filteredLessons
    .filter((l) => l.settled)
    .reduce((acc, l) => {
      const dur = l.duration || 60;
      const rate = l.hourlyRate || hourlyRate;
      return acc + (l.cost !== undefined ? l.cost : Math.round((dur / 60) * rate));
    }, 0);

  if (!isOpen) return null;

  const handleExport = () => {
    exportReportToPdf(student, teacher, lessons, reportOptions);
  };

  const handleShareWhatsAppSummary = () => {
    let summaryText = '';
    if (reportType === 'financial') {
      summaryText = `السلام عليكم ورحمة الله وبركاته 🌷\n📄 كشف حساب الطالب/ـة: ${student.name}\n📚 المادة: ${student.subject}\n👨‍🏫 المعلم: أ. ${teacher.name}\n\n📊 ملخص الحسابات:\n• إجمالي الحصص المنفذة: ${totalLessons} حصة\n• إجمالي المبالغ المسددة: ${collectedAmount} ${currency}\n• المستحقات المعلقة الحالية: ${pendingAmount} ${currency}\n\n${teacherNote ? `📝 ملاحظة المعلم: ${teacherNote}\n\n` : ''}تم استخراج هذا التقرير عبر تطبيق سند المعلم.`;
    } else if (reportType === 'attendance') {
      summaryText = `السلام عليكم ورحمة الله وبركاته 🌷\n📊 تقرير الحضور والمواظبة للطالب/ـة: ${student.name}\n📚 المادة: ${student.subject}\n👨‍🏫 المعلم: أ. ${teacher.name}\n\n📈 معدل الحضور: ${attRate}%\n• الحصص المحضورة: ${presentCount}\n• عدد الغيابات: ${absentCount}\n• الاعتذارات المسبقة: ${excusedCount}\n\n${teacherNote ? `📝 ملاحظة المعلم: ${teacherNote}\n\n` : ''}تحياتنا وتقديرنا، أ. ${teacher.name}`;
    } else {
      summaryText = `السلام عليكم ورحمة الله وبركاته 🌷\n📋 التقرير الشامل للطالب/ـة: ${student.name}\n📚 المادة: ${student.subject}\n👨‍🏫 المعلم: أ. ${teacher.name}\n\n• إجمالي الحصص: ${totalLessons}\n• نسبة الحضور: ${attRate}%\n• المستحقات المعلقة: ${pendingAmount} ${currency}\n\n${teacherNote ? `📝 ملاحظة المعلم: ${teacherNote}\n\n` : ''}خالص التقدير والتحية.`;
    }

    const cleanPhone = student.whatsapp ? student.whatsapp.replace(/[^0-9]/g, '') : '';
    const waUrl = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(summaryText)}`
      : `https://wa.me/?text=${encodeURIComponent(summaryText)}`;

    window.open(waUrl, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-lg bg-slate-900 border border-purple-500/40 rounded-3xl p-5 shadow-2xl text-right max-h-[92vh] flex flex-col space-y-4 animate-fadeIn">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-purple-900/40 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center shadow-md">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white">تصدير تقرير وكشف حساب PDF</h3>
              <p className="text-xs text-purple-300">
                الطالب/ـة: {student.name} • {student.subject}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto pr-1 flex-1 text-xs">
          {/* 1. Report Type Selector */}
          <div>
            <label className="block text-slate-300 font-bold mb-2">نوع التقرير المطلوب تصديره:</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setReportType('financial')}
                className={`p-3 rounded-2xl border transition flex flex-col items-center justify-center gap-1.5 text-center cursor-pointer ${
                  reportType === 'financial'
                    ? 'bg-emerald-600/30 border-emerald-400 text-emerald-200 ring-2 ring-emerald-400/40 shadow-lg'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <DollarSign className="w-4 h-4 text-emerald-400" />
                <span className="font-bold text-[11px]">كشف حساب مالي</span>
                <span className="text-[9px] opacity-75">المستحقات والتصفية</span>
              </button>

              <button
                type="button"
                onClick={() => setReportType('attendance')}
                className={`p-3 rounded-2xl border transition flex flex-col items-center justify-center gap-1.5 text-center cursor-pointer ${
                  reportType === 'attendance'
                    ? 'bg-purple-600/30 border-purple-400 text-purple-200 ring-2 ring-purple-400/40 shadow-lg'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <UserCheck className="w-4 h-4 text-purple-400" />
                <span className="font-bold text-[11px]">تقرير الحضور والغياب</span>
                <span className="text-[9px] opacity-75">المواظبة والاعتذارات</span>
              </button>

              <button
                type="button"
                onClick={() => setReportType('comprehensive')}
                className={`p-3 rounded-2xl border transition flex flex-col items-center justify-center gap-1.5 text-center cursor-pointer ${
                  reportType === 'comprehensive'
                    ? 'bg-blue-600/30 border-blue-400 text-blue-200 ring-2 ring-blue-400/40 shadow-lg'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <Sparkles className="w-4 h-4 text-blue-400" />
                <span className="font-bold text-[11px]">تقرير شامل</span>
                <span className="text-[9px] opacity-75">مالي + أكاديمي</span>
              </button>
            </div>
          </div>

          {/* 2. Date Range Filter */}
          <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-slate-300 font-bold flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-purple-400" />
                <span>النطاق الزمني للتقرير</span>
              </label>
              <span className="text-[10px] text-purple-300 font-mono">
                {filteredLessons.length} حصة مختارة
              </span>
            </div>

            <div className="grid grid-cols-4 gap-1.5">
              <button
                type="button"
                onClick={() => setDateFilterMode('all')}
                className={`py-1.5 px-2 rounded-xl text-[11px] font-bold border transition cursor-pointer text-center ${
                  dateFilterMode === 'all'
                    ? 'bg-purple-600 border-purple-400 text-white'
                    : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
                }`}
              >
                كامل السجل
              </button>
              <button
                type="button"
                onClick={() => setDateFilterMode('this_month')}
                className={`py-1.5 px-2 rounded-xl text-[11px] font-bold border transition cursor-pointer text-center ${
                  dateFilterMode === 'this_month'
                    ? 'bg-purple-600 border-purple-400 text-white'
                    : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
                }`}
              >
                هذا الشهر
              </button>
              <button
                type="button"
                onClick={() => setDateFilterMode('last_month')}
                className={`py-1.5 px-2 rounded-xl text-[11px] font-bold border transition cursor-pointer text-center ${
                  dateFilterMode === 'last_month'
                    ? 'bg-purple-600 border-purple-400 text-white'
                    : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
                }`}
              >
                الشهر السابق
              </button>
              <button
                type="button"
                onClick={() => setDateFilterMode('custom')}
                className={`py-1.5 px-2 rounded-xl text-[11px] font-bold border transition cursor-pointer text-center ${
                  dateFilterMode === 'custom'
                    ? 'bg-purple-600 border-purple-400 text-white'
                    : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
                }`}
              >
                مخصص...
              </button>
            </div>

            {dateFilterMode === 'custom' && (
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">من تاريخ:</label>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="w-full rounded-xl bg-slate-900 border border-slate-700 px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-purple-400 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">إلى تاريخ:</label>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="w-full rounded-xl bg-slate-900 border border-slate-700 px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-purple-400 font-mono"
                  />
                </div>
              </div>
            )}
          </div>

          {/* 3. Live Preview Summary Metrics */}
          <div className="p-3 rounded-2xl bg-gradient-to-r from-purple-950/40 via-slate-950/60 to-indigo-950/40 border border-purple-500/20 space-y-2">
            <span className="text-[10px] font-bold text-slate-400 block">معاينة أرقام التقرير:</span>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2 rounded-xl bg-slate-900/80 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">عدد الحصص</span>
                <span className="font-bold text-white font-mono text-sm">{totalLessons}</span>
              </div>
              <div className="p-2 rounded-xl bg-slate-900/80 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">نسبة الحضور</span>
                <span className="font-bold text-emerald-400 font-mono text-sm">{attRate}%</span>
              </div>
              <div className="p-2 rounded-xl bg-slate-900/80 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">المستحق المعلق</span>
                <span className="font-bold text-amber-300 font-mono text-sm">
                  {pendingAmount} {currency}
                </span>
              </div>
            </div>
          </div>

          {/* 4. Teacher's Custom Note & Homework toggle */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-slate-300 font-bold">ملاحظات أو توجيهات المعلم (تظهر في أسفل التقرير):</label>
              <label className="flex items-center gap-1.5 text-[11px] text-slate-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeHomework}
                  onChange={(e) => setIncludeHomework(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-800 text-purple-600 focus:ring-purple-500"
                />
                <span>تضمين الواجبات</span>
              </label>
            </div>
            <textarea
              rows={2}
              value={teacherNote}
              onChange={(e) => setTeacherNote(e.target.value)}
              placeholder="مثال: الطالب متميز وملتزم بالواجبات، يرجى الاستمرار على هذا المستوى..."
              className="w-full rounded-2xl bg-slate-950 border border-slate-700 p-3 text-xs text-white focus:outline-none focus:border-purple-400 leading-relaxed transition"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-2 border-t border-purple-900/30 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleExport}
              className="py-3 px-4 rounded-2xl bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:brightness-110 text-white font-bold text-xs transition cursor-pointer shadow-xl shadow-purple-950/60 flex items-center justify-center gap-2 active:scale-98"
            >
              <Download className="w-4 h-4" />
              <span>تصدير وحفظ PDF 📄</span>
            </button>

            <button
              type="button"
              onClick={handleExport}
              className="py-3 px-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition cursor-pointer border border-slate-700 flex items-center justify-center gap-2 active:scale-98"
            >
              <Printer className="w-4 h-4 text-purple-400" />
              <span>طباعة المستند 🖨️</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleShareWhatsAppSummary}
              className="flex-1 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 font-bold text-[11px] transition cursor-pointer flex items-center justify-center gap-1.5"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>مشاركة ملخص التقرير واتساب 💬</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white text-[11px] font-semibold transition cursor-pointer"
            >
              إغلاق
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
