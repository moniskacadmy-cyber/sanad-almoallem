/**
 * Production Alerts & Monitoring Service
 * 
 * Monitors critical platform metrics:
 * 1. Reminder delay > 120s
 * 2. 5xx Error rate (> 5% in rolling window)
 * 3. Gemini budget exceeded
 * 4. Payment webhook failure
 */

import { sentryServer } from './sentryServer.js';

export interface AlertEvent {
  type: 'REMINDER_DELAY' | 'HIGH_5XX_RATE' | 'GEMINI_BUDGET_EXCEEDED' | 'PAYMENT_WEBHOOK_FAILURE';
  severity: 'warning' | 'critical';
  message: string;
  details: Record<string, any>;
  timestamp: string;
}

const REMINDER_DELAY_THRESHOLD_SECONDS = 120;
const MAX_5XX_RATE_THRESHOLD = 0.05; // 5%
const MIN_REQUESTS_FOR_5XX_CHECK = 10;
const ROLLING_METRIC_WINDOW_SIZE = 200;

class AlertsService {
  private alertsHistory: AlertEvent[] = [];
  private requestStatuses: number[] = [];

  /**
   * 1. Alert: Reminder dispatch delay > 120 seconds
   */
  public checkReminderDelayAlert(
    scheduledTimeMs: number,
    actualDispatchTimeMs: number = Date.now(),
    metadata: Record<string, any> = {}
  ): boolean {
    const delaySeconds = Math.max(0, Math.round((actualDispatchTimeMs - scheduledTimeMs) / 1000));
    if (delaySeconds > REMINDER_DELAY_THRESHOLD_SECONDS) {
      const alert: AlertEvent = {
        type: 'REMINDER_DELAY',
        severity: 'critical',
        message: `تنبيه حرج: تأخر إرسال التذكير بمقدار ${delaySeconds} ثانية (> الحد الأقصى 120 ثانية)!`,
        details: { delaySeconds, scheduledTimeMs, actualDispatchTimeMs, ...metadata },
        timestamp: new Date().toISOString(),
      };
      this.recordAlert(alert);
      sentryServer.captureMessage(alert.message, 'error', alert.details);
      return true;
    }
    return false;
  }

  /**
   * 2. Alert: 5xx HTTP error rate tracking & threshold trigger
   */
  public recordHttpMetric(statusCode: number): boolean {
    this.requestStatuses.push(statusCode);
    if (this.requestStatuses.length > ROLLING_METRIC_WINDOW_SIZE) {
      this.requestStatuses.shift();
    }

    if (this.requestStatuses.length >= MIN_REQUESTS_FOR_5XX_CHECK) {
      const errorCount = this.requestStatuses.filter((s) => s >= 500 && s < 600).length;
      const errorRate = errorCount / this.requestStatuses.length;

      if (errorRate >= MAX_5XX_RATE_THRESHOLD) {
        const percentage = (errorRate * 100).toFixed(1);
        const alert: AlertEvent = {
          type: 'HIGH_5XX_RATE',
          severity: 'critical',
          message: `تنبيه حرج: ارتفاع نسبة أخطاء السيرفر 5xx إلى ${percentage}% في النافذة الأخيرة!`,
          details: { errorRate, errorCount, sampleSize: this.requestStatuses.length },
          timestamp: new Date().toISOString(),
        };
        this.recordAlert(alert);
        sentryServer.captureMessage(alert.message, 'error', alert.details);
        return true;
      }
    }
    return false;
  }

  public get5xxErrorRate(): { errorRate: number; totalRequests: number; errorCount: number } {
    const totalRequests = this.requestStatuses.length;
    if (totalRequests === 0) return { errorRate: 0, totalRequests: 0, errorCount: 0 };
    const errorCount = this.requestStatuses.filter((s) => s >= 500 && s < 600).length;
    return {
      errorRate: errorCount / totalRequests,
      totalRequests,
      errorCount,
    };
  }

  /**
   * 3. Alert: Gemini budget exceeded
   */
  public checkGeminiBudgetAlert(
    currentCost: number,
    budgetLimit: number,
    context: Record<string, any> = {}
  ): boolean {
    if (currentCost >= budgetLimit) {
      const alert: AlertEvent = {
        type: 'GEMINI_BUDGET_EXCEEDED',
        severity: 'critical',
        message: `تنبيه مالي: تجاوز استهلاك Gemini AI الحد المالي المسموح ($${currentCost.toFixed(4)} >= $${budgetLimit.toFixed(4)})!`,
        details: { currentCost, budgetLimit, ...context },
        timestamp: new Date().toISOString(),
      };
      this.recordAlert(alert);
      sentryServer.captureMessage(alert.message, 'error', alert.details);
      return true;
    }
    return false;
  }

  /**
   * 4. Alert: Payment webhook failure
   */
  public recordPaymentWebhookFailure(
    reason: string,
    details: Record<string, any> = {},
    error?: unknown
  ): AlertEvent {
    const alert: AlertEvent = {
      type: 'PAYMENT_WEBHOOK_FAILURE',
      severity: 'critical',
      message: `تنبيه أمان ومدفوعات: فشل معالجة Webhook الدفع (${reason})!`,
      details: { reason, ...details },
      timestamp: new Date().toISOString(),
    };
    this.recordAlert(alert);
    if (error) {
      sentryServer.captureException(error, alert.details);
    } else {
      sentryServer.captureMessage(alert.message, 'error', alert.details);
    }
    return alert;
  }

  private recordAlert(alert: AlertEvent) {
    this.alertsHistory.push(alert);
    if (this.alertsHistory.length > 100) {
      this.alertsHistory.shift();
    }
  }

  public getAlerts(): AlertEvent[] {
    return [...this.alertsHistory];
  }

  public clearForTest() {
    this.alertsHistory = [];
    this.requestStatuses = [];
  }
}

export const alertsService = new AlertsService();
