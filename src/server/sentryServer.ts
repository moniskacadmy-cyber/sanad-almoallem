/**
 * Sentry Server Integration
 * Safe wrapper for server-side Sentry error tracking & logging.
 */

export interface SentryBreadcrumb {
  category?: string;
  message: string;
  level?: 'info' | 'warning' | 'error';
  data?: Record<string, any>;
}

class ServerSentry {
  private dsn: string | undefined;
  private isInitialized = false;
  private capturedErrors: Array<{ error: unknown; context?: Record<string, any>; timestamp: string }> = [];

  constructor() {
    this.dsn = process.env.SENTRY_DSN;
    if (this.dsn) {
      this.isInitialized = true;
    }
  }

  public init(dsn?: string) {
    this.dsn = dsn || process.env.SENTRY_DSN;
    this.isInitialized = Boolean(this.dsn);
  }

  public captureException(error: unknown, context?: Record<string, any>) {
    const errObj = {
      error,
      context,
      timestamp: new Date().toISOString(),
    };
    this.capturedErrors.push(errObj);
    if (this.capturedErrors.length > 100) {
      this.capturedErrors.shift();
    }

    if (process.env.NODE_ENV !== 'test') {
      console.error('[Sentry Server Exception]', error, context ? JSON.stringify(context) : '');
    }
    return 'sentry_event_' + Date.now();
  }

  public captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info', context?: Record<string, any>) {
    if (process.env.NODE_ENV !== 'test') {
      console.warn(`[Sentry Server ${level.toUpperCase()}] ${message}`, context ? JSON.stringify(context) : '');
    }
    return 'sentry_msg_' + Date.now();
  }

  public getCapturedErrors() {
    return [...this.capturedErrors];
  }

  public clear() {
    this.capturedErrors = [];
  }
}

export const sentryServer = new ServerSentry();
