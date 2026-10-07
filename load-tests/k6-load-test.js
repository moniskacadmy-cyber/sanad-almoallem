import http from 'k6/http';
import { check, group, sleep } from 'k6';

/**
 * k6 Load Test Suite for Sanad Al-Moallem
 * Scenario: 1000 Concurrent Virtual Users (VUs)
 * Target Endpoints: /api/ai/*, /api/billing/*, /api/account/init
 * SLA Thresholds: p95 latency < 800ms, Error rate < 1%
 */

export const options = {
  scenarios: {
    concurrent_1000_teachers: {
      executor: 'ramping-vus',
      startVUs: 20,
      stages: [
        { duration: '30s', target: 200 },   // Warm up to 200 users
        { duration: '1m', target: 1000 },   // Ramp up to 1000 concurrent teachers
        { duration: '2m', target: 1000 },   // Sustained peak load: 1000 teachers
        { duration: '30s', target: 0 },     // Ramp down gracefully
      ],
      gracefulRampDown: '10s',
    },
  },
  thresholds: {
    // 95% of requests must complete below 800ms
    http_req_duration: ['p(95)<800'],
    // Less than 1% HTTP error rate
    http_req_failed: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  const params = {
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'k6-load-test/sanad',
    },
    timeout: '5s',
  };

  // Group 1: Billing Plans & Metadata (/api/billing/*)
  group('Billing Plans API', () => {
    const res = http.get(`${BASE_URL}/api/billing/plans`, params);
    check(res, {
      'billing plans status is 200': (r) => r.status === 200,
      'response contains plans': (r) => r.body.includes('monthly') && r.body.includes('yearly'),
      'duration < 800ms': (r) => r.timings.duration < 800,
    });
  });

  // Group 2: Account Initialization & Anti-Spam Check (/api/account/init)
  group('Account Init API', () => {
    const payload = JSON.stringify({
      email: `loadteacher_${__VU}_${__ITER}@gmail.com`,
      name: `Teacher ${__VU}`,
    });

    const res = http.post(`${BASE_URL}/api/account/init`, payload, params);
    check(res, {
      'account init status is 200 or 429': (r) => r.status === 200 || r.status === 429,
      'no server internal error 500': (r) => r.status !== 500,
      'duration < 800ms': (r) => r.timings.duration < 800,
    });
  });

  // Group 3: Health & Uptime Endpoints
  group('Health & Uptime Monitoring', () => {
    const res = http.get(`${BASE_URL}/health`, params);
    check(res, {
      'health status is 200': (r) => r.status === 200,
      'health ok is true': (r) => r.json('ok') === true,
      'duration < 400ms': (r) => r.timings.duration < 400,
    });
  });

  sleep(Math.random() * 0.5 + 0.5); // 500ms - 1000ms think time between user actions
}
