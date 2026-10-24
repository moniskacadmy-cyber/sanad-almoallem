import { ScheduleSlot } from '../types';

export interface SlotCheckInput {
  id?: string;
  dayOfWeek: number;
  time: string; // "HH:MM" in 24-hour format
  duration: number; // Duration in minutes
  studentName?: string;
}

export interface ConflictResult {
  hasConflict: boolean;
  conflictingSlot?: ScheduleSlot;
  message?: string;
}

/**
 * Helper to convert "HH:MM" string to minutes from midnight
 */
export function getMinutesFromTime(timeStr: string): number {
  if (!timeStr || !timeStr.includes(':')) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/**
 * Format total minutes from midnight into 12-hour Arabic time string (e.g. "04:00 مساءً")
 */
export function formatMinutesToArabicTime(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60) % 24;
  const m = totalMinutes % 60;
  const period = h < 12 ? 'صباحاً' : 'مساءً';
  const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${displayH.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} ${period}`;
}

const ARABIC_DAYS = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

/**
 * Check if a proposed new schedule slot conflicts with existing schedule slots.
 * Formula: newStart < existingEnd && newEnd > existingStart
 */
export function hasConflict(
  newSlot: SlotCheckInput,
  existingSlots: ScheduleSlot[],
  excludeSlotId?: string
): ConflictResult {
  const newStart = getMinutesFromTime(newSlot.time);
  const newEnd = newStart + (Number(newSlot.duration) || 60);

  for (const slot of existingSlots) {
    if (excludeSlotId && slot.id === excludeSlotId) continue;
    if (newSlot.id && slot.id === newSlot.id) continue;

    if (Number(slot.dayOfWeek) === Number(newSlot.dayOfWeek)) {
      const slotStart = getMinutesFromTime(slot.time);
      const slotEnd = slotStart + (Number(slot.duration) || 60);

      // Interval overlap condition
      if (newStart < slotEnd && newEnd > slotStart) {
        const dayName = ARABIC_DAYS[slot.dayOfWeek] ?? 'هذا اليوم';
        const startTimeStr = formatMinutesToArabicTime(slotStart);
        const endTimeStr = formatMinutesToArabicTime(slotEnd);
        const studentName = slot.studentName || 'طالب آخر';

        return {
          hasConflict: true,
          conflictingSlot: slot,
          message: `عفواً، لديك حصة أو مجموعة أخرى في نفس هذا الموعد (${studentName} يوم ${dayName} من ${startTimeStr} إلى ${endTimeStr}).`,
        };
      }
    }
  }

  return { hasConflict: false };
}
