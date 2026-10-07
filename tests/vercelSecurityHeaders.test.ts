import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const configPath = path.resolve(process.cwd(), 'vercel.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8')) as {
  headers?: Array<{ source: string; headers: Array<{ key: string; value: string }> }>;
};

function getHeaders(source: string) {
  return config.headers?.find((entry) => entry.source === source)?.headers ?? [];
}

test('security headers are configured for all responses', () => {
  const headers = getHeaders('/(.*)');
  const values = new Map(headers.map((header) => [header.key, header.value]));

  assert.equal(values.get('X-Content-Type-Options'), 'nosniff');
  assert.equal(values.get('X-Frame-Options'), 'DENY');
  assert.equal(values.get('Referrer-Policy'), 'strict-origin-when-cross-origin');
  assert.equal(values.get('Strict-Transport-Security'), 'max-age=31536000; includeSubDomains');
  assert.equal(values.get('Cross-Origin-Opener-Policy'), 'same-origin-allow-popups');
  assert.equal(values.get('Permissions-Policy'), 'camera=(), microphone=(self), geolocation=(), interest-cohort=()');

  const csp = values.get('Content-Security-Policy') || '';
  assert.match(csp, /script-src 'self'/);
  assert.equal(csp.includes("script-src 'self' 'unsafe-inline'"), false);
  assert.equal(csp.includes('unpkg.com'), false);
  assert.equal(csp.includes('cdnjs.cloudflare.com'), false);
});

test('API responses are not cacheable', () => {
  const headers = getHeaders('/api/(.*)');
  const values = new Map(headers.map((header) => [header.key, header.value]));

  assert.equal(values.get('Cache-Control'), 'no-store');
});

test('Static assets and core app files have correct caching controls', () => {
  const assetsHeaders = getHeaders('/assets/(.*)');
  const assetsValues = new Map(assetsHeaders.map((header) => [header.key, header.value]));
  assert.equal(assetsValues.get('Cache-Control'), 'public, max-age=31536000, immutable');

  const indexHeaders = getHeaders('/index.html');
  const indexValues = new Map(indexHeaders.map((header) => [header.key, header.value]));
  assert.equal(indexValues.get('Cache-Control'), 'no-store');

  const swHeaders = getHeaders('/sw.js');
  const swValues = new Map(swHeaders.map((header) => [header.key, header.value]));
  assert.equal(swValues.get('Cache-Control'), 'no-store');

  const rswHeaders = getHeaders('/registerSW.js');
  const rswValues = new Map(rswHeaders.map((header) => [header.key, header.value]));
  assert.equal(rswValues.get('Cache-Control'), 'no-store');
});
