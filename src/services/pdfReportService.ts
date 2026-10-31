import { Student, TeacherProfile, LessonLog, isLessonFinanciallyCounted, ScheduleSlot } from '../types';
import { escapeHtml } from '../utils/security';

export type ReportType = 'financial' | 'attendance' | 'comprehensive';

export interface ReportOptions {
  reportType: ReportType;
  startDate?: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
  teacherNote?: string;
  includeHomework?: boolean;
  currency?: string;
}

/**
 * Format date in friendly Arabic format
 */
export function formatArabicDate(dateStr: string): string {
  try {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return new Intl.DateTimeFormat('ar-EG', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(date);
  } catch {
    return dateStr;
  }
}

/**
 * Build the complete HTML string for the PDF report with high-fidelity styling
 */
export function buildReportHtml(
  student: Student,
  teacher: TeacherProfile,
  lessons: LessonLog[],
  options: ReportOptions
): string {
  const currency = options.currency || teacher.currency || 'ج.م';
  const now = new Date();
  const issueDateStr = new Intl.DateTimeFormat('ar-EG', {
    dateStyle: 'full',
  }).format(now);

  // Filter lessons by date range if provided
  let filteredLessons = [...lessons].sort((a, b) => b.date.localeCompare(a.date));
  if (options.startDate) {
    filteredLessons = filteredLessons.filter((l) => l.date >= options.startDate!);
  }
  if (options.endDate) {
    filteredLessons = filteredLessons.filter((l) => l.date <= options.endDate!);
  }

  // Calculate Metrics
  const totalLessons = filteredLessons.length;
  const presentLessons = filteredLessons.filter((l) => l.attendance === 'present').length;
  const absentLessons = filteredLessons.filter((l) => l.attendance === 'absent').length;
  const excusedLessons = filteredLessons.filter((l) => l.attendance === 'excused').length;
  const attendanceRate = totalLessons > 0 ? Math.round((presentLessons / totalLessons) * 100) : 100;

  const hourlyRate =
    student.hourlyRate ||
    (student.monthlyFee ? Math.round(student.monthlyFee / 4) : 100);

  // حساب المبالغ المحصلة والمتبقية فقط دون حسابات مكررة غير مستخدمة

  const collectedAmount = filteredLessons.filter((l) => l.settled).reduce((acc, l) => {
    const dur = l.duration || 60;
    const rate = l.hourlyRate || hourlyRate;
    return acc + (l.cost !== undefined ? l.cost : Math.round((dur / 60) * rate));
  }, 0);

  const pendingAmount = filteredLessons
    .filter((l) => !l.settled && isLessonFinanciallyCounted(l))
    .reduce((acc, l) => {
      const dur = l.duration || 60;
      const rate = l.hourlyRate || hourlyRate;
      return acc + (l.cost !== undefined ? l.cost : Math.round((dur / 60) * rate));
    }, 0);

  let reportTitle = 'كشف حساب ومستحقات الطالب';
  let reportSubtitle = 'بيان تفصيلي بالحصص المنفذة والتكاليف والمستحقات المالية';
  let badgeColor = '#059669';

  if (options.reportType === 'attendance') {
    reportTitle = 'سجل وتقرير الحضور والغياب والمواظبة';
    reportSubtitle = 'بيان تفصيلي بمعدلات الحضور، الغياب، والاعتذارات المسبقة';
    badgeColor = '#7c3aed';
  } else if (options.reportType === 'comprehensive') {
    reportTitle = 'التقرير الشامل للطالب (مالي وأكاديمي)';
    reportSubtitle = 'سجل الحصص، التحصيل الدراسي، الحضور والغياب، والمستحقات المالية';
    badgeColor = '#2563eb';
  }

  // HTML rows for table
  const tableRowsHtml = filteredLessons.map((l, index) => {
    const dur = l.duration || 60;
    const rate = l.hourlyRate || hourlyRate;
    const cost = l.cost !== undefined ? l.cost : Math.round((dur / 60) * rate);
    const isCounted = isLessonFinanciallyCounted(l);

    let attBadge = '<span class="badge badge-present">حاضر ✓</span>';
    if (l.attendance === 'absent') {
      attBadge = '<span class="badge badge-absent">غائب ✗</span>';
    } else if (l.attendance === 'excused') {
      attBadge = '<span class="badge badge-excused">معتذر ⚠️</span>';
    }

    let settleBadge = l.settled
      ? '<span class="badge badge-settled">تمت التصفية 💰</span>'
      : isCounted
      ? '<span class="badge badge-pending">مستحق ⏳</span>'
      : '<span class="badge badge-neutral">معفى ∅</span>';

    return `
      <tr>
        <td class="text-center font-mono">${filteredLessons.length - index}</td>
        <td class="font-bold">${formatArabicDate(l.date)}</td>
        <td>
          <div class="topic-title">${escapeHtml(l.topic || 'حصة تدريسية')}</div>
          ${options.includeHomework && l.homework ? `<div class="homework-note">📝 الواجب: ${escapeHtml(l.homework)}</div>` : ''}
          ${l.makeupClassDate ? `<div class="makeup-note">🔄 موعد التعويض: ${formatArabicDate(l.makeupClassDate)}</div>` : ''}
          ${l.notes ? `<div class="lesson-note">💬 ${escapeHtml(l.notes)}</div>` : ''}
        </td>
        <td class="text-center">${attBadge}</td>
        <td class="text-center font-mono">${dur} دقيقة</td>
        ${
          options.reportType !== 'attendance'
            ? `
          <td class="text-center font-mono font-bold">${isCounted ? `${cost} ${currency}` : '<span style="color:#9ca3af">0 ' + currency + '</span>'}</td>
          <td class="text-center">${settleBadge}</td>
        `
            : ''
        }
      </tr>
    `;
  }).join('');

  return `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(reportTitle)} - ${escapeHtml(student.name)}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap');
    
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    
    body {
      font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif;
      background-color: #f8fafc;
      color: #0f172a;
      direction: rtl;
      text-align: right;
      padding: 24px;
      font-size: 12px;
      line-height: 1.5;
    }

    .report-container {
      max-width: 860px;
      margin: 0 auto;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 16px;
      padding: 32px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
    }

    /* Header */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #8b5cf6;
      padding-bottom: 20px;
      margin-bottom: 24px;
    }

    .header-branding h1 {
      font-size: 20px;
      font-weight: 900;
      color: #4c1d95;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .header-branding p {
      font-size: 11px;
      color: #64748b;
      margin-top: 4px;
    }

    .header-badge {
      background: ${badgeColor};
      color: #ffffff;
      padding: 6px 16px;
      border-radius: 9999px;
      font-weight: 800;
      font-size: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }

    /* Info Grid */
    .info-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
      background: #f1f5f9;
      padding: 16px;
      border-radius: 12px;
      margin-bottom: 24px;
      border: 1px solid #e2e8f0;
    }

    .info-item {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .info-label {
      color: #64748b;
      font-weight: 600;
      font-size: 11px;
      min-width: 90px;
    }

    .info-value {
      color: #0f172a;
      font-weight: 800;
      font-size: 12px;
    }

    /* KPI Cards */
    .kpi-container {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      margin-bottom: 24px;
    }

    .kpi-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 12px;
      text-align: center;
      box-shadow: 0 1px 3px rgba(0,0,0,0.03);
    }

    .kpi-title {
      font-size: 10px;
      color: #64748b;
      font-weight: 600;
      margin-bottom: 4px;
    }

    .kpi-value {
      font-size: 16px;
      font-weight: 900;
      color: #0f172a;
    }

    .kpi-value.green { color: #059669; }
    .kpi-value.amber { color: #d97706; }
    .kpi-value.purple { color: #7c3aed; }
    .kpi-value.blue { color: #2563eb; }

    /* Table */
    .table-container {
      margin-bottom: 24px;
      overflow-x: auto;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11px;
    }

    th {
      background: #f8fafc;
      color: #334155;
      font-weight: 800;
      padding: 10px 8px;
      border-bottom: 2px solid #cbd5e1;
      text-align: right;
    }

    td {
      padding: 9px 8px;
      border-bottom: 1px solid #e2e8f0;
      vertical-align: middle;
    }

    tr:nth-child(even) {
      background-color: #fafafa;
    }

    .text-center { text-align: center; }
    .font-mono { font-family: monospace, monospace; }
    .font-bold { font-weight: 700; }

    /* Badges */
    .badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 6px;
      font-size: 10px;
      font-weight: 700;
    }

    .badge-present { background: #dcfce7; color: #166534; }
    .badge-absent { background: #fee2e2; color: #991b1b; }
    .badge-excused { background: #fef3c7; color: #92400e; }
    .badge-settled { background: #dcfce7; color: #15803d; border: 1px solid #86efac; }
    .badge-pending { background: #fef3c7; color: #b45309; border: 1px solid #fde68a; }
    .badge-neutral { background: #f1f5f9; color: #64748b; }

    .topic-title { font-weight: 700; color: #1e293b; }
    .homework-note { font-size: 10px; color: #4338ca; margin-top: 2px; }
    .makeup-note { font-size: 10px; color: #6b21a8; margin-top: 2px; }
    .lesson-note { font-size: 10px; color: #475569; margin-top: 2px; }

    /* Footer & Notes */
    .notes-section {
      background: #fefce8;
      border: 1px dashed #ca8a04;
      border-radius: 12px;
      padding: 14px;
      margin-bottom: 24px;
      font-size: 11px;
    }

    .notes-title {
      font-weight: 800;
      color: #854d0e;
      margin-bottom: 4px;
    }

    .footer {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      border-top: 1px solid #e2e8f0;
      padding-top: 20px;
      font-size: 11px;
      color: #64748b;
    }

    .signature-box {
      text-align: center;
      min-width: 140px;
    }

    .signature-line {
      border-bottom: 1px solid #94a3b8;
      height: 36px;
      margin-bottom: 4px;
    }

    @media print {
      body {
        background: #ffffff;
        padding: 0;
      }
      .report-container {
        border: none;
        box-shadow: none;
        padding: 12px;
        max-width: 100%;
      }
      .no-print {
        display: none !important;
      }
    }
  </style>
</head>
<body>
  <div class="report-container">
    <!-- Header -->
    <div class="header">
      <div class="header-branding">
        <h1>
          <span>📚 سند المعلم</span>
        </h1>
        <p>${reportSubtitle}</p>
        <p style="font-size: 10px; color: #94a3b8; margin-top: 2px;">تاريخ استخراج التقرير: ${issueDateStr}</p>
      </div>
      <div>
        <span class="header-badge">${reportTitle}</span>
      </div>
    </div>

    <!-- Student & Teacher Info Grid -->
    <div class="info-grid">
      <div class="info-item">
        <span class="info-label">👤 اسم الطالب:</span>
        <span class="info-value">${escapeHtml(student.name)}</span>
      </div>
      <div class="info-item">
        <span class="info-label">👨‍🏫 المعلم:</span>
        <span class="info-value">${escapeHtml(teacher.name)}</span>
      </div>
      <div class="info-item">
        <span class="info-label">📚 المادة:</span>
        <span class="info-value">${escapeHtml(student.subject || teacher.subject || 'غير محدد')}</span>
      </div>
      <div class="info-item">
        <span class="info-label">📱 رقم الواتساب:</span>
        <span class="info-value" dir="ltr">${escapeHtml(student.whatsapp || 'غير مسجل')}</span>
      </div>
      <div class="info-item">
        <span class="info-label">💳 سعر الساعة:</span>
        <span class="info-value font-mono">${hourlyRate} ${currency}/ساعة</span>
      </div>
      <div class="info-item">
        <span class="info-label">🏫 نوع الحصة:</span>
        <span class="info-value">${student.classType === 'online' ? 'أونلاين 🌐' : student.classType === 'trial' ? 'حصة تجريبية ✨' : 'حضور شخصي 👤'}</span>
      </div>
    </div>

    <!-- KPI Summary Cards -->
    <div class="kpi-container">
      <div class="kpi-card">
        <div class="kpi-title">إجمالي الحصص</div>
        <div class="kpi-value purple">${totalLessons}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-title">نسبة الحضور</div>
        <div class="kpi-value ${attendanceRate >= 80 ? 'green' : 'amber'}">${attendanceRate}%</div>
      </div>
      ${
        options.reportType === 'attendance'
          ? `
        <div class="kpi-card">
          <div class="kpi-title">عدد مرات الغياب</div>
          <div class="kpi-value amber">${absentLessons}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-title">الاعتذارات المسبقة</div>
          <div class="kpi-value blue">${excusedLessons}</div>
        </div>
      `
          : `
        <div class="kpi-card">
          <div class="kpi-title">المبالغ المسددة</div>
          <div class="kpi-value green font-mono">${collectedAmount} ${currency}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-title">المستحقات المعلقة</div>
          <div class="kpi-value ${pendingAmount > 0 ? 'amber' : 'green'} font-mono">${pendingAmount} ${currency}</div>
        </div>
      `
      }
    </div>

    <!-- Table -->
    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th class="text-center" style="width: 35px;">#</th>
            <th style="width: 120px;">التاريخ</th>
            <th>موضوع الحصة والواجب</th>
            <th class="text-center" style="width: 80px;">الحضور</th>
            <th class="text-center" style="width: 70px;">المدة</th>
            ${
              options.reportType !== 'attendance'
                ? `
              <th class="text-center" style="width: 85px;">القيمة</th>
              <th class="text-center" style="width: 95px;">الحالة</th>
            `
                : ''
            }
          </tr>
        </thead>
        <tbody>
          ${tableRowsHtml || '<tr><td colspan="7" class="text-center" style="padding: 24px; color: #94a3b8;">لا توجد حصص مسجلة في هذا النطاق الزمني</td></tr>'}
        </tbody>
      </table>
    </div>

    <!-- Teacher Custom Note -->
    ${
      options.teacherNote
        ? `
      <div class="notes-section">
        <div class="notes-title">📝 ملاحظات وتوجيهات المعلم:</div>
        <p style="color: #451a03; line-height: 1.6;">${options.teacherNote}</p>
      </div>
    `
        : ''
    }

    <!-- Footer with Signatures -->
    <div class="footer">
      <div>
        <p>تم استخراج هذا الكشف تلقائياً عبر نظام <strong>سند المعلم</strong></p>
        <p style="font-size: 10px; margin-top: 2px;">تطبيق إدارة الحصص ومستحقات الدروس الخصوصية الذكي</p>
      </div>
      <div class="signature-box">
        <div class="signature-line"></div>
        <p>توقيع المعلم: <strong>${escapeHtml(teacher.name)}</strong></p>
      </div>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Triggers clean print/save-as-PDF window or direct download
 */
export function exportReportToPdf(
  student: Student,
  teacher: TeacherProfile,
  lessons: LessonLog[],
  options: ReportOptions
) {
  const htmlContent = buildReportHtml(student, teacher, lessons, options);

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    // If popups are blocked, use hidden iframe
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(htmlContent);
      doc.close();
      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => document.body.removeChild(iframe), 2000);
      }, 400);
    }
    return;
  }

  printWindow.document.open();
  printWindow.document.write(htmlContent);
  printWindow.document.close();

  printWindow.onload = () => {
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 300);
  };
}

/**
 * Build HTML for schedule export
 */
export function buildSchedulePdfHtml(
  teacher: TeacherProfile,
  schedules: ScheduleSlot[],
  students: Student[]
): string {
  const now = new Date();
  const issueDateStr = new Intl.DateTimeFormat('ar-EG', {
    dateStyle: 'full',
  }).format(now);

  const tableRowsHtml = schedules
    .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.time.localeCompare(b.time))
    .map((s) => {
      const student = students.find((st) => st.id === s.studentId);
      const dayName = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'][s.dayOfWeek];
      return `
        <tr>
          <td>${dayName}</td>
          <td>${escapeHtml(s.time)}</td>
          <td>${escapeHtml(student?.name || 'غير محدد')}</td>
          <td>${escapeHtml(s.notes || '-')}</td>
        </tr>
      `;
    }).join('');

  return `
    <html>
    <head>
      <style>
        body { font-family: 'Cairo', sans-serif; direction: rtl; padding: 20px; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: center; }
        th { background-color: #f2f2f2; }
      </style>
    </head>
    <body>
      <h1>جدول الحصص الأسبوعي - ${escapeHtml(teacher.name)}</h1>
      <p>تاريخ الإصدار: ${issueDateStr}</p>
      <table>
        <thead>
          <tr>
            <th>اليوم</th>
            <th>الوقت</th>
            <th>الطالب</th>
            <th>الموضوع</th>
          </tr>
        </thead>
        <tbody>
          ${tableRowsHtml}
        </tbody>
      </table>
    </body>
    </html>
  `;
}

/**
 * Triggers schedule PDF export
 */
export function exportScheduleToPdf(
  teacher: TeacherProfile,
  schedules: ScheduleSlot[],
  students: Student[]
) {
  const htmlContent = buildSchedulePdfHtml(teacher, schedules, students);
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    setTimeout(() => {
        printWindow.focus();
        printWindow.print();
    }, 500);
  }
}

