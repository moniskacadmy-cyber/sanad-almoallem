import { test } from 'node:test';
import assert from 'node:assert/strict';
import { incrementRedisCounter } from '../src/server/rateLimiter.js';

test('Redis counter uses a fixed time window and resets after the window', async () => {
  let now = 1_000;
  const calls: string[] = [];
  const fakeFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push(String(init?.body || ''));
    return new Response(JSON.stringify([{ result: 1 }, { result: 1 }]), { status: 200 });
  };

  const first = await incrementRedisCounter('ai:test:user', 60, 1, {
    fetchImpl: fakeFetch,
    now: () => now,
  });
  const firstBody = calls[0];
  now = 61_000;
  const second = await incrementRedisCounter('ai:test:user', 60, 1, {
    fetchImpl: fakeFetch,
    now: () => now,
  });

  assert.equal(first.limited, false);
  assert.equal(second.limited, false);
  assert.notEqual(firstBody, calls[1], 'windowed keys must change after the window expires');
  assert.match(calls[0], /ai:test:user:16/);
  assert.match(calls[1], /ai:test:user:1016/);
});

test('Redis failure falls back to memory outside Vercel and resets after the window', async () => {
  let now = 0;
  const failFetch = async () => { throw new Error('redis down'); };
  const options = { fetchImpl: failFetch, now: () => now, isVercel: false };

  const first = await incrementRedisCounter('memory:test:user', 60, 1, options);
  const second = await incrementRedisCounter('memory:test:user', 60, 1, options);
  const third = await incrementRedisCounter('memory:test:user', 60, 1, options);
  now = 61_000;
  const afterWindow = await incrementRedisCounter('memory:test:user', 60, 1, options);

  assert.equal(first.limited, false);
  assert.equal(second.limited, false);
  assert.equal(third.limited, true);
  assert.equal(afterWindow.limited, false);
  assert.equal(afterWindow.unavailable, true);
});
