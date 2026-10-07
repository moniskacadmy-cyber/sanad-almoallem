import { test } from 'node:test';
import assert from 'node:assert/strict';
import { alertsService } from '../src/server/alertsService.js';
import { sentryServer } from '../src/server/sentryServer.js';
import app from '../server.js';

test('Alerts: reminder delay > 120s triggers critical alert', () => {
  alertsService.clearForTest();

  const scheduledTime = Date.now() - 150_000; // 150 seconds ago (delay = 150s > 120s)
  const isAlerted = alertsService.checkReminderDelayAlert(scheduledTime, Date.now(), {
    teacherId: 'teacher_delay_test',
    shard: 2,
  });

  assert.equal(isAlerted, true);
  const alerts = alertsService.getAlerts();
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].type, 'REMINDER_DELAY');
  assert.equal(alerts[0].severity, 'critical');
  assert.ok(alerts[0].details.delaySeconds >= 150);

  // Normal lag <= 120s does not trigger alert
  const normalScheduled = Date.now() - 30_000; // 30 seconds ago
  const isNormalAlerted = alertsService.checkReminderDelayAlert(normalScheduled, Date.now());
  assert.equal(isNormalAlerted, false);
  assert.equal(alertsService.getAlerts().length, 1);
});

test('Alerts: 5xx error rate > 5% triggers critical alert', () => {
  alertsService.clearForTest();

  // 15 successful requests (200)
  for (let i = 0; i < 15; i++) {
    alertsService.recordHttpMetric(200);
  }

  // 2 server errors (500) -> 2 / 17 = 11.7% > 5%
  alertsService.recordHttpMetric(500);
  const triggered = alertsService.recordHttpMetric(500);

  assert.equal(triggered, true);
  const alerts = alertsService.getAlerts();
  const alert5xx = alerts.find((a) => a.type === 'HIGH_5XX_RATE');
  assert.ok(alert5xx);
  assert.equal(alert5xx.severity, 'critical');
});

test('Alerts: Gemini AI budget exceeded triggers financial alert', () => {
  alertsService.clearForTest();

  const triggered = alertsService.checkGeminiBudgetAlert(5.50, 5.00, {
    teacherId: 'teacher_heavy_ai',
  });

  assert.equal(triggered, true);
  const alerts = alertsService.getAlerts();
  const budgetAlert = alerts.find((a) => a.type === 'GEMINI_BUDGET_EXCEEDED');
  assert.ok(budgetAlert);
  assert.equal(budgetAlert.severity, 'critical');
  assert.equal(budgetAlert.details.currentCost, 5.50);
});

test('Alerts: Payment webhook failure records security alert', () => {
  alertsService.clearForTest();

  const alert = alertsService.recordPaymentWebhookFailure('HMAC signature mismatch', {
    signature: 'bad_signature_header_val',
  });

  assert.equal(alert.type, 'PAYMENT_WEBHOOK_FAILURE');
  assert.equal(alert.severity, 'critical');
  assert.equal(alertsService.getAlerts().length, 1);
});

test('Uptime Monitor: /health responds with 200 and metrics', async () => {
  let responseStatus = 0;
  let responseJson: any = null;

  await new Promise<void>((resolve) => {
    const req: any = {
      method: 'GET',
      url: '/health',
      headers: {},
    };

    const res: any = {
      headersSent: false,
      setHeader() { return this; },
      status(s: number) { responseStatus = s; return this; },
      json(data: any) { responseJson = data; resolve(); return this; },
      end() { resolve(); return this; },
    };

    app(req, res, () => resolve());
  });

  assert.equal(responseStatus, 200);
  assert.equal(responseJson.ok, true);
  assert.equal(responseJson.status, 'healthy');
  assert.ok(typeof responseJson.uptime === 'number');
});
