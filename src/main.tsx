import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import './index.css';

// Global error handlers to prevent unhandled script or promise crashes from going silent
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    console.warn('Unhandled promise rejection captured globally:', event.reason);
  });
  window.addEventListener('error', (event) => {
    console.error('Global script error captured:', event.error || event.message);
  });
}

// Register Service Worker for PWA Offline Capabilities & Static Asset Precaching
registerSW({
  immediate: true,
  onNeedRefresh() {
    console.log('محتوى جديد متوفر للموقع، جاري تحديث التطبيق تلقائياً...');
  },
  onOfflineReady() {
    console.log('التطبيق جاهز للعمل بدون اتصال بالإنترنت (Offline Mode)');
  },
});

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}

