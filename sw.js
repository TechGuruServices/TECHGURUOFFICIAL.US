/**
 * TechGuru PWA Service Worker
 * Provides offline functionality, caching strategies, and PWA capabilities
 */

const CACHE_VERSION = 'techguru-v1.0.6-20251224';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`;
const IMAGE_CACHE = `${CACHE_VERSION}-images`;

// Static assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/css/design-tokens.css',
  '/css/components.css',
  '/css/styles.css',
  '/css/chat-widget-dark-glass.min.css',
  '/js/scripts.js',
  '/js/chat-widget.min.js',
  '/images/icons/nav-icon-new.webp',
  '/images/chat-avatar.webp',
  '/favicon-48x48.png',
  '/favicon-512x512.png',
  '/apple-touch-icon.png',
  '/site.webmanifest'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');

  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[Service Worker] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[Service Worker] Installation complete');
        return self.skipWaiting(); // Activate immediately
      })
      .catch((error) => {
        console.error('[Service Worker] Installation failed:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');

  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => {
              // Remove caches that don't match current version
              return cacheName.startsWith('techguru-') &&
                !cacheName.startsWith(CACHE_VERSION);
            })
            .map((cacheName) => {
              console.log('[Service Worker] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            })
        );
      })
      .then(() => {
        console.log('[Service Worker] Activation complete');
        return self.clients.claim(); // Take control immediately
      })
  );
});

// Fetch event - serve from cache with network fallback
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip cross-origin requests
  if (url.origin !== location.origin) {
    return;
  }

  // API requests - network first, cache fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstStrategy(request));
    return;
  }

  // Images - cache first, network fallback
  if (request.destination === 'image') {
    event.respondWith(cacheFirstStrategy(request, IMAGE_CACHE));
    return;
  }

  // Static assets - cache first, network fallback
  event.respondWith(cacheFirstStrategy(request, STATIC_CACHE));
});

/**
 * Cache-first strategy: Check cache, fallback to network
 * Good for static assets that don't change often
 */
async function cacheFirstStrategy(request, cacheName = STATIC_CACHE) {
  try {
    // Try cache first
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    // Fetch from network
    const networkResponse = await fetch(request);

    // Cache successful responses
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    console.error('[Service Worker] Fetch failed:', error);

    // If HTML request fails, return offline page
    if (request.destination === 'document') {
      const offlineCache = await caches.match('/index.html');
      if (offlineCache) {
        return offlineCache;
      }
    }

    throw error;
  }
}

/**
 * Network-first strategy: Try network, fallback to cache
 * Good for dynamic content and API calls
 */
async function networkFirstStrategy(request) {
  try {
    const networkResponse = await fetch(request);

    // Cache successful responses
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    console.error('[Service Worker] Network request failed:', error);

    // Try cache as fallback
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    throw error;
  }
}

// Handle messages from clients
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'CACHE_URLS') {
    event.waitUntil(
      caches.open(DYNAMIC_CACHE)
        .then((cache) => cache.addAll(event.data.urls))
    );
  }
});

// Background sync for failed requests (if supported)
if ('sync' in self.registration) {
  self.addEventListener('sync', (event) => {
    console.log('[Service Worker] Background sync:', event.tag);

    if (event.tag === 'sync-contact-forms') {
      event.waitUntil(syncContactForms());
    }
  });
}

async function syncContactForms() {
  // Implement background sync for contact form submissions
  console.log('[Service Worker] Syncing contact forms...');
}
