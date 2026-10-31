import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSlug, sanitizePublicProfile, sanitizeSlots, toPublicView, validateBooking } from '../src/server/publicPage.js';

test('slug: arabic/latin ok, junk removed, length enforced', () => {
  assert.equal(normalizeSlug('  أ. محمد  علي '), 'أ-محمد-علي');
  assert.equal(normalizeSlug('Mr Ahmed!'), 'mr-ahmed');
  assert.equal(normalizeSlug('ab'), '');
  assert.equal(normalizeSlug('a/../bc'), 'abc');
  assert.equal(normalizeSlug(123 as any), '');
});

test('slots: invalid ones are dropped', () => {
  const s = sanitizeSlots([{ day: 1, from: '16:00', to: '18:00' }, { day: 9, from: '16:00', to: '18:00' }, { day: 2, from: '18:00', to: '16:00' }, { day: 3, from: 'x', to: 'y' }]);
  assert.deepEqual(s, [{ day: 1, from: '16:00', to: '18:00' }]);
});

test('profile: only whitelisted fields, html stripped', () => {
  const p = sanitizePublicProfile({ name: '<b>أحمد</b>', stages: ['ثانوي', 'hack'], enabled: true, studentIds: ['x'], email: 'a@b.c', experienceYears: 999 });
  assert.equal(p.name, 'bأحمد/b');
  assert.deepEqual(p.stages, ['ثانوي']);
  assert.equal(p.experienceYears, 60);
  assert.equal((p as any).studentIds, undefined);
  assert.equal((p as any).email, undefined);
});

test('booking: validation and honeypot', () => {
  assert.equal(validateBooking({ studentName: 'س', phone: '01012345678' }).ok, false);
  assert.equal(validateBooking({ studentName: 'سارة', phone: '123' }).ok, false);
  assert.equal(validateBooking({ studentName: 'سارة', phone: '01012345678', website: 'spam' }).ok, false);
  const r = validateBooking({ studentName: 'سارة', phone: '0101 234 5678', slot: { day: 1, from: '16:00', to: '17:00' } });
  assert.equal(r.ok, true);
});

test('public view never exposes private fields', () => {
  const v = toPublicView({ slug: 'a-b-c', name: 'x', teacherId: 'SECRET', email: 'e', phone: '1' });
  assert.equal((v as any).teacherId, undefined);
  assert.equal((v as any).email, undefined);
});
