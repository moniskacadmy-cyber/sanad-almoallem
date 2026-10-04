// ملاحظة هامة: يجب أن تطابق إعدادات Firebase (firebaseConfig) أدناه قيم المشروع المعتمد في تطبيقك لضمان استقبال إشعارات Web Push بنجاح.
// IMPORTANT: The firebaseConfig object below MUST match your active Firebase project configuration.

importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

const firebaseConfig = {
  projectId: "gen-lang-client-0886550561",
  appId: "1:65313535187:web:7652704feb5f4a04e85026",
  apiKey: "AIzaSyCW-2H9dXUvJEpWKs9x1Cr7ME9gqV3uZMk",
  authDomain: "gen-lang-client-0886550561.firebaseapp.com",
  storageBucket: "gen-lang-client-0886550561.firebasestorage.app",
  messagingSenderId: "65313535187",
};

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
    data: payload.data || {},
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
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
