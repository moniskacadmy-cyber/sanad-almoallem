// ملاحظة هامة: يجب أن تطابق إعدادات Firebase (firebaseConfig) أدناه قيم المشروع المعتمد في تطبيقك لضمان استقبال إشعارات Web Push بنجاح.
// IMPORTANT: The firebaseConfig object below MUST match your active Firebase project configuration.

importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

const params = new URL(self.location.href).searchParams;
const firebaseConfig = {
  apiKey: params.get('apiKey') || '',
  authDomain: params.get('authDomain') || '',
  projectId: params.get('projectId') || '',
  storageBucket: params.get('storageBucket') || '',
  messagingSenderId: params.get('messagingSenderId') || '',
  appId: params.get('appId') || '',
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
