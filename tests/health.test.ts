import { test } from 'node:test';
import assert from 'node:assert/strict';
import app from '../server.js';

test('health check endpoint: returns simple ok state without dependencies', async () => {
  let responseStatus = 0;
  let responseJson: any = null;

  await new Promise<void>((resolve) => {
    const req: any = {
      method: 'GET',
      url: '/api/health',
      headers: {},
    };

    const res: any = {
      headersSent: false,
      setHeader() {
        return this;
      },
      status(s: number) {
        responseStatus = s;
        return this;
      },
      json(data: any) {
        responseJson = data;
        this.headersSent = true;
        resolve();
        return this;
      },
    };

    app(req, res, () => resolve());
  });

  assert.equal(responseStatus, 200);
  assert.ok(typeof responseJson === 'object');
  assert.equal(responseJson.ok, true);
  assert.equal('firebase' in responseJson, false);
});

test('deep health check endpoint: rejects unauthorized requests', async () => {
  let responseStatus = 0;
  let responseJson: any = null;

  await new Promise<void>((resolve) => {
    const req: any = {
      method: 'GET',
      url: '/api/health/deep',
      headers: {},
    };

    const res: any = {
      headersSent: false,
      setHeader() {
        return this;
      },
      status(s: number) {
        responseStatus = s;
        return this;
      },
      json(data: any) {
        responseJson = data;
        this.headersSent = true;
        resolve();
        return this;
      },
    };

    app(req, res, () => resolve());
  });

  assert.equal(responseStatus, 401);
  assert.ok(responseJson.error.includes('غير مصرح'));
});

test('deep health check endpoint: accepts requests authorized with CRON_SECRET', async () => {
  // Mock CRON_SECRET env variable
  const originalSecret = process.env.CRON_SECRET;
  process.env.CRON_SECRET = 'deep_health_cron_secret_abc123';

  let responseStatus = 0;
  let responseJson: any = null;

  await new Promise<void>((resolve) => {
    const req: any = {
      method: 'GET',
      url: '/api/health/deep',
      headers: {
        authorization: 'Bearer deep_health_cron_secret_abc123',
      },
    };

    const res: any = {
      headersSent: false,
      setHeader() {
        return this;
      },
      status(s: number) {
        responseStatus = s;
        return this;
      },
      json(data: any) {
        responseJson = data;
        this.headersSent = true;
        resolve();
        return this;
      },
    };

    app(req, res, () => resolve());
  });

  process.env.CRON_SECRET = originalSecret;

  assert.ok(responseStatus === 200 || responseStatus === 503);
  assert.ok(typeof responseJson === 'object');
  assert.ok('ok' in responseJson);
  assert.ok('firebase' in responseJson);
  assert.ok('redis' in responseJson);
  assert.ok('geminiConfigured' in responseJson);

  // Verify no secrets or sensitive keys are exposed
  const str = JSON.stringify(responseJson);
  assert.equal(str.includes('AIza'), false);
  assert.equal(str.includes('Bearer'), false);
});
