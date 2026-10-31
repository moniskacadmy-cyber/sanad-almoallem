import { escapeHtml } from './security';

/** Builds the print/PDF window HTML. EVERY dynamic value is escaped (file names and titles are untrusted). */
export function buildPrintHtml(opts: {
  title: string;
  content: string;
  subject?: string;
  teacherName?: string;
  dateStr: string;
}): string {
  const title = escapeHtml(opts.title);
  const subject = escapeHtml(opts.subject);
  const teacher = escapeHtml(opts.teacherName);
  const date = escapeHtml(opts.dateStr);
  const content = escapeHtml(opts.content);
  return `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="utf-8">
      <title>${title}</title>
      <style>
        body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; direction: rtl; text-align: right; padding: 35px; line-height: 1.8; color: #0f172a; }
        .header { border-bottom: 2.5px solid #7c3aed; padding-bottom: 12px; margin-bottom: 20px; }
        h1 { color: #6d28d9; margin: 0 0 10px 0; font-size: 22px; font-weight: 800; }
        .meta { font-size: 13px; color: #475569; display: flex; gap: 24px; margin-top: 8px; }
        .content { font-size: 14px; white-space: pre-wrap; line-height: 2; margin-top: 20px; }
        .footer { margin-top: 40px; border-top: 1px solid #cbd5e1; padding-top: 15px; font-size: 11px; color: #94a3b8; text-align: center; }
        @media print {
          body { padding: 15px; }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${title}</h1>
        <div class="meta">
          ${subject ? `<span><strong>المادة:</strong> ${subject}</span>` : ''}
          ${teacher ? `<span><strong>المعلم:</strong> أ. ${teacher}</span>` : ''}
          <span><strong>التاريخ:</strong> ${date}</span>
        </div>
      </div>
      <div class="content">${content}</div>
      <div class="footer">تم التصدير بواسطة منصة سند المعلم - Sanad Al-Moallem</div>
      <script>
        window.onload = function() {
          window.print();
        };
      </script>
    </body>
    </html>
  `;
}
