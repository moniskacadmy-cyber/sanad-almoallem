import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPrintHtml } from '../src/utils/printHtml.js';
import { safeEqual } from '../src/server/secureCompare.js';

test('print html escapes title, subject, teacher and content', () => {
  const evil = '<img src=x onerror="alert(1)">';
  const html = buildPrintHtml({ title: evil, content: evil, subject: evil, teacherName: evil, dateStr: evil });
  assert.ok(!html.includes('<img'), 'no raw tag may survive');
  assert.ok(html.includes('&lt;img'));
});

test('safeEqual', () => {
  assert.equal(safeEqual('abc', 'abc'), true);
  assert.equal(safeEqual('abc', 'abd'), false);
  assert.equal(safeEqual('abc', 'abcd'), false);
});
