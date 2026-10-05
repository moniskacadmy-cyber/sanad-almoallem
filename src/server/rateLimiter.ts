export type RedisCounterResult = { limited: boolean; unavailable: boolean };

type CounterOptions = {
  fetchImpl?: typeof fetch;
  now?: () => number;
  isVercel?: boolean;
};

const memoryCounters = new Map<string, number[]>();

export async function incrementRedisCounter(
  key: string,
  windowSeconds: number,
  maxRequests: number,
  options: CounterOptions = {},
): Promise<RedisCounterResult> {
  const fetchImpl = options.fetchImpl || fetch;
  const now = options.now || Date.now;
  const isVercel = options.isVercel ?? Boolean(process.env.VERCEL);
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();

  if (!url || !token) {
    return fallbackMemoryCounter(key, windowSeconds, maxRequests, now, true, isVercel);
  }

  const windowId = Math.floor(now() / 1000 / windowSeconds);
  const windowedKey = `${key}:${windowId}`;

  try {
    const response = await fetchImpl(`${url.replace(/\/$/, '')}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([
        ['INCR', windowedKey],
        ['EXPIRE', windowedKey, windowSeconds],
      ]),
    });

    if (!response.ok) {
      return fallbackMemoryCounter(key, windowSeconds, maxRequests, now, true, isVercel);
    }

    const data = await response.json();
    const count = Number(data?.[0]?.result);
    if (!Number.isFinite(count)) {
      return fallbackMemoryCounter(key, windowSeconds, maxRequests, now, true, isVercel);
    }

    return { limited: count > maxRequests, unavailable: false };
  } catch (error) {
    console.warn('Upstash Redis limiter unavailable:', error instanceof Error ? error.message : 'unknown');
    return fallbackMemoryCounter(key, windowSeconds, maxRequests, now, true, isVercel);
  }
}

function fallbackMemoryCounter(
  key: string,
  windowSeconds: number,
  maxRequests: number,
  now: () => number,
  unavailable: boolean,
  isVercel: boolean,
): RedisCounterResult {
  if (isVercel) return { limited: false, unavailable };

  const timestamp = now();
  const cutoff = timestamp - windowSeconds * 1000;
  const recent = (memoryCounters.get(key) || []).filter((value) => value > cutoff);
  const limited = recent.length >= maxRequests;
  if (!limited) recent.push(timestamp);
  memoryCounters.set(key, recent);
  return { limited, unavailable };
}

export function clearRateLimiterMemoryForTests() {
  memoryCounters.clear();
}
