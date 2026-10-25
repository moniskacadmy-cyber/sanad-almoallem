import type { Student, GroupMembership, StudentStatus, PauseType } from '../types.js';

/**
 * Returns today's date in YYYY-MM-DD format using Cairo timezone (Africa/Cairo)
 * to prevent boundary discrepancy with local device time.
 */
export function getTodayCairoDateStr(): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Africa/Cairo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(new Date());
  } catch {
    return new Date().toISOString().split('T')[0];
  }
}

export type StatusTarget = {
  status?: StudentStatus;
  active?: boolean;
  archived?: boolean;
  pauseType?: PauseType;
  pauseStartDate?: string | null;
  pauseEndDate?: string | null;
};

/**
 * Checks whether a student or group membership is currently paused at a given date.
 * If checkDateStr is omitted, today's date in Cairo time is used.
 */
export function isStudentPaused(
  target?: StatusTarget | null,
  checkDateStr?: string
): boolean {
  if (!target) return false;

  // Archived students are always considered paused / inactive
  if (target.archived === true || target.status === 'archived') {
    return true;
  }

  // Explicit active flag overrides if status is explicitly active
  if (target.status === 'active') {
    return false;
  }

  // Check paused state
  if (target.status === 'paused') {
    if (target.pauseType === 'permanent') {
      return true;
    }

    if (target.pauseType === 'temporary') {
      const today = checkDateStr || getTodayCairoDateStr();
      // If start date is in the future, pause hasn't started yet
      if (target.pauseStartDate && today < target.pauseStartDate) {
        return false;
      }
      // If end date has already passed, pause is finished
      if (target.pauseEndDate && today > target.pauseEndDate) {
        return false;
      }
      return true;
    }

    // Default if status is paused without explicit type
    return true;
  }

  // Backward compatibility with legacy active: false
  if (target.active === false) {
    return true;
  }

  return false;
}

/**
 * Resolves the effective status of a student or membership.
 */
export function getStudentEffectiveStatus(
  target?: StatusTarget | null,
  checkDateStr?: string
): StudentStatus {
  if (!target) return 'active';
  if (target.archived === true || target.status === 'archived') return 'archived';
  if (isStudentPaused(target, checkDateStr)) return 'paused';
  return 'active';
}

export interface StudentStatusMeta {
  status: StudentStatus;
  isPaused: boolean;
  isTemporary: boolean;
  isPermanent: boolean;
  isArchived: boolean;
  label: string;
  badgeClass: string;
  detailedText: string;
  daysRemaining?: number;
  isEndingSoon: boolean;
  pauseStartDate?: string | null;
  pauseEndDate?: string | null;
}

/**
 * Computes difference in days between two YYYY-MM-DD date strings.
 */
export function getDaysDiff(fromDateStr: string, toDateStr: string): number {
  const d1 = new Date(fromDateStr + 'T00:00:00');
  const d2 = new Date(toDateStr + 'T00:00:00');
  const diffTime = d2.getTime() - d1.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Provides comprehensive UI badge and textual metadata for a student's status.
 */
export function getStudentStatusMeta(
  target?: StatusTarget | null,
  checkDateStr?: string
): StudentStatusMeta {
  const today = checkDateStr || getTodayCairoDateStr();
  const effective = getStudentEffectiveStatus(target, today);

  if (!target || effective === 'active') {
    return {
      status: 'active',
      isPaused: false,
      isTemporary: false,
      isPermanent: false,
      isArchived: false,
      label: 'نشط 🟢',
      badgeClass: 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300',
      detailedText: 'طالب نشط وحصصه مجدولة بصورة طبيعية',
      isEndingSoon: false,
    };
  }

  if (effective === 'archived') {
    return {
      status: 'archived',
      isPaused: true,
      isTemporary: false,
      isPermanent: true,
      isArchived: true,
      label: 'مؤرشف 🗄️',
      badgeClass: 'bg-slate-900 border-slate-700 text-slate-400',
      detailedText: 'طالب مؤرشف، بياناته وسجلاته المالية محفوظة بالكامل',
      isEndingSoon: false,
    };
  }

  // Paused status: determine whether temporary or permanent
  const isTemp = target.pauseType === 'temporary';
  let daysRemaining: number | undefined = undefined;
  let isEndingSoon = false;
  let detailed = 'متوقف نهائياً عن الحصص';

  if (isTemp) {
    if (target.pauseEndDate) {
      daysRemaining = getDaysDiff(today, target.pauseEndDate);
      if (daysRemaining < 0) {
        detailed = `انتهت فترة التوقف في ${target.pauseEndDate}`;
      } else if (daysRemaining === 0) {
        detailed = 'تنتهي فترة التوقف اليوم';
        isEndingSoon = true;
      } else if (daysRemaining === 1) {
        detailed = `تنتهي فترة التوقف غداً (${target.pauseEndDate})`;
        isEndingSoon = true;
      } else if (daysRemaining <= 2) {
        detailed = `متبقي ${daysRemaining} يوم على انتهاء التوقف (${target.pauseEndDate})`;
        isEndingSoon = true;
      } else {
        detailed = `متوقف مؤقتاً حتى ${target.pauseEndDate} (متبقي ${daysRemaining} يوم)`;
      }
    } else {
      detailed = 'متوقف مؤقتاً';
    }
  }

  return {
    status: 'paused',
    isPaused: true,
    isTemporary: isTemp,
    isPermanent: !isTemp,
    isArchived: false,
    label: isTemp ? 'متوقف مؤقتاً ⏸️' : 'متوقف نهائياً 🛑',
    badgeClass: isEndingSoon
      ? 'bg-amber-950/90 border-amber-500/80 text-amber-300 animate-pulse'
      : isTemp
      ? 'bg-amber-950/80 border-amber-500/50 text-amber-300'
      : 'bg-rose-950/80 border-rose-500/50 text-rose-300',
    detailedText: detailed,
    daysRemaining,
    isEndingSoon,
    pauseStartDate: target.pauseStartDate,
    pauseEndDate: target.pauseEndDate,
  };
}

export interface PauseEndingNotification {
  student: Student;
  meta: StudentStatusMeta;
  daysRemaining: number;
}

/**
 * Finds all students whose temporary pause is ending within the threshold (e.g. today or next 2 days)
 */
export function getPauseEndingSoonStudents(
  students: Student[],
  thresholdDays: number = 2
): PauseEndingNotification[] {
  const today = getTodayCairoDateStr();
  const results: PauseEndingNotification[] = [];

  for (const st of students) {
    if (st.status === 'paused' && st.pauseType === 'temporary' && st.pauseEndDate) {
      const days = getDaysDiff(today, st.pauseEndDate);
      // Ending within 0 to thresholdDays
      if (days >= 0 && days <= thresholdDays) {
        const meta = getStudentStatusMeta(st, today);
        results.push({
          student: st,
          meta,
          daysRemaining: days,
        });
      }
    }
  }

  return results.sort((a, b) => a.daysRemaining - b.daysRemaining);
}
