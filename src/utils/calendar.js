/**
  * Utility function to build a Google Calendar Web Template URL.
  * Opens Google Calendar event creation page pre-filled with reminder details.
  * 
  * @param {Object} params - Reminder details
  * @param {string} params.title - Event title (required)
  * @param {string} [params.description] - Event description (optional)
  * @param {string|Date} params.start - Local start date/time (string 'YYYY-MM-DDTHH:mm' or Date object)
  * @param {number} [params.durationMinutes=15] - Duration in minutes
  * @param {string} [params.repeat='none'] - Repeat frequency ('none', 'daily', 'weekly', 'monthly')
  * @returns {string} Formatted Google Calendar template URL
  */
export function buildGoogleCalendarUrl({
  title,
  description = '',
  start,
  durationMinutes = 15,
  repeat = 'none',
}) {
  // Parse start date as local time
  const startDate = start instanceof Date ? start : new Date(start);
  
  // Calculate end date based on duration in minutes
  const durationMs = (Math.max(1, Number(durationMinutes) || 15)) * 60 * 1000;
  const endDate = new Date(startDate.getTime() + durationMs);

  // Helper to convert Date to UTC string format: YYYYMMDDTHHMMSSZ
  const formatUtcString = (date) => {
    return date
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}/, '');
  };

  const startUtc = formatUtcString(startDate);
  const endUtc = formatUtcString(endDate);

  // Build query parameters using standard URLSearchParams for safe encoding
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title ? title.trim() : '',
    details: description ? description.trim() : '',
    dates: `${startUtc}/${endUtc}`,
  });

  // Add recurrence rule if repeat frequency is set
  if (repeat && repeat !== 'none') {
    const repeatMap = {
      daily: 'RRULE:FREQ=DAILY',
      weekly: 'RRULE:FREQ=WEEKLY',
      monthly: 'RRULE:FREQ=MONTHLY',
    };
    if (repeatMap[repeat]) {
      params.append('recur', repeatMap[repeat]);
    }
  }

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
