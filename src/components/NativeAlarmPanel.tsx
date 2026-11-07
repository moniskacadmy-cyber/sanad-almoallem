import React, { useEffect, useState } from 'react';
import { AlarmClock } from 'lucide-react';
import { useFirebaseSubscription } from '../hooks/useFirebaseSubscription';
import { subscribeToGroups, subscribeToSchedules, subscribeToStudents } from '../firebase';
import { isStudentPaused } from '../services/studentStatus';
import type { Group, ScheduleSlot, Student, TeacherProfile } from '../types';
import {
  buildAlarmRules,
  hasNativeAlarms,
  nativeAlarmsEnabled,
  pushAlarmRules,
  setNativeAlarmsEnabled,
  testNativeAlarm,
} from '../services/nativeAlarms';

/**
 * Android app only: real alarm before each class. Also keeps the phone's alarm list in sync with the timetable
 * whenever the app is open (the phone keeps ringing weekly on its own in between).
 */
export const NativeAlarmPanel: React.FC<{ profile: TeacherProfile }> = ({ profile }) => {
  const native = hasNativeAlarms();
  const [enabled, setEnabled] = useState(() => (native ? nativeAlarmsEnabled() : false));
  const [groups, setGroups] = useState<Group[]>([]);

  const { data: students } = useFirebaseSubscription<Student[]>(native ? `students/${profile.id}` : null, (cb) => subscribeToStudents(profile.id, cb));
  const { data: schedules } = useFirebaseSubscription<ScheduleSlot[]>(native ? `schedules/${profile.id}` : null, (cb) => subscribeToSchedules(profile.id, cb));

  useEffect(() => {
    if (!native) return;
    const unsub = subscribeToGroups(profile.id, (g) => setGroups(g));
    return () => unsub();
  }, [native, profile.id]);

  useEffect(() => {
    if (!native || !enabled || !students || !schedules) return;
    pushAlarmRules(
      buildAlarmRules({
        schedules,
        groups,
        students,
        minutesBefore: profile.reminderMinutesBefore || 15,
        isPaused: (s) => isStudentPaused(s),
      })
    );
  }, [native, enabled, students, schedules, groups, profile.reminderMinutesBefore]);

  if (!native) return null;

  return (
    <div className="rounded-2xl bg-slate-900 border border-amber-500/30 p-4 space-y-3 text-right" dir="rtl">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-amber-200 text-sm font-extrabold">
          <AlarmClock className="w-4 h-4" />
          <span>منبّه الحصص (يرنّ زي المنبّه) ⏰</span>
        </div>
        <label className="inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            className="sr-only peer"
            checked={enabled}
            onChange={(e) => {
              setEnabled(e.target.checked);
              setNativeAlarmsEnabled(e.target.checked);
            }}
          />
          <span className="w-11 h-6 rounded-full bg-slate-700 peer-checked:bg-amber-500 relative transition after:content-[''] after:absolute after:top-0.5 after:right-0.5 after:w-5 after:h-5 after:rounded-full after:bg-white after:transition peer-checked:after:-translate-x-5" />
        </label>
      </div>
      <p className="text-[11px] text-slate-400 leading-relaxed">
        قبل كل حصة بـ {profile.reminderMinutesBefore || 15} دقيقة الفون هيرنّ بصوت المنبّه ويفتح شاشة فيها "إيقاف" و"غفوة 5 دقايق"، حتى لو الفون مقفول أو صامت. بيشتغل أسبوعياً لوحده، وبيتحدّث لما تفتح التطبيق بعد أي تغيير في جدولك.
      </p>
      <button
        type="button"
        onClick={() => testNativeAlarm()}
        className="w-full py-2 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-200 text-xs font-bold cursor-pointer"
      >
        جرّب المنبّه (هيرنّ بعد 5 ثواني)
      </button>
      <p className="text-[10px] text-slate-500 leading-relaxed">
        لو ماظهرتش الشاشة فوق القفل: إعدادات الهاتف ← التطبيقات ← سند المعلم ← فعّل "العرض بملء الشاشة" و"الإشعارات". وشيّل "توفير البطارية" عن التطبيق.
      </p>
    </div>
  );
};
