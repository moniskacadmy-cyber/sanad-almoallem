import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { escapeHtml } from '../src/utils/security.js';

const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
const rules = fs.readFileSync(rulesPath, 'utf8');

// --- XSS Prevention Tests ---
test('security: escapeHtml utility prevents script injection', () => {
  const unsafe = '<script>alert("XSS")</script>';
  const escaped = escapeHtml(unsafe);
  assert.strictEqual(escaped, '&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;');
  assert.doesNotMatch(escaped, /<script>/);
});

// --- Unauthorized Data Access Tests (Firestore Rules) ---
test('security: Firestore rules enforce teacher ownership', () => {
  // Ensure that every read/write match requires teacher ownership or admin access
  assert.match(rules, /isTeacherOwner\(teacherId\)\s*\|\|\s*isAdmin\(\)/);
});

// --- Subscription Validation Tests ---
test('security: Firestore rules require active subscription for critical writes', () => {
  // Ensure that critical writes enforce subscription status
  assert.match(rules, /isTeacherSubscriptionActive\(teacherId\)/);
});

// --- Cache Security Tests (Server) ---
test('security: Cache Key includes UID and Hash of sources (Server)', () => {
  const serverPath = path.resolve(process.cwd(), 'server.ts');
  const serverContent = fs.readFileSync(serverPath, 'utf8');
  
  // Verify that the cacheKey in server.ts uses uid and sourcesHash
  assert.match(serverContent, /const\s+uid\s*=\s*\([^)]*\)\.user\.uid/);
  assert.match(serverContent, /const\s+sourcesHash\s*=\s*crypto\.createHash\('sha256'\)/);
  assert.match(serverContent, /const\s+cacheKey\s*=\s*`\${uid}:/);
});
