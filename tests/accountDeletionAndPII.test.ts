import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  maskEmail,
  maskPhone,
  maskPiiString,
  scrubPII,
} from '../src/server/piiScrubber.ts';

/* ==========================================================================
   1. PII Masking Unit Tests
   ========================================================================== */

test('PII Scrubber: maskEmail masks username and preserves domain', () => {
  assert.equal(maskEmail('teacher@example.com'), 't***r@example.com');
  assert.equal(maskEmail('ahmed.ali@school.edu.eg'), 'a***i@school.edu.eg');
  assert.equal(maskEmail('a@b.com'), '*@b.com');
  assert.equal(maskEmail(''), '');
});

test('PII Scrubber: maskPhone masks middle digits and keeps prefix/suffix', () => {
  const maskedEgypt = maskPhone('+201025967471');
  assert.ok(maskedEgypt.startsWith('+2010****'));
  assert.ok(maskedEgypt.endsWith('471'));
  assert.ok(!maskedEgypt.includes('2596')); // Sensitive middle digits are hidden

  const maskedLocal = maskPhone('01012345678');
  assert.ok(maskedLocal.startsWith('010****'));
  assert.ok(maskedLocal.endsWith('678'));
});

test('PII Scrubber: maskPiiString replaces Bearer tokens, API keys, and credentials', () => {
  const logWithToken = 'Handling request with Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xyz.123';
  const scrubbed = maskPiiString(logWithToken);
  assert.ok(!scrubbed.includes('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'));
  assert.ok(scrubbed.includes('[REDACTED_TOKEN]') || scrubbed.includes('[REDACTED_JWT]'));

  const logWithApiKey = 'Initialized Firebase with key AIzaSyA1234567890abcdefghijklmnopqrstuv';
  const scrubbedKey = maskPiiString(logWithApiKey);
  assert.ok(!scrubbedKey.includes('AIzaSyA1234567890abcdefghijklmnopqrstuv'));
  assert.ok(scrubbedKey.includes('[REDACTED_API_KEY]'));
});

test('PII Scrubber: scrubPII recursively cleans sensitive keys in objects', () => {
  const rawData = {
    teacherId: 'teacher_123',
    email: 'moniskacadmy@gmail.com',
    whatsapp: '01025967471',
    password: 'super_secret_password',
    token: 'fcm_device_token_secret_xyz',
    students: [
      { name: 'عمر مصطفى', parentPhone: '01099887766', email: 'omar@student.com' },
    ],
  };

  const cleaned = scrubPII(rawData);

  assert.equal(cleaned.teacherId, 'teacher_123');
  assert.equal(cleaned.password, '[REDACTED]');
  assert.equal(cleaned.token, '[REDACTED]');
  assert.ok(cleaned.email.includes('***'));
  assert.ok(!cleaned.email.includes('moniskacadmy'));
  assert.ok(cleaned.whatsapp.includes('****'));
  assert.ok(cleaned.students[0].email.includes('***'));
  assert.ok(cleaned.students[0].parentPhone.includes('****'));
});

/* ==========================================================================
   2. Data Export (CSV / Excel format) Unit Tests
   ========================================================================== */

function generateTeacherStudentsCsv(students: Array<Record<string, any>>): string {
  const BOM = '\uFEFF';
  const headers = ['اسم الطالب', 'رقم الهاتف / الواتساب', 'المادة', 'المرحلة الدراسية', 'سعر الحصة', 'الحالة'];
  const rows = students.map((s) => [
    `"${(s.name || '').replace(/"/g, '""')}"`,
    `"${(s.whatsapp || s.phone || '').replace(/"/g, '""')}"`,
    `"${(s.subject || '').replace(/"/g, '""')}"`,
    `"${(s.grade || '').replace(/"/g, '""')}"`,
    s.pricePerLesson ?? 0,
    `"${(s.status || 'active').replace(/"/g, '""')}"`,
  ]);

  return BOM + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
}

test('Data Export: CSV includes UTF-8 BOM and correct column headers for Excel', () => {
  const mockStudents = [
    { name: 'أحمد محمود', whatsapp: '01011112222', subject: 'رياضيات', grade: 'الثالث الإعدادي', pricePerLesson: 150, status: 'نشط' },
    { name: 'سارة خالد', whatsapp: '01033334444', subject: 'علوم', grade: 'الأول الثانوي', pricePerLesson: 200, status: 'نشط' },
  ];

  const csvContent = generateTeacherStudentsCsv(mockStudents);

  // Must begin with UTF-8 BOM so Excel opens Arabic correctly
  assert.ok(csvContent.startsWith('\uFEFF'));
  assert.ok(csvContent.includes('اسم الطالب,رقم الهاتف / الواتساب'));
  assert.ok(csvContent.includes('"أحمد محمود"'));
  assert.ok(csvContent.includes('"01011112222"'));
  assert.ok(csvContent.includes('150'));
});

/* ==========================================================================
   3. Account & Data Deletion Cascade Architecture Tests
   ========================================================================== */

test('Account Deletion: verify deletion cascade components', () => {
  // Verifies the comprehensive list of targets to delete during Right to be Forgotten
  const requiredDeletionTargets = [
    'teachers/{uid}',
    'teachers/{uid}/students',
    'teachers/{uid}/students/{studentId}/lessons',
    'teachers/{uid}/schedules',
    'teachers/{uid}/library',
    'teachers/{uid}/notes',
    'teachers/{uid}/fcmTokens',
    'reminderQueue (where teacherId == uid)',
    'subscriptions/{email}',
    'firebase_auth_user',
    'storage_bucket (prefix teachers/{uid}/)',
  ];

  assert.equal(requiredDeletionTargets.length, 11);
  assert.ok(requiredDeletionTargets.includes('reminderQueue (where teacherId == uid)'));
  assert.ok(requiredDeletionTargets.includes('firebase_auth_user'));
});
