import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateParentCode,
  hashParentCode,
  isPlausibleParentCode,
  linkStatus,
  clampExpiryDays,
  buildParentView,
} from '../src/server/parent.ts';

test('codes are long, random, URL safe and hashed deterministically', () => {
  const a = generateParentCode();
  const b = generateParentCode();
  assert.notEqual(a, b);
  assert.ok(a.length >= 32);
  assert.ok(isPlausibleParentCode(a));
  assert.equal(hashParentCode(a), hashParentCode(` ${a} `));
  assert.notEqual(hashParentCode(a), hashParentCode(b));
  assert.equal(isPlausibleParentCode('short'), false);
  assert.equal(isPlausibleParentCode({}), false);
});

test('link status: revoked and expired links are rejected immediately', () => {
  const now = 1_000_000;
  assert.equal(linkStatus({ revoked: false, expiresAtMs: now + 1 }, now), 'ok');
  assert.equal(linkStatus({ revoked: true, expiresAtMs: now + 1 }, now), 'revoked');
  assert.equal(linkStatus({ revoked: false, expiresAtMs: now }, now), 'expired');
  assert.equal(clampExpiryDays(undefined), 90);
  assert.equal(clampExpiryDays(9999), 365);
  assert.equal(clampExpiryDays(-5), 90);
});

const base = {
  teacherName: 'أ. منى',
  student: { name: 'علي', subject: 'رياضيات', status: 'active', pendingDues: 120, parentPhone: '0100', hourlyRate: 80 },
  attendance: [{ date: '2026-10-20', status: 'absent', notes: 'مرض', teacherId: 'T', studentId: 'S' }],
  lessons: [
    { date: '2026-10-25', topic: 'كسور', attendance: 'present', rating: 5, cost: 80, hourlyRate: 80 },
    { date: '2026-08-01', topic: 'قديم', attendance: 'present' },
  ],
  schedules: [{ dayOfWeek: 2, time: '16:00', duration: 60, locationOrLink: 'x', teacherId: 'T' }],
  groupSlots: [{ groupName: 'مجموعة أ', day: 0, time: '18:00', duration: 90 }],
  library: [{ id: 'l1', title: 'ملخص', type: 'summary', content: 'https://youtu.be/x', fileData: 'BASE64', teacherId: 'T' }],
  payments: [{ month: '2026-10', status: 'partial', amountPaid: 50, amountDue: 100, teacherId: 'T' }],
  today: '2026-10-27',
};

test('view is a whitelist: no costs, phones, file bytes or ids leak; old rows are cut at 30 days', () => {
  const view = buildParentView({ ...base, showFinance: false });
  const json = JSON.stringify(view);
  for (const leak of ['hourlyRate', 'cost', 'parentPhone', 'BASE64', 'teacherId', '"T"', 'locationOrLink', 'قديم']) {
    assert.ok(!json.includes(leak), `leaked ${leak}`);
  }
  assert.equal((view as any).finance, null);
  assert.equal((view as any).attendanceSummary.absent, 1);
  assert.equal((view as any).attendanceSummary.present, 1);
  assert.equal((view as any).schedule.length, 2);
  assert.equal((view as any).lessons[0].rating, 5);
});

test('finance only appears when the teacher enabled it', () => {
  const on = buildParentView({ ...base, showFinance: true }) as any;
  assert.equal(on.finance.pendingDues, 120);
  assert.equal(on.finance.months[0].status, 'partial');
});

test('paused student has no schedule', () => {
  const v = buildParentView({ ...base, student: { ...base.student, status: 'paused' }, showFinance: false }) as any;
  assert.deepEqual(v.schedule, []);
});

import { appendParentLink } from '../src/services/parentLink.js';

test('appendParentLink adds the link only when present and not expired', () => {
  assert.equal(appendParentLink('مرحبا', {}), 'مرحبا');
  assert.match(appendParentLink('مرحبا', { parentPortalUrl: 'https://x/?parent=abc' }), /\?parent=abc/);
  assert.equal(
    appendParentLink('مرحبا', { parentPortalUrl: 'https://x/?parent=abc', parentPortalExpiresAtMs: 1 }, 1000),
    'مرحبا'
  );
});
