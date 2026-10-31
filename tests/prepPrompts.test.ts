import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPrepPrompt, parsePrepInput, parseQuizJson } from '../src/server/prepPrompts.js';

test('input validation', () => {
  assert.equal(parsePrepInput({ mode: 'nope', topic: 'x' }).ok, false);
  assert.equal(parsePrepInput({ mode: 'handout_review' }).ok, false);
  assert.equal(parsePrepInput({ mode: 'formatter', topic: 'x', text: 'قصير' }).ok, false);
  assert.equal(parsePrepInput({ mode: 'handout_review', topic: 'x'.repeat(5), text: 'a'.repeat(13000) }).ok, false);
  const r = parsePrepInput({ mode: 'exam_paper', topic: 'الجمع', count: 999, difficulty: 'bad' });
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.value.count, 30);
    assert.equal(r.value.difficulty, 'medium');
  }
});

test('prompt includes topic, subject and the source text', () => {
  const r = parsePrepInput({ mode: 'lesson_studio', topic: 'الكسور', text: 'نص الدرس عن الكسور العادية والعشرية' });
  assert.ok(r.ok);
  if (r.ok) {
    const p = buildPrepPrompt(r.value, 'الرياضيات');
    assert.match(p, /الكسور/);
    assert.match(p, /الرياضيات/);
    assert.match(p, /نص الدرس عن الكسور/);
  }
});

test('quiz json: tolerant to wrapping, strict on content', () => {
  const raw = 'هنا الأسئلة:\n```json\n[{"q":"2+2؟","options":["3","4"],"answer":1,"explain":"جمع"},{"q":"bad","options":["x"],"answer":5}]\n```';
  const q = parseQuizJson(raw);
  assert.equal(q.length, 1);
  assert.equal(q[0].answer, 1);
  assert.throws(() => parseQuizJson('لا يوجد'));
});
