// Firebase Service Worker for Background Web Push Notifications (سند المعلم)
// يدعم استقبال الإشعارات في الخلفية عند إغلاق التطبيق والتوجيه الذكي عند النقر

importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

// استخراج إعدادات Firebase Project ديناميكياً من معلمات الرابط أو الاعتماد على إعدادات المشروع الافتراضية
function getFirebaseConfig() {
  const params = new URLSearchParams(self.location.search);
  const apiKey = params.get('apiKey');
  const projectId = params.get('projectId');
  const messagingSenderId = params.get('messagingSenderId');
  const appId = params.get('appId');
  const authDomain = params.get('authDomain');
  const storageBucket = params.get('storageBucket');

  if (apiKey && projectId) {
    return {
      apiKey,
      projectId,
      messagingSenderId: messagingSenderId || '234541494466',
      appId: appId || '1:234541494466:web:b040e478d26a745f400b5b',
      authDomain: authDomain || `${projectId}.firebaseapp.com`,
      storageBucket: storageBucket || `${projectId}.firebasestorage.app`,
    };
  }

  // إعدادات Firebase Project الافتراضية لتطبيق سند المعلم
  return {
    apiKey: 'AIzaSyBOWJa3xUpdSJIfT1MwDO5UP9LJvC41WkY',
    authDomain: 'sanadak-3cc89.firebaseapp.com',
    projectId: 'sanadak-3cc89',
    storageBucket: 'sanadak-3cc89.firebasestorage.app',
    messagingSenderId: '234541494466',
    appId: '1:234541494466:web:b040e478d26a745f400b5b',
  };
}

const firebaseConfig = getFirebaseConfig();
let fcmSdkReady = false;

if (firebaseConfig.apiKey && firebaseConfig.projectId) {
  try {
    firebase.initializeApp(firebaseConfig);
    const messaging = firebase.messaging();
    fcmSdkReady = true;

    // استقبال الإشعارات في الخلفية وتحويلها إلى Notification ناطق وتنبيه تفاعلي
    messaging.onBackgroundMessage((payload) => {
      console.log('[firebase-messaging-sw.js] Received background message: ', payload);

      const notificationTitle = payload.notification?.title || payload.data?.title || 'تذكير حصة جديدة ⏰';
      const notificationOptions = {
        body: payload.notification?.body || payload.data?.body || 'لديك حصة قادمة الآن!',
        icon: '/icon-192.png', // مسار أيقونة تطبيقك
        badge: '/badge-icon.png',
        tag: [payload.data?.tag || 'lesson-reminder', payload.data?.scheduleId || payload.data?.groupSlotId || payload.data?.taskId || '']
          .filter(Boolean)
          .join('-'),
        renotify: true,
        requireInteraction: true,
        silent: false,
        timestamp: Date.now(),
        vibrate: [200, 100, 200],
        data: {
          url: payload.data?.url || payload.data?.click_action || '/',
          ...payload.data,
        },
        actions:
          payload.data?.kind === 'pause-ending'
            ? [
                { action: 'restore_old', title: 'استعادة الجدول القديم' },
                { action: 'choose_new', title: 'اختيار جدول جديد' },
              ]
            : [{ action: 'open', title: 'فتح التطبيق 📱' }],
      };

      self.registration.showNotification(notificationTitle, notificationOptions);
    });
  } catch (err) {
    console.warn('[firebase-messaging-sw.js] Firebase initialization warning:', err);
  }
}

// التثبيت والتفعيل الفوري للـ Service Worker لمنع التداخل والـ Cache القديم
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// التعامل مع النقر على الإشعار المجدول وإعادة التوجيه بسلاسة
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';

  // معالجة إجراءات إيقاف مؤقت إذا وجدت
  const isPause = event.notification.data && event.notification.data.kind === 'pause-ending';
  const pauseAction = isPause
    ? event.action === 'restore_old' || event.action === 'choose_new'
      ? event.action
      : 'review'
    : null;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let client of windowClients) {
        if ((client.url === targetUrl || client.url.includes(targetUrl)) && 'focus' in client) {
          if (pauseAction) client.postMessage({ type: 'pause-action', action: pauseAction });
          return client.focus();
        }
      }
      if (clients.openWindow) {
        const finalUrl = pauseAction ? '/?pauseAction=' + pauseAction : targetUrl;
        return clients.openWindow(finalUrl);
      }
    })
  );
});

// Fallback native push event listener when browser wakes service worker directly
self.addEventListener('push', (event) => {
  if (fcmSdkReady || !event.data) return;
  try {
    const payload = event.data.json();
    const title = payload.notification?.title || payload.data?.title || 'تذكير حصة جديدة ⏰';
    const body = payload.notification?.body || payload.data?.body || 'لديك حصة قادمة الآن!';
    const options = {
      body,
      icon: '/icon-192.png',
      badge: '/badge-icon.png',
      tag: payload.data?.tag || 'sanad-push',
      renotify: true,
      requireInteraction: true,
      vibrate: [200, 100, 200],
      data: {
        url: payload.data?.url || payload.data?.click_action || '/',
        ...payload.data,
      },
      actions: [{ action: 'open', title: 'فتح التطبيق 📱' }],
    };
    event.waitUntil(self.registration.showNotification(title, options));
  } catch (e) {
    console.warn('[firebase-messaging-sw.js] Native push fallback parse note:', e);
  }
});
