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
  assert.match(values.get('Content-Security-Policy') || '', /script-src 'self'/);
});

test('API responses are not cacheable', () => {
  const headers = getHeaders('/api/(.*)');
  const values = new Map(headers.map((header) => [header.key, header.value]));

  assert.equal(values.get('Cache-Control'), 'no-store');
});
