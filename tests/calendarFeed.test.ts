import test from 'node:test';
import assert from 'node:assert/strict';
import { buildIcs, escapeIcsText, foldLine, generateFeedToken, hashFeedToken, isPlausibleFeedToken, nextDateForDay, parseHHMM } from '../src/server/calendarFeed.js';

test('tokens are long, url-safe and hashed', () => {
  const t = generateFeedToken();
  assert.ok(isPlausibleFeedToken(t));
  assert.notEqual(hashFeedToken(t), t);
  assert.equal(hashFeedToken(t), hashFeedToken(` ${t} `));
  assert.equal(isPlausibleFeedToken('short'), false);
  assert.equal(isPlausibleFeedToken('../../etc/passwd'), false);
});

test('escape and fold', () => {
  assert.equal(escapeIcsText('a,b;c\nd'), 'a\\,b\;c\\nd');
  const folded = foldLine('X:' + 'ا'.repeat(100));
  for (const l of folded.split('\r\n')) assert.ok(new TextEncoder().encode(l).length <= 75);
  assert.equal(folded.replace(/\r\n /g, ''), 'X:' + 'ا'.repeat(100));
});

test('parse time and next date', () => {
  assert.deepEqual(parseHHMM('09:05'), { h: 9, m: 5 });
  assert.equal(parseHHMM('25:00'), null);
  // 2026-11-07 is Saturday(6); next Sunday(0) = 2026-11-08, same day stays
  assert.deepEqual(nextDateForDay({ y: 2026, mo: 11, d: 7, dow: 6 }, 0), { y: 2026, mo: 11, d: 8 });
  assert.deepEqual(nextDateForDay({ y: 2026, mo: 11, d: 7, dow: 6 }, 6), { y: 2026, mo: 11, d: 7 });
});

test('buildIcs makes weekly events with alarms and skips bad slots', () => {
  const ics = buildIcs({
    calendarName: 'حصص أ. منى',
    timeZone: 'Africa/Cairo',
    now: new Date('2026-11-07T08:00:00Z'),
    slots: [
      { id: 'a1', title: 'حصة: أحمد', dayOfWeek: 0, time: '16:30', duration: 60, recurrence: 'weekly' },
      { id: 'a2', title: 'حصة متأخرة', dayOfWeek: 2, time: '23:30', duration: 90, recurrence: 'once' },
      { id: 'bad', title: 'x', dayOfWeek: 1, time: 'nope', duration: 60 },
    ],
  });
  assert.match(ics, /BEGIN:VCALENDAR/);
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 2);
  assert.match(ics, /DTSTART;TZID=Africa\/Cairo:20261108T163000/);
  assert.match(ics, /RRULE:FREQ=WEEKLY/);
  assert.equal((ics.match(/RRULE/g) || []).length, 1); // 'once' has none
  assert.match(ics, /DTEND;TZID=Africa\/Cairo:20261111T010000/); // rolls past midnight
  assert.match(ics, /TRIGGER:-PT15M/);
  assert.ok(ics.endsWith('\r\n'));
});
