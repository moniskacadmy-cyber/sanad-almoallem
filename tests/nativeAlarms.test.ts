import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAlarmRules } from '../src/services/nativeAlarms.js';

const st = (id: string, extra: any = {}) => ({ id, name: id, ...extra } as any);

test('alarm rules: active slots and groups only', () => {
  const rules = buildAlarmRules({
    minutesBefore: 20,
    isPaused: (s) => s.status === 'paused',
    students: [st('a'), st('p', { status: 'paused' }), st('z', { archived: true })],
    schedules: [
      { id: '1', studentId: 'a', studentName: 'أحمد', dayOfWeek: 0, time: '16:30', locationOrLink: 'منزل' },
      { id: '2', studentId: 'p', studentName: 'موقوف', dayOfWeek: 1, time: '10:00' },
      { id: '3', studentId: 'z', studentName: 'أرشيف', dayOfWeek: 2, time: '10:00' },
      { id: '4', studentId: 'a', studentName: 'ملغي', dayOfWeek: 3, time: '10:00', cancelled: true },
      { id: '5', studentId: 'a', studentName: 'وقت غلط', dayOfWeek: 4, time: 'abc' },
      { id: '6', studentId: 'ghost', studentName: 'مجهول', dayOfWeek: 4, time: '10:00' },
    ] as any,
    groups: [
      { id: 'g1', name: 'ثالثة', status: 'active', centerName: 'سنتر', schedule: [{ day: 5, time: '18:00' }] },
      { id: 'g2', name: 'متوقفة', status: 'paused', schedule: [{ day: 5, time: '19:00' }] },
    ] as any,
  });
  assert.deepEqual(rules.map((r) => r.id), ['s_1', 'g_g1_0']);
  assert.equal(rules[0].minutesBefore, 20);
  assert.match(rules[0].title, /أحمد/);
  assert.match(rules[0].body, /16:30/);
});
