import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePageRanges } from '../src/services/pageRanges.js';

test('parses ranges, singles and arabic digits', () => {
  assert.deepEqual(parsePageRanges('1-3, 5', 10), [0, 1, 2, 4]);
  assert.deepEqual(parsePageRanges('٢،٤-٥', 10), [1, 3, 4]);
  assert.deepEqual(parsePageRanges('3,3,1', 5), [0, 2]);
});

test('rejects bad input', () => {
  assert.throws(() => parsePageRanges('', 5));
  assert.throws(() => parsePageRanges('0', 5));
  assert.throws(() => parsePageRanges('6', 5));
  assert.throws(() => parsePageRanges('4-2', 5));
  assert.throws(() => parsePageRanges('a-b', 5));
});
