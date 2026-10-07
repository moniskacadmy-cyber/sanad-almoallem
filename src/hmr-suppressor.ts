// Preamble initialization for React Fast Refresh
(window as any).$RefreshReg$ = (window as any).$RefreshReg$ || function() {};
(window as any).$RefreshSig$ = (window as any).$RefreshSig$ || function() { return function(type: any) { return type; }; };
(window as any).__vite_plugin_react_preamble_installed__ = true;

// Comply with environment constraint: "HMR: Disabled. Ignore WebSocket errors."
(function() {
  if (typeof window !== 'undefined' && window.WebSocket) {
    const OrigWebSocket = window.WebSocket;
    function isViteHmr(url: any, protocols: any) {
      if (protocols === 'vite-hmr' || protocols === 'vite-ping') return true;
      if (Array.isArray(protocols) && (protocols.includes('vite-hmr') || protocols.includes('vite-ping'))) return true;
      if (typeof url === 'string' && (url.includes('token=') || url.includes('/@vite/client') || url.includes('vite-hmr'))) return true;
      return false;
    }

    class MockWebSocket extends EventTarget {
      static readonly CONNECTING = 0;
      static readonly OPEN = 1;
      static readonly CLOSING = 2;
      static readonly CLOSED = 3;

      readonly CONNECTING = 0;
      readonly OPEN = 1;
      readonly CLOSING = 2;
      readonly CLOSED = 3;

      url: string;
      protocols: any;
      readyState: number;
      bufferedAmount: number;
      extensions: string;
      protocol: string;
      binaryType: string;

      private _onopen: any = null;
      private _onclose: any = null;
      private _onerror: any = null;
      private _onmessage: any = null;

      constructor(url: string, protocols: any) {
        super();
        this.url = url;
        this.protocols = protocols;
        this.readyState = 1; // OPEN
        this.bufferedAmount = 0;
        this.extensions = '';
        this.protocol = typeof protocols === 'string' ? protocols : 'vite-hmr';
        this.binaryType = 'blob';

        setTimeout(() => {
          if (this.readyState === 1) {
            const ev = new Event('open');
            this.dispatchEvent(ev);
            if (typeof this._onopen === 'function') {
              try { this._onopen(ev); } catch (e) {}
            }
          }
        }, 0);
      }

      get onopen() { return this._onopen; }
      set onopen(val) { this._onopen = val; }

      get onclose() { return this._onclose; }
      set onclose(val) { this._onclose = val; }

      get onerror() { return this._onerror; }
      set onerror(val) { this._onerror = val; }

      get onmessage() { return this._onmessage; }
      set onmessage(val) { this._onmessage = val; }

      send(data: any) {}

      close(code?: number, reason?: string) {
        if (this.readyState === 3) return;
        this.readyState = 3; // CLOSED
        const ev = new CloseEvent('close', {
          wasClean: true,
          code: code || 1000,
          reason: reason || ''
        });
        this.dispatchEvent(ev);
        if (typeof this._onclose === 'function') {
          try { this._onclose(ev); } catch (e) {}
        }
      }
    }

    try {
      const proxyWs = new Proxy(OrigWebSocket, {
        construct(target, args, newTarget) {
          const [url, protocols] = args;
          if (isViteHmr(url, protocols)) {
            return new MockWebSocket(url, protocols);
          }
          return Reflect.construct(target, args, newTarget);
        }
      });
      (proxyWs as any).CONNECTING = 0;
      (proxyWs as any).OPEN = 1;
      (proxyWs as any).CLOSING = 2;
      (proxyWs as any).CLOSED = 3;
      window.WebSocket = proxyWs;
    } catch (_) {}
  }

  function shouldSuppress(msg: any) {
    if (!msg) return false;
    const str = String(msg);
    return str.includes('[vite]') ||
           str.includes('WebSocket') ||
           str.includes('websocket') ||
           str.includes('SendBeforeConnectError') ||
           str.includes('preamble') ||
           str.includes('server connection lost') ||
           str.includes('connecting...') ||
           str.includes('Illegal invocation');
  }

  ['log', 'info', 'warn', 'error', 'debug'].forEach(function(method) {
    const orig = (console as any)[method];
    if (typeof orig === 'function') {
      (console as any)[method] = function(...args: any[]) {
        try {
          for (let i = 0; i < args.length; i++) {
            const arg = args[i];
            const str = typeof arg === 'object' && arg !== null
              ? (arg.message || arg.stack || JSON.stringify(arg))
              : String(arg);
            if (shouldSuppress(str)) return;
          }
        } catch (_) {}
        return Function.prototype.apply.call(orig, console, args);
      };
    }
  });

  window.onerror = function(msg, url, line, col, error) {
    const str = String(msg || (error && (error.message || error.stack)) || '');
    if (shouldSuppress(str)) {
      return true;
    }
  };

  window.addEventListener('error', function(e) {
    const msg = (e && (e.message || (e.error && (e.error.message || e.error.stack)))) || '';
    if (shouldSuppress(msg)) {
      e.preventDefault();
      e.stopPropagation();
      if (e.stopImmediatePropagation) e.stopImmediatePropagation();
    }
  }, true);

  window.addEventListener('unhandledrejection', function(e) {
    const reason = (e && (e.reason && (e.reason.message || e.reason.stack || String(e.reason)))) || '';
    if (shouldSuppress(reason)) {
      e.preventDefault();
      e.stopPropagation();
      if (e.stopImmediatePropagation) e.stopImmediatePropagation();
    }
  }, true);
})();
