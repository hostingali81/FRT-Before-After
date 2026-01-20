// ============================================
// Service Worker - Full Offline Support
// Auto-update with version control
// ============================================

const VERSION = '1.0.0';
const CACHE_NAME = `before-after-v${VERSION}`;
const RUNTIME_CACHE = `runtime-${VERSION}`;

// Install: Cache on first load
self.addEventListener('install', (event) => {
    console.log(`[SW] Installing version ${VERSION}`);
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('[SW] Service Worker installed, will cache on first use');
                return cache.addAll(['/']);
            })
            .then(() => self.skipWaiting())
    );
});

// Activate: Clean old caches & take control
self.addEventListener('activate', (event) => {
    console.log(`[SW] Activating version ${VERSION}`);
    event.waitUntil(
        caches.keys()
            .then(cacheNames => {
                return Promise.all(
                    cacheNames.map(cache => {
                        if (cache !== CACHE_NAME && cache !== RUNTIME_CACHE) {
                            console.log('[SW] Deleting old cache:', cache);
                            return caches.delete(cache);
                        }
                    })
                );
            })
            .then(() => self.clients.claim())
    );
});

// Fetch: Cache-first strategy for offline support
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests
    if (request.method !== 'GET') return;

    // Skip chrome-extension and other protocols
    if (!url.protocol.startsWith('http')) return;

    // Handle external requests (fonts, etc)
    if (url.origin !== location.origin) {
        event.respondWith(
            caches.match(request)
                .then(cached => {
                    if (cached) return cached;
                    return fetch(request)
                        .then(response => {
                            // Cache external resources too
                            if (response.status === 200) {
                                const responseClone = response.clone();
                                caches.open(RUNTIME_CACHE).then(cache => {
                                    cache.put(request, responseClone);
                                });
                            }
                            return response;
                        })
                        .catch(() => {
                            // Return empty response for failed external requests
                            return new Response('', { status: 200 });
                        });
                })
        );
        return;
    }

    // For same-origin requests: Cache-first strategy
    event.respondWith(
        caches.match(request)
            .then(cached => {
                // Return cached version if available
                if (cached) {
                    console.log('[SW] Serving from cache:', request.url);
                    return cached;
                }

                // Fetch from network and cache
                return fetch(request)
                    .then(response => {
                        // Only cache successful responses
                        if (response.status === 200) {
                            const responseClone = response.clone();
                            caches.open(CACHE_NAME).then(cache => {
                                console.log('[SW] Caching:', request.url);
                                cache.put(request, responseClone);
                            });
                        }
                        return response;
                    })
                    .catch(error => {
                        console.error('[SW] Fetch failed:', error);
                        // Return offline page for navigation requests
                        if (request.mode === 'navigate') {
                            return caches.match('/offline.html');
                        }
                        throw error;
                    });
            })
    );
});

// Message handler for manual updates
self.addEventListener('message', (event) => {
    if (event.data === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
