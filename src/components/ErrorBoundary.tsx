import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Trash2, MessageCircle, ShieldAlert } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by Global ErrorBoundary:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleClearCacheAndReload = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
      if ('caches' in window) {
        caches.keys().then((names) => {
          for (const name of names) {
            caches.delete(name);
          }
        });
      }
    } catch (e) {
      console.warn('Failed to clear client storage:', e);
    }
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div
          className="min-h-screen bg-[#070314] text-slate-100 flex flex-col items-center justify-center p-4 dir-rtl"
          dir="rtl"
        >
          <div className="w-full max-w-md bg-gradient-to-b from-slate-900 to-slate-950 border border-purple-500/30 rounded-3xl p-6 shadow-2xl relative text-right space-y-5">
            {/* Header Icon */}
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center shadow-lg mb-3 animate-pulse">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <h2 className="text-lg font-black text-white">حدث خطأ غير متوقع في التطبيق</h2>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                نعتذر عن هذا الخلل الموقت. تم حماية بياناتك وتوقف الواجهة لتجنب أي فقدان للبيانات.
              </p>
            </div>

            {/* Error Message Details (Collapsed or sanitized) */}
            {this.state.error && (
              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3 text-[11px] font-mono text-rose-300 overflow-x-auto dir-ltr text-left max-h-28 overflow-y-auto">
                <p className="font-bold">{this.state.error.toString()}</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="w-full py-3 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs transition shadow-lg shadow-purple-950/50 flex items-center justify-center gap-2 cursor-pointer active:scale-98"
              >
                <RefreshCw className="w-4 h-4 text-amber-300" />
                <span>إعادة تحميل التطبيق (Reload)</span>
              </button>

              <button
                type="button"
                onClick={this.handleClearCacheAndReload}
                className="w-full py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 hover:border-purple-500/40 font-bold text-xs transition flex items-center justify-center gap-2 cursor-pointer active:scale-98"
              >
                <Trash2 className="w-4 h-4 text-rose-400" />
                <span>إعادة تعيين المؤقت والإنعاش (Clear Storage)</span>
              </button>

              <a
                href={`https://wa.me/201025967471?text=${encodeURIComponent(
                  `مرحباً، واجهت خطأ في تطبيق سند المعلم:\n${this.state.error?.message || 'Uncaught error'}`
                )}`}
                target="_blank"
                rel="noreferrer"
                className="w-full py-3 rounded-2xl bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-500/40 text-emerald-300 font-bold text-xs transition flex items-center justify-center gap-2 shadow"
              >
                <MessageCircle className="w-4 h-4" />
                <span>التواصل مع الدعم الفني عبر واتساب</span>
              </a>
            </div>

            <div className="text-center pt-2 border-t border-slate-800/80">
              <p className="text-[10px] text-slate-400 flex items-center justify-center gap-1">
                <ShieldAlert className="w-3 h-3 text-purple-400" />
                <span>سند المعلم • نظام الحماية التلقائي من الأخطاء</span>
              </p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
