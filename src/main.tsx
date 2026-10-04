import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

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

createRoot(document.getElementById('root')!).render(<App />);
