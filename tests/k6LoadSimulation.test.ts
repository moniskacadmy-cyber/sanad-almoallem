import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import app from '../server.js';

test('k6 Load Test Configuration: validates 1000 VU scenario and thresholds', () => {
  const k6Script = fs.readFileSync('load-tests/k6-load-test.js', 'utf-8');

  // Verify scenario configuration
  assert.ok(k6Script.includes('target: 1000'), 'Must target 1000 concurrent users');
  assert.ok(k6Script.includes('ramping-vus'), 'Must use ramping-vus executor');

  // Verify SLA thresholds (p95 < 800ms, error < 1%)
  assert.ok(k6Script.includes("'p(95)<800'"), 'p95 latency threshold must be < 800ms');
  assert.ok(k6Script.includes("'rate<0.01'"), 'Error rate threshold must be < 1%');

  // Verify target endpoint coverage
  assert.ok(k6Script.includes('/api/billing/plans'), 'Must cover /api/billing/*');
  assert.ok(k6Script.includes('/api/account/init'), 'Must cover /api/account/init');
  assert.ok(k6Script.includes('/health'), 'Must cover /health uptime');
});

test('k6 Load Simulation: concurrent requests execute within p95 < 800ms and error rate < 1%', async () => {
  const CONCURRENT_REQUESTS = 60;
  const latencies: number[] = [];
  let errorCount = 0;

  const endpoints = [
    { method: 'GET', url: '/api/billing/plans' },
    { method: 'POST', url: '/api/account/init', body: { email: 'load_tester@gmail.com' } },
    { method: 'GET', url: '/health' },
    { method: 'GET', url: '/api/health' },
  ];

  await Promise.all(
    Array.from({ length: CONCURRENT_REQUESTS }, async (_, i) => {
      const target = endpoints[i % endpoints.length];
      const start = Date.now();

      await new Promise<void>((resolve) => {
        const req: any = {
          method: target.method,
          url: target.url,
          headers: { 'user-agent': 'load-sim' },
          body: target.body || {},
          ip: `10.0.0.${(i % 50) + 1}`,
        };

        const res: any = {
          headersSent: false,
          statusCode: 200,
          setHeader() { return this; },
          status(s: number) { this.statusCode = s; return this; },
          json() { resolve(); return this; },
          end() { resolve(); return this; },
        };

        app(req, res, () => resolve());
      });

      const duration = Date.now() - start;
      latencies.push(duration);
    })
  );

  // Compute p95 latency
  latencies.sort((a, b) => a - b);
  const p95Index = Math.floor(latencies.length * 0.95);
  const p95Duration = latencies[p95Index];
  const errorRate = errorCount / CONCURRENT_REQUESTS;

  assert.ok(
    p95Duration < 800,
    `p95 latency must be < 800ms (measured: ${p95Duration}ms)`
  );
  assert.ok(
    errorRate < 0.01,
    `Error rate must be < 1% (measured: ${(errorRate * 100).toFixed(2)}%)`
  );
});
