import { test } from 'node:test';
import assert from 'node:assert/strict';
import app from '../server.js';

test('health check endpoint: returns status and checks components without leaking secrets', async () => {
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
