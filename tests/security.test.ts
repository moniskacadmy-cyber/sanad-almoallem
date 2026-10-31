import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { escapeHtml } from '../src/utils/security.js';

const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
const rules = fs.readFileSync(rulesPath, 'utf8');

const serverPath = path.resolve(process.cwd(), 'server.ts');
const serverContent = fs.readFileSync(serverPath, 'utf8');

// --- 1. Comprehensive XSS Prevention Tests ---
test('security: escapeHtml utility prevents various XSS payloads', () => {
  const payloads = [
    { in: '<script>alert("XSS")</script>', out: '&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;' },
    { in: '<img src=x onerror=alert(1)>', out: '&lt;img src=x onerror=alert(1)&gt;' },
    { in: 'javascript:alert(1)', out: 'javascript:alert(1)' }, // Normal text, not HTML
    { in: '<b>Bold</b>', out: '&lt;b&gt;Bold&lt;/b&gt;' },
    { in: '" onmouseover="alert(1)', out: '&quot; onmouseover=&quot;alert(1)' }
  ];
  
  payloads.forEach(p => {
    assert.strictEqual(escapeHtml(p.in), p.out);
  });
});

// --- 2. Unauthorized Data Access (Static Analysis of Firebase Rules) ---
test('security: Firestore rules enforce teacher ownership for critical collections', () => {
  // Check key collections for teacher owner enforcement
  const criticalCollections = ['students', 'payments', 'schedules', 'lessons'];
  criticalCollections.forEach(col => {
    // Look for match /.../{...Id} and ensure ownership check follows
    const regex = new RegExp(`match /${col}/\\{[^}]+\\} \\{[^]*?isTeacherOwner\\(teacherId\\) \\|\\| isAdmin\\(\\)`, 'g');
    assert.match(rules, regex, `Collection ${col} lacks teacher ownership/admin check`);
  });
});

// --- 3. API Subscription Validation Tests ---
test('security: API endpoints require active subscription', () => {
  // Check that critical API endpoints use the requireActiveSubscription middleware
  const criticalEndpoints = [
    '/api/ai/ask',
    '/api/ai/transcribe',
    '/api/ai/assistant',
    // Add other protected endpoints here as identified in the hardening plan
  ];

  criticalEndpoints.forEach(endpoint => {
    // Server content check: app.post('...', ..., requireActiveSubscription, ...)
    const regex = new RegExp(`app\\.post\\('${endpoint}'[^]*?requireActiveSubscription`);
    assert.match(serverContent, regex, `API endpoint ${endpoint} does not enforce active subscription`);
  });
});

// --- 4. Cache Security Tests (Server) ---
test('security: Cache Key includes UID and Hash of sources (Server)', () => {
  // Verify that the cacheKey in server.ts uses uid and sourcesHash
  assert.match(serverContent, /const\s+uid\s*=\s*\([^)]*\)\.user\.uid/);
  assert.match(serverContent, /const\s+sourcesHash\s*=\s*crypto\.createHash\('sha256'\)/);
  assert.match(serverContent, /const\s+cacheKey\s*=\s*`\${uid}:/);
});
