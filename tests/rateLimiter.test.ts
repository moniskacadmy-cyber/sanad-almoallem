import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  incrementRedisCounter,
  checkAndIncrementMemoryAiBucket,
  aiRateLimiter,
  AI_LIMITS,
} from '../server.js';

test('rate limiter: incrementRedisCounter includes window index in key and sets expire', async () => {
  const originalFetch = globalThis.fetch;
  const originalUrl = process.env.UPSTASH_REDIS_REST_URL;
  const originalToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  process.env.UPSTASH_REDIS_REST_URL = 'https://fake-redis.upstash.io';
  process.env.UPSTASH_REDIS_REST_TOKEN = 'fake-token';

  let capturedBody: any = null;
  let simulatedCount = 1;

  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    capturedBody = JSON.parse(init?.body as string);
    return {
      ok: true,
      json: async () => [{ result: simulatedCount }, { result: 'OK' }],
    } as any;
  }) as any;

  try {
    const key = 'test:user123';
    const windowSeconds = 60;
    const maxRequests = 5;

    const res = await incrementRedisCounter(key, windowSeconds, maxRequests);
    assert.equal(res.limited, false);
    assert.equal(res.unavailable, false);

    assert.ok(Array.isArray(capturedBody));
    const [incrCommand, expireCommand] = capturedBody;
    assert.equal(incrCommand[0], 'INCR');
    assert.match(incrCommand[1], new RegExp(`^${key}:\\d+$`));
    assert.equal(expireCommand[0], 'EXPIRE');
    assert.equal(expireCommand[2], windowSeconds * 2);

    // Test exceeding limit
    simulatedCount = 6;
    const resExceeded = await incrementRedisCounter(key, windowSeconds, maxRequests);
    assert.equal(resExceeded.limited, true);
  } finally {
    globalThis.fetch = originalFetch;
    process.env.UPSTASH_REDIS_REST_URL = originalUrl;
    process.env.UPSTASH_REDIS_REST_TOKEN = originalToken;
  }
});

test('rate limiter: in-memory fallback respects limits and resets across windows', () => {
  const key = `test:mem:${Date.now()}`;
  const windowMs = 1000;
  const max = 3;

  assert.equal(checkAndIncrementMemoryAiBucket(key, windowMs, max), true); // 1
  assert.equal(checkAndIncrementMemoryAiBucket(key, windowMs, max), true); // 2
  assert.equal(checkAndIncrementMemoryAiBucket(key, windowMs, max), true); // 3
  assert.equal(checkAndIncrementMemoryAiBucket(key, windowMs, max), false); // 4 (exceeded)
});

test('rate limiter: aiRateLimiter rejects when minute limit is reached without consuming daily', async () => {
  const originalUrl = process.env.UPSTASH_REDIS_REST_URL;
  const originalToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  const originalFetch = globalThis.fetch;

  process.env.UPSTASH_REDIS_REST_URL = 'https://fake-redis.upstash.io';
  process.env.UPSTASH_REDIS_REST_TOKEN = 'fake-token';

  const redisPipelineCalls: any[] = [];
  globalThis.fetch = (async (_url: any, init: any) => {
    const body = JSON.parse(init.body);
    redisPipelineCalls.push(body);
    const key = body[0][1];
    // Simulate minute counter at 11 (over limit of 10 for 'ask')
    if (key.includes(':minute:')) {
      return { ok: true, json: async () => [{ result: 11 }] } as any;
    }
    return { ok: true, json: async () => [{ result: 1 }] } as any;
  }) as any;

  try {
    const req: any = { user: { uid: 'teacher-ratelimit-1' } };
    let responseStatus = 0;
    let responseJson: any = null;
    const res: any = {
      status(s: number) {
        responseStatus = s;
        return this;
      },
      json(data: any) {
        responseJson = data;
        return this;
      },
    };
    let nextCalled = false;

    await aiRateLimiter('ask', req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(responseStatus, 429);
    assert.match(responseJson.error, /الدقيقة/);

    // Ensure ONLY the minute counter was queried/incremented, and NOT day or total-day!
    assert.equal(redisPipelineCalls.length, 1);
    assert.match(redisPipelineCalls[0][0][1], /:minute:/);
  } finally {
    globalThis.fetch = originalFetch;
    process.env.UPSTASH_REDIS_REST_URL = originalUrl;
    process.env.UPSTASH_REDIS_REST_TOKEN = originalToken;
  }
});
