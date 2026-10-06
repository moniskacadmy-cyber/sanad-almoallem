import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isDisposableEmail,
  checkAndIncrementAccountInitIpMemory,
  clearAccountInitIpMemory,
  createAccountRouter,
} from '../src/server/accountRoutes.js';

test('security: isDisposableEmail correctly identifies disposable email domains and subdomains', () => {
  // Disposable domains
  assert.equal(isDisposableEmail('test@tempmail.com'), true);
  assert.equal(isDisposableEmail('USER@MAILINATOR.COM'), true);
  assert.equal(isDisposableEmail('  alex@10minutemail.com  '), true);
  assert.equal(isDisposableEmail('john@guerrillamail.com'), true);
  assert.equal(isDisposableEmail('sub@box.mailinator.com'), true);
  assert.equal(isDisposableEmail('teacher@mohmal.com'), true);
  assert.equal(isDisposableEmail('spam@dispostable.com'), true);

  // Legitimate domains
  assert.equal(isDisposableEmail('teacher@gmail.com'), false);
  assert.equal(isDisposableEmail('user@outlook.com'), false);
  assert.equal(isDisposableEmail('math.teacher@school.edu.eg'), false);
  assert.equal(isDisposableEmail('info@sanad-teacher.com'), false);

  // Invalid inputs
  assert.equal(isDisposableEmail(''), false);
  assert.equal(isDisposableEmail('invalidemail'), false);
  assert.equal(isDisposableEmail(null as any), false);
});

test('security: account init in-memory IP rate limiter blocks after 5 attempts per IP', () => {
  clearAccountInitIpMemory();
  const testIp = '192.168.1.100';

  assert.equal(checkAndIncrementAccountInitIpMemory(testIp), true); // 1
  assert.equal(checkAndIncrementAccountInitIpMemory(testIp), true); // 2
  assert.equal(checkAndIncrementAccountInitIpMemory(testIp), true); // 3
  assert.equal(checkAndIncrementAccountInitIpMemory(testIp), true); // 4
  assert.equal(checkAndIncrementAccountInitIpMemory(testIp), true); // 5
  assert.equal(checkAndIncrementAccountInitIpMemory(testIp), false); // 6th attempt blocked!

  // Different IP should still be allowed
  const otherIp = '192.168.1.101';
  assert.equal(checkAndIncrementAccountInitIpMemory(otherIp), true);
});

test('security: /api/account/init rejects disposable email and IP rate limit in express router', async () => {
  const router = createAccountRouter();

  // Test 1: Disposable email rejection
  let status1 = 0;
  let json1: any = null;
  const req1: any = {
    ip: '10.0.0.1',
    user: { uid: 'user_temp_123', email: 'teacher@tempmail.com' },
    body: {},
  };
  const res1: any = {
    status(s: number) { status1 = s; return this; },
    json(data: any) { json1 = data; return this; },
  };

  await new Promise<void>((resolve) => {
    // Dispatch request to router stack
    const reqWithUrl = { ...req1, url: '/init', method: 'POST' };
    router(reqWithUrl as any, res1 as any, () => resolve());
    setTimeout(resolve, 100);
  });

  assert.equal(status1, 400);
  assert.match(json1?.error, /مؤقت/);
});
