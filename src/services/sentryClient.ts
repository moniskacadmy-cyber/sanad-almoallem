/**
 * Client-Side Sentry Integration
 * Captures React errors, unhandled rejections, and window errors.
 */

interface SentryClientOptions {
  dsn?: string;
  environment?: string;
  release?: string;
}

class ClientSentry {
  private dsn: string | null = null;
  private isInitialized = false;
  private breadcrumbs: Array<{ message: string; timestamp: number; category?: string }> = [];

  public init(options: SentryClientOptions = {}) {
    const rawDsn = options.dsn || (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SENTRY_DSN);
    if (rawDsn) {
      this.dsn = rawDsn;
      this.isInitialized = true;
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('error', (event) => {
        this.captureError(event.error || new Error(event.message), { source: 'window.onerror' });
      });

      window.addEventListener('unhandledrejection', (event) => {
        this.captureError(event.reason || new Error('Unhandled Promise Rejection'), { source: 'unhandledrejection' });
      });
    }
  }

  public addBreadcrumb(message: string, category = 'ui') {
    this.breadcrumbs.push({ message, timestamp: Date.now(), category });
    if (this.breadcrumbs.length > 50) {
      this.breadcrumbs.shift();
    }
  }

  public captureError(error: unknown, context: Record<string, any> = {}) {
    const errorDetails = {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      breadcrumbs: [...this.breadcrumbs],
      context,
      url: typeof window !== 'undefined' ? window.location.href : '',
      timestamp: new Date().toISOString(),
    };

    // Log in non-production or send to Sentry when DSN configured
    if (this.isInitialized && this.dsn) {
      try {
        // If official Sentry SDK is loaded on window
        if ((window as any).Sentry?.captureException) {
          (window as any).Sentry.captureException(error, { extra: errorDetails });
        }
      } catch (_) {}
    }

    return errorDetails;
  }
}

export const sentryClient = new ClientSentry();
export const captureClientError = (err: unknown, ctx?: Record<string, any>) => sentryClient.captureError(err, ctx);
