import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  authorizeActiveSubscription,
  createSubscriptionGuard,
  evaluateSubscription,
  parseExpiryDateServer,
  withAccessCache,
  type AccessDeps,
  type TeacherSubscriptionData,
} from '../src/server/subscriptionAccess.ts';

const NOW = new Date('2026-10-04T12:00:00Z');
const FUTURE = new Date('2026-12-01T00:00:00Z');
const PAST = new Date('2026-09-01T00:00:00Z');

const ts = (d: Date) => ({ toDate: () => d });

function deps(over: Partial<AccessDeps> & { teacher?: TeacherSubscriptionData | null } = {}): AccessDeps {
  return {
    now: () => NOW,
    isAdmin: over.isAdmin ?? (async () => false),
    readTeacher: over.readTeacher ?? (async () => (over.teacher === undefined ? null : over.teacher)),
    logError: () => {},
  };
}

/* ---------- parseExpiryDateServer ---------- */

test('parse: Firestore Timestamp with toDate()', () => {
  assert.equal(parseExpiryDateServer(ts(FUTURE))?.getTime(), FUTURE.getTime());
});
test('parse: serialized Timestamp {_seconds} and {seconds}', () => {
  const secs = Math.floor(FUTURE.getTime() / 1000);
  assert.equal(parseExpiryDateServer({ _seconds: secs })?.getTime(), FUTURE.getTime());
  assert.equal(parseExpiryDateServer({ seconds: secs })?.getTime(), FUTURE.getTime());
});
test('parse: Date, ISO string, unix ms', () => {
  assert.equal(parseExpiryDateServer(FUTURE)?.getTime(), FUTURE.getTime());
  assert.equal(parseExpiryDateServer(FUTURE.toISOString())?.getTime(), FUTURE.getTime());
  assert.equal(parseExpiryDateServer(FUTURE.getTime())?.getTime(), FUTURE.getTime());
});
test('parse: null / empty / garbage / invalid return null', () => {
  for (const v of [null, undefined, '', 'not-a-date', {}, NaN, new Date('x'), { toDate: () => new Date('x') }]) {
    assert.equal(parseExpiryDateServer(v), null, String(v));
  }
});
test('parse: toDate() that throws returns null', () => {
  assert.equal(parseExpiryDateServer({ toDate: () => { throw new Error('boom'); } }), null);
});

/* ---------- evaluateSubscription ---------- */

test('evaluate: future expiry is active', () => {
  assert.equal(evaluateSubscription({ subscriptionExpiresAt: ts(FUTURE) }, NOW), 'active');
});
test('evaluate: past expiry is expired', () => {
  assert.equal(evaluateSubscription({ subscriptionExpiresAt: ts(PAST) }, NOW), 'expired');
});
test('evaluate: expiry exactly now is expired (boundary)', () => {
  assert.equal(evaluateSubscription({ subscriptionExpiresAt: ts(NOW) }, NOW), 'expired');
});
test('evaluate: one second before expiry is still active (boundary)', () => {
  assert.equal(evaluateSubscription({ subscriptionExpiresAt: ts(new Date(NOW.getTime() + 1000)) }, NOW), 'active');
});
test('evaluate: isActive=false wins even with a future date', () => {
  assert.equal(evaluateSubscription({ isActive: false, subscriptionEndDate: ts(FUTURE) }, NOW), 'deactivated');
});
test('evaluate: subscriptionEndDate takes precedence over subscriptionExpiresAt', () => {
  assert.equal(
    evaluateSubscription({ subscriptionEndDate: ts(FUTURE), subscriptionExpiresAt: ts(PAST) }, NOW),
    'active'
  );
  assert.equal(
    evaluateSubscription({ subscriptionEndDate: ts(PAST), subscriptionExpiresAt: ts(FUTURE) }, NOW),
    'expired'
  );
});
test('evaluate: unparsable date is invalid (does not fall back to status)', () => {
  assert.equal(evaluateSubscription({ subscriptionExpiresAt: 'garbage' }, NOW), 'invalid');
});
test('evaluate: no date at all is invalid', () => {
  assert.equal(evaluateSubscription({}, NOW), 'invalid');
  assert.equal(evaluateSubscription(null, NOW), 'invalid');
});
test('evaluate: trialEndDate is used only as last fallback', () => {
  assert.equal(evaluateSubscription({ trialEndDate: ts(FUTURE) }, NOW), 'active');
});

/* ---------- authorizeActiveSubscription ---------- */

test('authz: active subscription is allowed', async () => {
  const r = await authorizeActiveSubscription('u1', deps({ teacher: { subscriptionExpiresAt: ts(FUTURE) } }));
  assert.deepEqual(r, { ok: true, uid: 'u1', reason: 'active_subscription' });
});
test('authz: expired subscription -> 403 subscription_expired', async () => {
  const r = await authorizeActiveSubscription('u1', deps({ teacher: { subscriptionExpiresAt: ts(PAST) } }));
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.status, 403);
    assert.equal(r.code, 'subscription_expired');
  }
});
test('authz: missing teacher document -> 403 (was fail-open before)', async () => {
  const r = await authorizeActiveSubscription('u1', deps({ teacher: null }));
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.status, 403);
    assert.equal(r.code, 'teacher_profile_missing');
  }
});
test('authz: Firestore failure reading teacher -> 503, never allowed (was fail-open before)', async () => {
  const r = await authorizeActiveSubscription(
    'u1',
    deps({ readTeacher: async () => { throw new Error('UNAVAILABLE'); } })
  );
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.status, 503);
    assert.equal(r.code, 'verification_unavailable');
  }
});
test('authz: failure reading admins collection -> 503, never allowed', async () => {
  const r = await authorizeActiveSubscription(
    'u1',
    deps({
      isAdmin: async () => { throw new Error('PERMISSION_DENIED'); },
      teacher: { subscriptionExpiresAt: ts(FUTURE) },
    })
  );
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.status, 503);
});
test('authz: admin is allowed even with expired subscription and without teacher doc', async () => {
  const r = await authorizeActiveSubscription(
    'admin1',
    deps({ isAdmin: async (uid) => uid === 'admin1', teacher: null })
  );
  assert.deepEqual(r, { ok: true, uid: 'admin1', reason: 'admin' });
});
test('authz: teacher doc with role="admin" but no admins/{uid} doc gets NO bypass', async () => {
  const r = await authorizeActiveSubscription(
    'u1',
    deps({ teacher: { subscriptionExpiresAt: ts(PAST), ...( { role: 'admin' } as object ) } })
  );
  assert.equal(r.ok, false);
});
test('authz: deactivated account -> 403', async () => {
  const r = await authorizeActiveSubscription(
    'u1',
    deps({ teacher: { isActive: false, subscriptionEndDate: ts(FUTURE) } })
  );
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, 'account_deactivated');
});
test('authz: missing / empty uid -> 401', async () => {
  for (const uid of [undefined, null, '']) {
    const r = await authorizeActiveSubscription(uid, deps());
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.status, 401);
  }
});
test('authz: error messages do not leak internals', async () => {
  const r = await authorizeActiveSubscription(
    'u1',
    deps({ readTeacher: async () => { throw new Error('secret-project-id-123 PERMISSION_DENIED'); } })
  );
  assert.equal(r.ok, false);
  if (!r.ok) assert.ok(!r.message.includes('secret-project-id-123'));
});
test('authz: unexpected error is logged but not returned', async () => {
  const logged: string[] = [];
  const d = deps({ readTeacher: async () => { throw new Error('x'); } });
  d.logError = (m) => logged.push(m);
  await authorizeActiveSubscription('u1', d);
  assert.equal(logged.length, 1);
});

/* ---------- middleware ---------- */

function run(guardDeps: AccessDeps, user?: { uid?: string }) {
  const guard = createSubscriptionGuard(guardDeps);
  let nextCalled = false;
  let status = 0;
  let body: unknown;
  const res = {
    status(code: number) {
      status = code;
      return { json: (b: unknown) => { body = b; } };
    },
  };
  return guard({ user }, res, () => { nextCalled = true; }).then(() => ({ nextCalled, status, body }));
}

test('middleware: calls next() for active subscription', async () => {
  const r = await run(deps({ teacher: { subscriptionExpiresAt: ts(FUTURE) } }), { uid: 'u1' });
  assert.equal(r.nextCalled, true);
});
test('middleware: 403 and no next() for expired subscription', async () => {
  const r = await run(deps({ teacher: { subscriptionExpiresAt: ts(PAST) } }), { uid: 'u1' });
  assert.equal(r.nextCalled, false);
  assert.equal(r.status, 403);
});
test('middleware: 503 and no next() when Firestore is down', async () => {
  const r = await run(deps({ readTeacher: async () => { throw new Error('down'); } }), { uid: 'u1' });
  assert.equal(r.nextCalled, false);
  assert.equal(r.status, 503);
});
test('middleware: 401 and no next() when no verified user is present', async () => {
  const r = await run(deps(), undefined);
  assert.equal(r.nextCalled, false);
  assert.equal(r.status, 401);
});
test('middleware: ignores any teacherId/uid the client could send (uid comes only from req.user)', async () => {
  const seen: string[] = [];
  const d = deps({
    readTeacher: async (uid) => { seen.push(uid); return { subscriptionExpiresAt: ts(FUTURE) }; },
  });
  const guard = createSubscriptionGuard(d);
  const req = { user: { uid: 'real-uid' }, body: { teacherId: 'victim-uid', uid: 'victim-uid' } };
  await guard(req as never, { status: () => ({ json: () => undefined }) }, () => {});
  assert.deepEqual(seen, ['real-uid']);
});

/* ---------- withAccessCache (30s TTL cache) ---------- */

function cacheHarness(teacher: TeacherSubscriptionData | null, admin = false) {
  let t = 0;
  const calls = { teacher: 0, admin: 0 };
  let currentTeacher = teacher;
  let currentAdmin = admin;
  let nowDate = NOW;
  const base: AccessDeps = {
    now: () => nowDate,
    isAdmin: async () => {
      calls.admin++;
      return currentAdmin;
    },
    readTeacher: async () => {
      calls.teacher++;
      return currentTeacher;
    },
    logError: () => {},
  };
  const cached = withAccessCache(base, { ttlMs: 30_000, maxEntries: 3, nowMs: () => t });
  return {
    cached,
    calls,
    advance: (ms: number) => {
      t += ms;
      nowDate = new Date(nowDate.getTime() + ms);
    },
    setTeacher: (x: TeacherSubscriptionData | null) => {
      currentTeacher = x;
    },
    setAdmin: (x: boolean) => {
      currentAdmin = x;
    },
  };
}

test('cache: active teacher + admin result are served from memory within 30s, refreshed after', async () => {
  const h = cacheHarness({ subscriptionExpiresAt: ts(FUTURE) });
  await h.cached.readTeacher('u1');
  await h.cached.isAdmin('u1');
  h.advance(29_000);
  await h.cached.readTeacher('u1');
  await h.cached.isAdmin('u1');
  assert.deepEqual(h.calls, { teacher: 1, admin: 1 }, 'second round served from cache');
  h.advance(2_000); // 31s since the first read
  await h.cached.readTeacher('u1');
  await h.cached.isAdmin('u1');
  assert.deepEqual(h.calls, { teacher: 2, admin: 2 }, 'refetched after TTL expiry');
});

test('cache: a deactivation is visible after at most 30 seconds', async () => {
  const h = cacheHarness({ subscriptionExpiresAt: ts(FUTURE) });
  const guard = (d: AccessDeps) => authorizeActiveSubscription('u1', d);
  assert.equal((await guard(h.cached)).ok, true);
  h.setTeacher({ subscriptionExpiresAt: ts(FUTURE), isActive: false });
  h.advance(31_000);
  const after = await guard(h.cached);
  assert.equal(after.ok, false);
  if (!after.ok) assert.equal(after.code, 'account_deactivated');
});

test('cache: expiry is honoured exactly even while the teacher document is cached', async () => {
  const soon = new Date(NOW.getTime() + 10_000);
  const h = cacheHarness({ subscriptionExpiresAt: ts(soon) });
  assert.equal((await authorizeActiveSubscription('u1', h.cached)).ok, true);
  h.advance(11_000); // subscription ended 1s ago, but cache TTL (30s) has not elapsed
  const r = await authorizeActiveSubscription('u1', h.cached);
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, 'subscription_expired');
  assert.equal(h.calls.teacher, 1, 'decision came from cached data, re-evaluated against the clock');
});

test('cache: expired / deactivated / missing teachers are NOT cached (renewals apply immediately)', async () => {
  const h = cacheHarness({ subscriptionExpiresAt: ts(PAST) });
  assert.equal((await authorizeActiveSubscription('u1', h.cached)).ok, false);
  h.setTeacher({ subscriptionExpiresAt: ts(FUTURE) }); // admin renews
  assert.equal((await authorizeActiveSubscription('u1', h.cached)).ok, true, 'renewal visible immediately');

  const missing = cacheHarness(null);
  assert.equal((await authorizeActiveSubscription('u2', missing.cached)).ok, false);
  missing.setTeacher({ subscriptionExpiresAt: ts(FUTURE) }); // profile just created
  assert.equal((await authorizeActiveSubscription('u2', missing.cached)).ok, true);
});

test('cache: errors are never cached and still fail closed with 503', async () => {
  let fail = true;
  const base: AccessDeps = {
    now: () => NOW,
    isAdmin: async () => false,
    readTeacher: async () => {
      if (fail) throw new Error('down');
      return { subscriptionExpiresAt: ts(FUTURE) };
    },
    logError: () => {},
  };
  const cached = withAccessCache(base, { nowMs: () => 0 });
  const first = await authorizeActiveSubscription('u1', cached);
  assert.equal(first.ok, false);
  if (!first.ok) assert.equal(first.status, 503);
  fail = false;
  assert.equal((await authorizeActiveSubscription('u1', cached)).ok, true);
});

test('cache: never holds more than maxEntries (oldest evicted first)', async () => {
  const h = cacheHarness({ subscriptionExpiresAt: ts(FUTURE) });
  for (const uid of ['a', 'b', 'c', 'd']) await h.cached.readTeacher(uid); // maxEntries = 3 -> 'a' evicted
  assert.equal(h.calls.teacher, 4);
  await h.cached.readTeacher('d');
  await h.cached.readTeacher('c');
  await h.cached.readTeacher('b');
  assert.equal(h.calls.teacher, 4, 'b, c, d still cached');
  await h.cached.readTeacher('a');
  assert.equal(h.calls.teacher, 5, 'a was evicted and refetched');
});
