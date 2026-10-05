// Firebase Service Worker for Background Web Push Notifications
// Reads configuration dynamically from query parameters passed during registration.

importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

function getFirebaseConfigFromLocation() {
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
      messagingSenderId: messagingSenderId || undefined,
      appId: appId || undefined,
      authDomain: authDomain || `${projectId}.firebaseapp.com`,
      storageBucket: storageBucket || `${projectId}.firebasestorage.app`,
    };
  }

  return {
    projectId: undefined,
    authDomain: undefined,
    storageBucket: undefined,
  };
}

const firebaseConfig = getFirebaseConfigFromLocation();

if (firebaseConfig.apiKey && firebaseConfig.projectId) {
  try {
    firebase.initializeApp(firebaseConfig);
    const messaging = firebase.messaging();

    messaging.onBackgroundMessage((payload) => {
      console.log('[firebase-messaging-sw.js] Received background message:', payload);
      const notificationTitle = payload.notification?.title || payload.data?.title || 'تذكير بالحصة ⏰';
      const notificationOptions = {
        body: payload.notification?.body || payload.data?.body || 'لديك حصة دراسية قريبة.',
        icon: '/pwa-192x192.png',
        badge: '/favicon.ico',
        tag: payload.data?.tag || 'lesson-reminder',
        renotify: true,
        requireInteraction: true,
        vibrate: [200, 100, 200],
        data: payload.data || {},
        actions: [
          { action: 'open', title: 'فتح التطبيق 📱' }
        ],
      };

      self.registration.showNotification(notificationTitle, notificationOptions);
    });
  } catch (err) {
    console.warn('[firebase-messaging-sw.js] Initialization warning:', err);
  }
}

// Fallback native push event listener when browser wakes service worker
self.addEventListener('push', (event) => {
  if (!event.data) return;
  try {
    const payload = event.data.json();
    const title = payload.notification?.title || payload.data?.title || 'سند المعلم 🔔';
    const body = payload.notification?.body || payload.data?.body || 'لديك تذكير جديد بجدول الحصص والمهام.';
    const options = {
      body,
      icon: '/pwa-192x192.png',
      badge: '/favicon.ico',
      tag: payload.data?.tag || 'sanad-push',
      renotify: true,
      requireInteraction: true,
      vibrate: [200, 100, 200],
      data: payload.data || {},
    };
    event.waitUntil(self.registration.showNotification(title, options));
  } catch (e) {
    console.warn('[firebase-messaging-sw.js] Push parse note:', e);
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});
