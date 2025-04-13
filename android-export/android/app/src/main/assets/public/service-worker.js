// Nome della cache
const CACHE_NAME = 'k2a-site-inspection-v1';

// Lista di file da cachare
const assetsToCache = [
  '/',
  '/index.html',
  '/app.js',
  '/styles.css',
  '/manifest.json',
  '/icons/favicon.ico',
  '/icons/k2a-16.png',
  '/icons/k2a-32.png',
  '/icons/k2a-48.png',
  '/icons/k2a-96.png',
  '/icons/k2a-128.png',
  '/icons/k2a-192.png',
  '/icons/k2a-512.png'
];

// Installazione del service worker
self.addEventListener('install', (event) => {
  // Precarica i file nella cache durante l'installazione
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Cache aperta');
        return cache.addAll(assetsToCache);
      })
      .then(() => {
        return self.skipWaiting();
      })
  );
});

// Attivazione del service worker
self.addEventListener('activate', (event) => {
  // Pulisce le vecchie cache
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Eliminazione della cache vecchia:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// Gestione delle richieste fetch
self.addEventListener('fetch', (event) => {
  // Strategia cache-first per le risorse statiche
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Restituisce la risorsa dalla cache se disponibile
        if (response) {
          return response;
        }
        
        // Altrimenti fetch dalla rete
        return fetch(event.request).then((networkResponse) => {
          // Non cachare risposte non valide o non GET
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic' || event.request.method !== 'GET') {
            return networkResponse;
          }
          
          // Copia la risposta per poterla cachare e restituire
          const responseToCache = networkResponse.clone();
          
          caches.open(CACHE_NAME)
            .then((cache) => {
              cache.put(event.request, responseToCache);
            });
            
          return networkResponse;
        });
      })
      .catch(() => {
        // Fallback per risorse non disponibili (opzionale)
        if (event.request.url.indexOf('.html') > -1) {
          return caches.match('/index.html');
        }
      })
  );
});