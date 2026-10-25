import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanUndefined, removeUndefined } from '../src/firebase.ts';

test('cleanUndefined: preserves primitives and null', () => {
  assert.equal(cleanUndefined(undefined), undefined);
  assert.equal(cleanUndefined(null), null);
  assert.equal(cleanUndefined(123), 123);
  assert.equal(cleanUndefined('hello'), 'hello');
  assert.equal(cleanUndefined(true), true);
  assert.equal(cleanUndefined(false), false);
  assert.equal(cleanUndefined(0), 0);
});

test('cleanUndefined: removes undefined keys from simple objects', () => {
  const input = {
    name: 'Ahmed',
    notes: undefined,
    phone: '01012345678',
    parentPhone: undefined,
    hourlyRate: 150,
  };
  const expected = {
    name: 'Ahmed',
    phone: '01012345678',
    hourlyRate: 150,
  };
  assert.deepEqual(cleanUndefined(input), expected);
  assert.equal('notes' in cleanUndefined(input), false);
  assert.equal('parentPhone' in cleanUndefined(input), false);
});

test('cleanUndefined: preserves null values and empty strings', () => {
  const input = {
    notes: '',
    groupId: null,
    discount: 0,
    paidAt: null,
    extra: undefined,
  };
  const expected = {
    notes: '',
    groupId: null,
    discount: 0,
    paidAt: null,
  };
  assert.deepEqual(cleanUndefined(input), expected);
  assert.equal(cleanUndefined(input).notes, '');
  assert.equal(cleanUndefined(input).groupId, null);
  assert.equal(cleanUndefined(input).paidAt, null);
});

test('cleanUndefined: recursively removes undefined keys in nested objects', () => {
  const input = {
    student: {
      name: 'Sara',
      address: {
        city: 'Cairo',
        street: undefined,
      },
      academic: {
        grade: undefined,
        level: 'Secondary',
      },
    },
    meta: undefined,
  };
  const expected = {
    student: {
      name: 'Sara',
      address: {
        city: 'Cairo',
      },
      academic: {
        level: 'Secondary',
      },
    },
  };
  assert.deepEqual(cleanUndefined(input), expected);
});

test('cleanUndefined: handles arrays and cleans elements inside arrays', () => {
  const input = [
    'first',
    undefined,
    { id: '1', note: undefined, amount: 200 },
    null,
    [1, undefined, 3],
  ];
  const result = cleanUndefined(input);
  assert.deepEqual(result, [
    'first',
    { id: '1', amount: 200 },
    null,
    [1, 3],
  ]);
});

test('cleanUndefined: preserves Date instances', () => {
  const now = new Date();
  const input = {
    timestamp: now,
    other: undefined,
  };
  const result = cleanUndefined(input);
  assert.equal(result.timestamp, now);
  assert.equal(result.timestamp instanceof Date, true);
  assert.equal('other' in result, false);
});

test('cleanUndefined: preserves Firestore Timestamp-like and FieldValue objects', () => {
  const mockTimestamp = {
    toMillis: () => 1700000000000,
    toDate: () => new Date(1700000000000),
    isEqual: () => true,
    seconds: 1700000000,
    nanoseconds: 0,
  };
  const mockFieldValue = {
    _methodName: 'serverTimestamp',
    isEqual: () => true,
  };
  const input = {
    createdAt: mockFieldValue,
    customDate: mockTimestamp,
    unused: undefined,
  };
  const result = cleanUndefined(input);
  assert.equal(result.createdAt, mockFieldValue);
  assert.equal(result.customDate, mockTimestamp);
  assert.equal('unused' in result, false);
});

test('removeUndefined: alias works identically to cleanUndefined', () => {
  assert.equal(removeUndefined, cleanUndefined);
  const data = { a: 1, b: undefined };
  assert.deepEqual(removeUndefined(data), { a: 1 });
});
