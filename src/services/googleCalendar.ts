import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth, db } from '../firebase';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { ScheduleSlot } from '../types';
import { isStudentPaused } from './studentStatus';

/**
 * In-memory token storage for Google Calendar API OAuth2 access token.
 * Tokens are kept in memory only (never written to LocalStorage or SessionStorage).
 */
let cachedAccessToken: string | null = null;

export function getCalendarAccessToken(): string | null {
  return cachedAccessToken;
}

export function setCalendarAccessToken(token: string | null) {
  cachedAccessToken = token;
}

export function isCalendarConnected(): boolean {
  return Boolean(cachedAccessToken);
}

// Days of week mapping for RRULE and Arabic labels
const DAY_CODES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
const ARABIC_DAYS = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

export function getDayNameArabic(dayIndex: number): string {
  return ARABIC_DAYS[dayIndex] || 'يوم دراسي';
}

/**
 * Notify when OAuth token expires or permissions are revoked
 */
function notifyAuthFailure(message = 'انتهت صلاحية جلسة تقويم Google أو تم إلغاؤها. يرجى إعادة ربط الحساب لمواصلة المزامنة.') {
  setCalendarAccessToken(null);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('sanad:google-calendar-auth-error', {
        detail: { message },
      })
    );
  }
}

/**
 * Connect Google Calendar using client-side Firebase Auth GoogleAuthProvider (OAuth2)
 */
export async function connectGoogleCalendar(
  teacherId?: string
): Promise<{ success: boolean; email?: string; error?: string }> {
  try {
    const provider = new GoogleAuthProvider();
    provider.addScope('https://www.googleapis.com/auth/calendar.events');
    provider.setCustomParameters({ prompt: 'consent' });

    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const accessToken = credential?.accessToken;

    if (!accessToken) {
      return { success: false, error: 'تعذر الحصول على رمز الوصول من Google.' };
    }

    setCalendarAccessToken(accessToken);
    const email = result.user.email || null;

    if (teacherId) {
      try {
        const teacherRef = doc(db, 'teachers', teacherId);
        await updateDoc(teacherRef, {
          googleCalendarConnected: true,
          googleCalendarEmail: email,
          googleCalendarLastSync: new Date().toISOString(),
        });
      } catch (err) {
        console.warn('Could not update teacher profile with calendar status:', err);
      }
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('sanad:google-calendar-connected', {
          detail: { email },
        })
      );
    }

    return { success: true, email: email || undefined };
  } catch (err: any) {
    console.error('Error connecting Google Calendar OAuth2:', err);
    return {
      success: false,
      error: err?.message || 'حدث خطأ أثناء المصادقة والاتصال بتقويم Google.',
    };
  }
}

/**
 * Disconnect Google Calendar OAuth2 session
 */
export async function disconnectGoogleCalendar(teacherId?: string): Promise<void> {
  setCalendarAccessToken(null);
  if (teacherId) {
    try {
      const teacherRef = doc(db, 'teachers', teacherId);
      await updateDoc(teacherRef, {
        googleCalendarConnected: false,
        googleCalendarEmail: null,
      });
    } catch (err) {
      console.warn('Could not update teacher profile on disconnect:', err);
    }
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('sanad:google-calendar-disconnected'));
  }
}

/**
 * Calculate the next upcoming Date for a given dayOfWeek (0-6) and time string (HH:MM)
 */
function getNextOccurrenceDate(dayOfWeek: number, timeStr: string): { start: Date; end: Date; durationMinutes: number } {
  const [hourStr, minStr] = (timeStr || '16:00').split(':');
  const targetHour = parseInt(hourStr, 10) || 0;
  const targetMin = parseInt(minStr, 10) || 0;

  const now = new Date();
  const currentDay = now.getDay();
  let daysUntil = (dayOfWeek - currentDay + 7) % 7;

  // If today is the day but the time has already passed, schedule from next week
  if (daysUntil === 0) {
    const passedToday =
      now.getHours() > targetHour || (now.getHours() === targetHour && now.getMinutes() >= targetMin);
    if (passedToday) {
      daysUntil = 7;
    }
  }

  const startDate = new Date(now);
  startDate.setDate(now.getDate() + daysUntil);
  startDate.setHours(targetHour, targetMin, 0, 0);

  const durationMinutes = 60; // default duration
  const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000);

  return { start: startDate, end: endDate, durationMinutes };
}

// Google Calendar event color IDs (1-11)
const GOOGLE_CALENDAR_COLORS: Record<string, string> = {
  cyan: '7',     // Peacock
  emerald: '10', // Basil
  amber: '6',    // Tangerine
  purple: '3',   // Grape
  blue: '9',     // Blueberry
  rose: '4',     // Flamingo
  red: '11',     // Tomato
  indigo: '1',   // Lavender
};

/**
 * Format Date to RFC 3339 with local timezone offset for Google Calendar API
 */
function formatRfc3339(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  const seconds = pad(d.getSeconds());

  const offsetMinutes = -d.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const absOffset = Math.abs(offsetMinutes);
  const offsetHours = pad(Math.floor(absOffset / 60));
  const offsetMins = pad(absOffset % 60);

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${sign}${offsetHours}:${offsetMins}`;
}

/**
 * Format a ScheduleSlot into Google Calendar Event payload
 */
function buildEventPayload(slot: ScheduleSlot, teacherSubject?: string) {
  const { start } = getNextOccurrenceDate(slot.dayOfWeek, slot.time);
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Cairo';

  const durationMins = slot.duration || 60;
  const actualEnd = new Date(start.getTime() + durationMins * 60 * 1000);

  const classTypeArabic =
    slot.classType === 'online'
      ? 'أونلاين (عن بعد)'
      : slot.classType === 'center'
      ? 'سنتر تعليمي'
      : 'خاص / حضوري';

  const summary = `حصة ${slot.studentName || 'طالب'} - ${teacherSubject || 'سند المعلم'}`;
  const description = [
    `📚 حصة دراسية مجدولة عبر تطبيق (سند المعلم)`,
    `👨‍🎓 الطالب/ـة: ${slot.studentName || 'غير محدد'}`,
    `⏰ الموعد: يوم ${getDayNameArabic(slot.dayOfWeek)} الساعة ${slot.time} (${durationMins} دقيقة)`,
    `🏷️ نوع الحصة: ${classTypeArabic}`,
    slot.locationOrLink ? `📍 المكان أو الرابط: ${slot.locationOrLink}` : null,
    slot.notes ? `📝 ملاحظات: ${slot.notes}` : null,
    `🔗 تطبيق سند المعلم: إدارة الحصص والطلاب والتقارير الأكاديمية`,
  ]
    .filter(Boolean)
    .join('\n');

  const dayCode = DAY_CODES[slot.dayOfWeek] || 'SU';
  const isOneTime = slot.recurrence === 'once';
  const recurrence = isOneTime ? undefined : [`RRULE:FREQ=WEEKLY;BYDAY=${dayCode}`];
  const colorId = slot.color ? GOOGLE_CALENDAR_COLORS[slot.color] || undefined : undefined;

  return {
    summary,
    description,
    location: slot.locationOrLink || '',
    colorId,
    start: {
      dateTime: formatRfc3339(start),
      timeZone,
    },
    end: {
      dateTime: formatRfc3339(actualEnd),
      timeZone,
    },
    recurrence,
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'popup', minutes: 15 },
        { method: 'popup', minutes: 60 },
      ],
    },
  };
}

/**
 * Create a new Event in Google Calendar for a ScheduleSlot
 */
export async function createGoogleCalendarEvent(
  slot: ScheduleSlot,
  teacherSubject?: string
): Promise<string | null> {
  const token = getCalendarAccessToken();
  if (!token) return null;

  try {
    const payload = buildEventPayload(slot, teacherSubject);
    const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (res.status === 401) {
      notifyAuthFailure();
      return null;
    }

    if (!res.ok) {
      const errText = await res.text();
      console.warn('Google Calendar create event failed:', res.status, errText);
      return null;
    }

    const data = await res.json();
    return data.id || null;
  } catch (err) {
    console.warn('Error creating Google Calendar event:', err);
    return null;
  }
}

/**
 * Update an existing Event in Google Calendar
 */
export async function updateGoogleCalendarEvent(
  eventId: string,
  slot: ScheduleSlot,
  teacherSubject?: string
): Promise<boolean> {
  if (!eventId) return false;
  const token = getCalendarAccessToken();
  if (!token) return false;

  try {
    const payload = buildEventPayload(slot, teacherSubject);
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }
    );

    if (res.status === 401) {
      notifyAuthFailure();
      return false;
    }

    if (res.status === 404 || res.status === 410) {
      // Event was deleted from Google Calendar
      return false;
    }

    return res.ok;
  } catch (err) {
    console.warn('Error updating Google Calendar event:', err);
    return false;
  }
}

/**
 * Delete an event from Google Calendar
 */
export async function deleteGoogleCalendarEvent(eventId: string): Promise<boolean> {
  if (!eventId) return true;
  const token = getCalendarAccessToken();
  if (!token) return true;

  try {
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (res.status === 401) {
      notifyAuthFailure();
      return false;
    }

    return res.status === 204 || res.status === 404 || res.status === 410;
  } catch (err) {
    console.warn('Error deleting Google Calendar event:', err);
    return false;
  }
}

/**
 * Check if a Google Calendar event is active (confirmed) or cancelled/deleted
 */
export async function checkGoogleCalendarEventActive(
  eventId: string
): Promise<{ active: boolean; status?: string }> {
  if (!eventId) return { active: true };
  const token = getCalendarAccessToken();
  if (!token) {
    return { active: true };
  }

  try {
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (res.status === 401) {
      notifyAuthFailure();
      return { active: true };
    }

    if (res.status === 404 || res.status === 410) {
      return { active: false, status: 'deleted_from_calendar' };
    }

    if (res.ok) {
      const data = await res.json();
      if (data.status === 'cancelled') {
        return { active: false, status: 'cancelled' };
      }
      return { active: true, status: data.status || 'confirmed' };
    }

    return { active: true };
  } catch (e) {
    console.warn('Error checking calendar event status:', e);
    return { active: true };
  }
}

/**
 * Strict Active Status Verification (Firestore Guard Clause):
 * Verifies that the student exists in Firestore and is not deleted, archived, or paused,
 * and that the schedule slot itself is active and not cancelled.
 * If the session is inactive or the student is deleted:
 * - If an obsolete googleCalendarEventId exists in Google Calendar, it automatically deletes it.
 * - Rejects synchronization / notification immediately to ensure zero ghost syncs.
 */
export async function verifySlotActiveStatus(
  teacherId: string,
  slot: Partial<ScheduleSlot>
): Promise<{ active: boolean; reason?: string; studentName?: string }> {
  if (!teacherId) return { active: false, reason: 'missing_teacher_id' };

  // 1. Strict Guard: Direct slot status check
  if (slot.cancelled === true || (slot.status && slot.status !== 'active')) {
    if (slot.googleCalendarEventId) {
      deleteGoogleCalendarEvent(slot.googleCalendarEventId).catch((err) =>
        console.warn('Could not clean up cancelled calendar event:', err)
      );
    }
    return { active: false, reason: 'slot_cancelled' };
  }

  try {
    // 2. Strict Firestore Schedule Check (if slot.id is provided)
    if (slot.id && !slot.id.startsWith('group_slot_')) {
      const schedDocRef = doc(db, 'teachers', teacherId, 'schedules', slot.id);
      const schedSnap = await getDoc(schedDocRef);
      if (!schedSnap.exists()) {
        if (slot.googleCalendarEventId) {
          deleteGoogleCalendarEvent(slot.googleCalendarEventId).catch((err) =>
            console.warn('Could not clean up deleted slot calendar event:', err)
          );
        }
        return { active: false, reason: 'schedule_slot_deleted' };
      }

      const schedData = schedSnap.data() as any;
      if (schedData?.cancelled === true || (schedData?.status && schedData?.status !== 'active')) {
        const calId = slot.googleCalendarEventId || schedData?.googleCalendarEventId;
        if (calId) {
          deleteGoogleCalendarEvent(calId).catch((err) =>
            console.warn('Could not clean up cancelled slot calendar event:', err)
          );
        }
        return { active: false, reason: 'schedule_slot_cancelled' };
      }
    }

    // 3. Strict Student Verification: Check if student exists and is active
    if (slot.studentId) {
      // Check if it's a group slot
      if (slot.studentId.startsWith('group_')) {
        const groupId = slot.studentId.replace('group_', '');
        const groupDocRef = doc(db, 'teachers', teacherId, 'groups', groupId);
        const groupSnap = await getDoc(groupDocRef);
        if (!groupSnap.exists()) {
          if (slot.googleCalendarEventId) {
            deleteGoogleCalendarEvent(slot.googleCalendarEventId).catch((err) =>
              console.warn('Could not clean up deleted group calendar event:', err)
            );
          }
          return { active: false, reason: 'group_deleted' };
        }
        const gData = groupSnap.data() as any;
        if (gData?.status !== 'active' || gData?.archived === true) {
          if (slot.googleCalendarEventId) {
            deleteGoogleCalendarEvent(slot.googleCalendarEventId).catch((err) =>
              console.warn('Could not clean up inactive group calendar event:', err)
            );
          }
          return { active: false, reason: 'group_inactive' };
        }
      } else {
        // Individual student verification
        const studentDocRef = doc(db, 'teachers', teacherId, 'students', slot.studentId);
        const studentSnap = await getDoc(studentDocRef);
        if (!studentSnap.exists()) {
          if (slot.googleCalendarEventId) {
            deleteGoogleCalendarEvent(slot.googleCalendarEventId).catch((err) =>
              console.warn('Could not clean up deleted student calendar event:', err)
            );
          }
          return { active: false, reason: 'student_deleted' };
        }

        const stData = studentSnap.data() as any;
        if (
          stData?.archived === true ||
          stData?.status === 'archived' ||
          stData?.status === 'deleted' ||
          stData?.active === false ||
          isStudentPaused(stData)
        ) {
          if (slot.googleCalendarEventId) {
            deleteGoogleCalendarEvent(slot.googleCalendarEventId).catch((err) =>
              console.warn('Could not clean up inactive student calendar event:', err)
            );
          }
          return { active: false, reason: 'student_inactive', studentName: stData?.name };
        }
      }
    }

    return { active: true, studentName: slot.studentName };
  } catch (err) {
    console.warn('Error in verifySlotActiveStatus:', err);
    return { active: true };
  }
}

/**
 * Synchronize a single schedule slot directly to Google Calendar.
 * Performs strict active status verification in Firestore prior to sync.
 * If the event doesn't exist, it creates one; if it does, it updates it.
 * Also persists the resulting googleCalendarEventId in Firestore.
 */
export async function syncSingleSlotToCalendar(
  teacherId: string,
  slot: ScheduleSlot,
  teacherSubject?: string
): Promise<{ success: boolean; eventId?: string; error?: string }> {
  // 1. Strict Active Status Verification in Firestore before sending any update or event
  const verification = await verifySlotActiveStatus(teacherId, slot);
  if (!verification.active) {
    const errorMsg =
      verification.reason === 'student_deleted'
        ? 'لا يمكن المزامنة: تم حذف الطالب من السجل الدراسي.'
        : verification.reason === 'student_inactive'
        ? 'لا يمكن المزامنة: الطالب غير نشط أو في فترة إيقاف مؤقت.'
        : verification.reason === 'group_deleted' || verification.reason === 'group_inactive'
        ? 'لا يمكن المزامنة: المجموعة غير نشطة أو تم حذفها.'
        : 'لا يمكن المزامنة: الحصة ملغاة أو غير نشطة.';
    return { success: false, error: errorMsg };
  }

  let token = getCalendarAccessToken();
  if (!token) {
    // Attempt automatic popup connect if not connected
    const conn = await connectGoogleCalendar(teacherId);
    if (!conn.success) {
      return { success: false, error: conn.error || 'يرجى ربط حساب Google Calendar أولاً.' };
    }
    token = getCalendarAccessToken();
  }

  try {
    if (slot.googleCalendarEventId) {
      const updated = await updateGoogleCalendarEvent(slot.googleCalendarEventId, slot, teacherSubject);
      if (updated) {
        return { success: true, eventId: slot.googleCalendarEventId };
      }
    }

    // Create new event
    const newId = await createGoogleCalendarEvent(slot, teacherSubject);
    if (newId) {
      if (slot.id && teacherId) {
        try {
          await updateDoc(doc(db, 'teachers', teacherId, 'schedules', slot.id), {
            googleCalendarEventId: newId,
          });
        } catch (_) {}
      }
      return { success: true, eventId: newId };
    }

    return { success: false, error: 'تعذر إنشاء حدث الحصة في تقويم Google.' };
  } catch (err: any) {
    console.error('Error syncing single slot to calendar:', err);
    return { success: false, error: err?.message || 'حدث خطأ أثناء مزامنة الموعد.' };
  }
}

/**
 * Batch sync all schedules for a teacher into Google Calendar.
 * Performs strict active status verification in Firestore for each slot.
 */
export async function syncAllSchedulesToCalendar(
  teacherId: string,
  schedules: ScheduleSlot[],
  teacherSubject?: string
): Promise<{ synced: number; failed: number; skippedInactive: number }> {
  const token = getCalendarAccessToken();
  if (!token) {
    throw new Error('حساب Google Calendar غير متصل حالياً. يرجى تسجيل الدخول والربط أولاً.');
  }

  let synced = 0;
  let failed = 0;
  let skippedInactive = 0;

  for (const slot of schedules) {
    try {
      // 1. Strict Active Status Verification in Firestore
      const verification = await verifySlotActiveStatus(teacherId, slot);
      if (!verification.active) {
        skippedInactive++;
        continue;
      }

      if (slot.googleCalendarEventId) {
        const updated = await updateGoogleCalendarEvent(slot.googleCalendarEventId, slot, teacherSubject);
        if (updated) {
          synced++;
        } else {
          const newId = await createGoogleCalendarEvent(slot, teacherSubject);
          if (newId) {
            await updateDoc(doc(db, 'teachers', teacherId, 'schedules', slot.id), {
              googleCalendarEventId: newId,
            });
            synced++;
          } else {
            failed++;
          }
        }
      } else {
        const newId = await createGoogleCalendarEvent(slot, teacherSubject);
        if (newId) {
          await updateDoc(doc(db, 'teachers', teacherId, 'schedules', slot.id), {
            googleCalendarEventId: newId,
          });
          synced++;
        } else {
          failed++;
        }
      }
    } catch (err) {
      console.warn(`Failed to sync slot ${slot.id}:`, err);
      failed++;
    }
  }

  try {
    await updateDoc(doc(db, 'teachers', teacherId), {
      googleCalendarLastSync: new Date().toISOString(),
    });
  } catch (_) {}

  return { synced, failed, skippedInactive };
}
