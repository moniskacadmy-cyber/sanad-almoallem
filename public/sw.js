// Service Worker for "تذكيراتي" (My Reminders) PWA

// Cache name definition for static resources
const CACHE_NAME = 'my-reminders-v1';

// Install event: skip waiting to activate immediately
self.addEventListener('install', (event) => {
  // Activate new service worker immediately
  self.skipWaiting();
});

// Activate event: claim all client windows immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      // Take control of all open pages right away
      self.clients.claim(),
      // Clean up any old legacy caches if needed
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => caches.delete(name))
        );
      }),
    ])
  );
});

// Fetch event: network-first strategy so fresh code/updates arrive immediately without stale caching
self.addEventListener('fetch', (event) => {
  // Pass all HTTP/HTTPS requests through to network directly
  event.respondWith(
    fetch(event.request).catch(() => {
      // Offline fallback if network fails
      return caches.match(event.request);
    })
  );
});

// Notification click event: focus existing tab or open main application URL '/'
self.addEventListener('notificationclick', (event) => {
  // Close notification pop-up
  event.notification.close();

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Check if there is already an open window/tab for this app
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open a new window to root '/'
      if (self.clients.openWindow) {
        return self.clients.openWindow('/');
      }
    })
  );
});
