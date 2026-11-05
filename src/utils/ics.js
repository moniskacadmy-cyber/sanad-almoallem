/**
 * Utility functions to build RFC 5545 ICS calendar files and share/download them.
 */

/**
 * Escapes text according to RFC 5545 standard rules.
 * @param {string} text 
 * @returns {string}
 */
function escapeIcsText(text) {
  if (!text) return '';
  return String(text)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

/**
 * Formats a Date object into UTC string format YYYYMMDDTHHMMSSZ.
 * @param {Date} date 
 * @returns {string}
 */
function formatUtcString(date) {
  return date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
}

/**
 * Builds an RFC 5545 formatted .ics file text for a reminder event.
 * 
 * @param {Object} params
 * @param {string} params.title - Event title
 * @param {string} [params.description] - Event description
 * @param {string|Date} params.start - Event local start time
 * @param {number} [params.durationMinutes=15] - Duration in minutes
 * @param {string} [params.repeat='none'] - Repeat rule ('none', 'daily', 'weekly', 'monthly')
 * @param {number} [params.alarmMinutesBefore=0] - Alarm lead time in minutes (default 0)
 * @returns {string} RFC 5545 ICS plain text
 */
export function buildIcs({
  title,
  description = '',
  start,
  durationMinutes = 15,
  repeat = 'none',
  alarmMinutesBefore = 0,
}) {
  const startDate = start instanceof Date ? start : new Date(start);
  const durationMs = (Math.max(1, Number(durationMinutes) || 15)) * 60 * 1000;
  const endDate = new Date(startDate.getTime() + durationMs);

  // Generate unique UID
  const uid =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  const nowUtc = formatUtcString(new Date());
  const startUtc = formatUtcString(startDate);
  const endUtc = formatUtcString(endDate);

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//My Reminders App//AR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}@my-reminders`,
    `DTSTAMP:${nowUtc}`,
    `DTSTART:${startUtc}`,
    `DTEND:${endUtc}`,
    `SUMMARY:${escapeIcsText(title)}`,
  ];

  // Include DESCRIPTION only if non-empty
  if (description && description.trim().length > 0) {
    lines.push(`DESCRIPTION:${escapeIcsText(description.trim())}`);
  }

  // Include RRULE without "RRULE:" prefix if repeat is specified
  if (repeat && repeat !== 'none') {
    const repeatMap = {
      daily: 'FREQ=DAILY',
      weekly: 'FREQ=WEEKLY',
      monthly: 'FREQ=MONTHLY',
    };
    if (repeatMap[repeat]) {
      lines.push(`RRULE:${repeatMap[repeat]}`);
    }
  }

  // Add nested VALARM trigger
  const alarmMins = Math.max(0, Number(alarmMinutesBefore) || 0);
  lines.push(
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeIcsText(title)}`,
    `TRIGGER:-PT${alarmMins}M`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR'
  );

  // Join lines with CRLF per RFC 5545 specification
  return lines.join('\r\n');
}

/**
 * Exports and shares or downloads an ICS calendar file to the user's phone or device.
 * Uses Web Share API if supported, or falls back to direct .ics file download.
 * 
 * @param {string} icsText - Plain text ICS content
 * @param {string} [filename='reminder.ics'] - Output filename
 */
export async function addToPhoneCalendar(icsText, filename = 'reminder.ics') {
  const file = new File([icsText], filename, {
    type: 'text/calendar;charset=utf-8',
  });

  // Try Web Share API (native mobile share sheet / iOS Calendar import)
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: 'تذكير جديد',
      });
      return;
    } catch (err) {
      // If user cancels the share dialog, return quietly
      if (err && err.name === 'AbortError') {
        return;
      }
      // If sharing fails, fall back to file download below
    }
  }

  // Fallback file download for browsers without file sharing support
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
