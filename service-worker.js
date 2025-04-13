// Service Worker voor WasChecker app

const CACHE_NAME = 'waschecker-v2';
const STATIC_CACHE_NAME = 'waschecker-static-v2';
const DATA_CACHE_NAME = 'waschecker-data-v2';

const urlsToCache = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './favicon.svg',
  './manifest.json'
];

// Installatie van service worker
self.addEventListener('install', event => {
  console.log('Service Worker wordt geïnstalleerd');
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME)
      .then(cache => {
        console.log('Cache geopend');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting()) // Forceer activatie
  );
});

// Activatie van service worker
self.addEventListener('activate', event => {
  console.log('Service Worker wordt geactiveerd');
  const cacheWhitelist = [STATIC_CACHE_NAME, DATA_CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Oude cache wordt verwijderd:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
    .then(() => self.clients.claim()) // Claim alle clients
  );
});

// Afhandelen van fetch requests met cache-first strategie voor statische assets
// en network-first strategie voor dynamische data
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // Voor API requests (in toekomstige implementatie)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstStrategy(event.request));
    return;
  }
  
  // Voor statische assets
  event.respondWith(cacheFirstStrategy(event.request));
});

// Cache-first strategie: probeer eerst uit cache, dan netwerk
async function cacheFirstStrategy(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    // Alleen geldige responses cachen
    if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
      const cache = await caches.open(STATIC_CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.error('Fetch mislukt:', error);
    // Hier zou een offline fallback pagina kunnen worden getoond
    return new Response('Offline pagina', { status: 503, headers: { 'Content-Type': 'text/plain' } });
  }
}

// Network-first strategie: probeer eerst netwerk, dan cache
async function networkFirstStrategy(request) {
  try {
    const networkResponse = await fetch(request);
    // Cache bijwerken met nieuwe data
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(DATA_CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.log('Netwerk request mislukt, val terug op cache', error);
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    // Als er geen cache is, toon een foutmelding
    return new Response('Geen internetverbinding beschikbaar', { 
      status: 503, 
      headers: { 'Content-Type': 'text/plain' } 
    });
  }
}

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

// Afhandelen van background sync
self.addEventListener('sync', event => {
  console.log('Background sync event ontvangen:', event.tag);
  
  if (event.tag === 'sync-washers') {
    event.waitUntil(syncWashers());
  }
});

// Functie om wasmachines te synchroniseren
async function syncWashers() {
  // In een echte implementatie zou dit data naar een server sturen
  // Voor nu alleen een bericht in de console
  console.log('Wasmachines worden gesynchroniseerd');
  
  // Haal opgeslagen wasmachines op uit IndexedDB
  const db = await openDatabase();
  const washers = await getAllWashers(db);
  
  console.log('Wasmachines gesynchroniseerd:', washers.length);
  
  // Controleer of er wasmachines zijn die klaar zijn en nog niet gemeld
  const now = new Date().getTime();
  washers.forEach(washer => {
    if (!washer.completed && washer.endTime <= now && !washer.notified) {
      // Markeer als voltooid
      washer.completed = true;
      washer.notified = true;
      updateWasher(db, washer);
      
      // Stuur notificatie
      self.registration.showNotification('Wasmachine klaar', {
        body: `${washer.name} is klaar met wassen`,
        icon: 'favicon.svg',
        vibrate: [100, 50, 100],
        data: { washerId: washer.id },
        actions: [{ action: 'close', title: 'Sluiten' }]
      });
    }
  });
}

// Afhandelen van push notificaties
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

// IndexedDB functies voor offline opslag
function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('waschecker-db', 1);
    
    request.onerror = event => {
      console.error('IndexedDB error:', event.target.error);
      reject(event.target.error);
    };
    
    request.onsuccess = event => {
      resolve(event.target.result);
    };
    
    request.onupgradeneeded = event => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('washers')) {
        const store = db.createObjectStore('washers', { keyPath: 'id' });
        store.createIndex('by_endTime', 'endTime', { unique: false });
      }
    };
  });
}

function getAllWashers(db) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['washers'], 'readonly');
    const store = transaction.objectStore('washers');
    const request = store.getAll();
    
    request.onsuccess = event => {
      resolve(event.target.result);
    };
    
    request.onerror = event => {
      console.error('Error getting washers:', event.target.error);
      reject(event.target.error);
    };
  });
}

function updateWasher(db, washer) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['washers'], 'readwrite');
    const store = transaction.objectStore('washers');
    const request = store.put(washer);
    
    request.onsuccess = event => {
      resolve(event.target.result);
    };
    
    request.onerror = event => {
      console.error('Error updating washer:', event.target.error);
      reject(event.target.error);
    };
  });
}