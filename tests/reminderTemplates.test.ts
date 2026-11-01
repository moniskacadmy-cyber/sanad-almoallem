import test from 'node:test';
import assert from 'node:assert/strict';
import { templatize, fillTemplate, swapWord, studentWord, teacherWord } from '../src/services/reminderTemplates.js';

const vars = { studentName: 'أحمد علي', subject: 'رياضيات', amount: '300', teacherName: 'منى' };

test('templatize + fill refreshes dynamic values', () => {
  const text = 'ولي أمر أحمد علي، مادة رياضيات، المستحق 300 جنيه. أستاذ منى';
  const t = templatize(text, vars);
  assert.equal(t, 'ولي أمر {{studentName}}، مادة {{subject}}، المستحق {{amount}} جنيه. أستاذ {{teacherName}}');
  assert.match(fillTemplate(t, { ...vars, studentName: 'سارة' }), /سارة/);
  assert.match(fillTemplate(t, { ...vars, amount: '450' }), /450 جنيه/);
});

test('numbers are not replaced inside longer numbers', () => {
  assert.equal(templatize('رقم 1300 و 300', { amount: '300' }), 'رقم 1300 و {{amount}}');
});

test('unknown tokens are kept', () => {
  assert.equal(fillTemplate('{{x}} {{studentName}}', { studentName: 'a' }), '{{x}} a');
});

test('gender swap works on whole words only', () => {
  assert.equal(swapWord('ولي أمر الطالب/ة: س', 'الطالب/ة', 'الطالبة'), 'ولي أمر الطالبة: س');
  assert.equal(swapWord('الطالب والطالبة', 'الطالب', 'الطالبة'), 'الطالبة والطالبة');
  assert.equal(swapWord('مع تحيات: أستاذ منى', teacherWord(undefined), teacherWord('female')), 'مع تحيات: أستاذة منى');
  assert.equal(studentWord('male'), 'الطالب');
});
