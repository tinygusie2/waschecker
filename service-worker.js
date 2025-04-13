// Service Worker voor WasChecker app

const CACHE_NAME = 'waschecker-v1';
const urlsToCache = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './favicon.svg'
];

// Installatie van service worker
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache geopend');
        return cache.addAll(urlsToCache);
      })
  );
});

// Activatie van service worker
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Afhandelen van fetch requests
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});

// Afhandelen van notificatie klikken
self.addEventListener('notificationclick', event => {
  console.log('Notificatie aangeklikt:', event);
  
  event.notification.close();
  
  if (event.action === 'close') {
    console.log('Notificatie gesloten');
    return;
  }
  
  // Open het venster als er op de notificatie wordt geklikt
  event.waitUntil(
    clients.matchAll({type: 'window'})
      .then(clientList => {
        // Als er al een venster open is, focus daarop
        for (const client of clientList) {
          if (client.url === '/' && 'focus' in client) {
            return client.focus();
          }
        }
        // Anders, open een nieuw venster
        if (clients.openWindow) {
          return clients.openWindow('/');
        }
      })
  );
});

// Afhandelen van push notificaties (voor toekomstige implementatie)
self.addEventListener('push', event => {
  console.log('Push ontvangen:', event);
  
  let title = 'WasChecker';
  let options = {
    body: 'Nieuwe melding van WasChecker',
    icon: 'favicon.svg',
    vibrate: [100, 50, 100]
  };
  
  if (event.data) {
    const data = event.data.json();
    title = data.title || title;
    options.body = data.body || options.body;
  }
  
  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});