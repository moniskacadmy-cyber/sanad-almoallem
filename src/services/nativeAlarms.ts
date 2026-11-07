import type { Group, ScheduleSlot, Student } from '../types';

export interface NativeAlarmRule {
  id: string;
  day: number;
  time: string;
  minutesBefore: number;
  title: string;
  body: string;
}

interface Bridge {
  setClassAlarms?: (json: string) => void;
  setAlarmsEnabled?: (v: boolean) => void;
  isAlarmsEnabled?: () => boolean;
  testAlarm?: () => void;
}

const bridge = (): Bridge | undefined => (typeof window !== 'undefined' ? ((window as any).SanadAndroid as Bridge | undefined) : undefined);

/** True only inside the Android app version that has the alarm bridge. */
export const hasNativeAlarms = (): boolean => typeof bridge()?.setClassAlarms === 'function';
export const nativeAlarmsEnabled = (): boolean => {
  try {
    return !!bridge()?.isAlarmsEnabled?.();
  } catch {
    return false;
  }
};
export const setNativeAlarmsEnabled = (v: boolean) => bridge()?.setAlarmsEnabled?.(v);
export const testNativeAlarm = () => bridge()?.testAlarm?.();

const validTime = (t: unknown): t is string => typeof t === 'string' && /^\d{1,2}:\d{2}/.test(t.trim());

/** Weekly alarm rules for every ACTIVE individual slot and group slot (paused / archived / cancelled are skipped). */
export function buildAlarmRules(params: {
  schedules: ScheduleSlot[];
  groups: Group[];
  students: Student[];
  minutesBefore: number;
  isPaused: (s: Student) => boolean;
}): NativeAlarmRule[] {
  const { schedules, groups, students, minutesBefore, isPaused } = params;
  const mb = Math.max(0, Math.min(180, Number(minutesBefore) || 15));
  const rules: NativeAlarmRule[] = [];

  for (const s of schedules || []) {
    if (!s || s.cancelled || s.status === 'cancelled' || s.status === 'paused') continue;
    const st = students.find((x) => x.id === s.studentId);
    if (!st || st.archived || isPaused(st)) continue;
    if (!validTime(s.time) || s.dayOfWeek < 0 || s.dayOfWeek > 6) continue;
    rules.push({
      id: `s_${s.id}`,
      day: s.dayOfWeek,
      time: s.time.trim(),
      minutesBefore: mb,
      title: `⏰ حصة ${s.studentName} بعد ${mb} دقيقة`,
      body: `الساعة ${s.time.trim()}${s.locationOrLink ? ` • ${s.locationOrLink}` : ''}`,
    });
  }
  for (const g of groups || []) {
    if (g.status !== 'active' || g.archived || !Array.isArray(g.schedule)) continue;
    g.schedule.forEach((item, i) => {
      if (!validTime(item.time) || item.day < 0 || item.day > 6) return;
      rules.push({
        id: `g_${g.id}_${i}`,
        day: item.day,
        time: item.time.trim(),
        minutesBefore: mb,
        title: `⏰ مجموعة ${g.name} بعد ${mb} دقيقة`,
        body: `الساعة ${item.time.trim()}${g.centerName ? ` • ${g.centerName}` : ''}`,
      });
    });
  }
  return rules;
}

export function pushAlarmRules(rules: NativeAlarmRule[]) {
  try {
    bridge()?.setClassAlarms?.(JSON.stringify(rules));
  } catch {
    /* ignore */
  }
}
