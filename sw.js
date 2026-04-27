const SHELL_CACHE = 'wander-shell-v4';
const RUNTIME_CACHE = 'wander-runtime-v4';

const SHELL_ASSETS = [
    './',
    './index.html',
    './config.public.js',
    './style.css',
    './app-main.js',
    './NCTTorin-Regular.ttf'
];

const CDN_HOSTS = new Set([
    'cdn.jsdelivr.net',
    'esm.sh'
]);

function isApiRequest(url) {
    return (
        url.hostname === 'api.openai.com' ||
        url.hostname === 'api.odyssey.ml' ||
        (url.hostname.endsWith('.supabase.co') && url.pathname.includes('/functions/v1/'))
    );
}

function isSameOriginStatic(url) {
    if (url.origin !== self.location.origin) return false;
    if (url.pathname.endsWith('/config.js')) return false;

    return (
        url.pathname === '/' ||
        url.pathname.endsWith('.html') ||
        url.pathname.endsWith('.css') ||
        url.pathname.endsWith('.js') ||
        url.pathname.endsWith('.ttf') ||
        url.pathname.endsWith('.woff') ||
        url.pathname.endsWith('.woff2') ||
        url.pathname.endsWith('.png') ||
        url.pathname.endsWith('.jpg') ||
        url.pathname.endsWith('.jpeg') ||
        url.pathname.endsWith('.svg') ||
        url.pathname.endsWith('.ico')
    );
}

async function networkFirst(request, fallbackPath = './index.html') {
    const cache = await caches.open(RUNTIME_CACHE);
    try {
        const response = await fetch(request);
        cache.put(request, response.clone());
        return response;
    } catch (error) {
        const cached = await cache.match(request);
        if (cached) return cached;
        const fallback = await caches.match(fallbackPath);
        if (fallback) return fallback;
        throw error;
    }
}

async function staleWhileRevalidate(request) {
    const cache = await caches.open(RUNTIME_CACHE);
    const cached = await cache.match(request);

    const networkFetch = fetch(request)
        .then((response) => {
            cache.put(request, response.clone());
            return response;
        })
        .catch(() => null);

    if (cached) {
        networkFetch.catch(() => {});
        return cached;
    }

    const networkResponse = await networkFetch;
    if (networkResponse) return networkResponse;

    return fetch(request);
}

async function cacheFirst(request) {
    const cache = await caches.open(RUNTIME_CACHE);
    const cached = await cache.match(request);
    if (cached) return cached;

    const response = await fetch(request);
    cache.put(request, response.clone());
    return response;
}

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_ASSETS))
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys
                    .filter((key) => key !== SHELL_CACHE && key !== RUNTIME_CACHE)
                    .map((key) => caches.delete(key))
            )
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    const { request } = event;
    if (request.method !== 'GET') return;

    const url = new URL(request.url);
    if (isApiRequest(url)) return;
    if (url.origin === self.location.origin && url.pathname.endsWith('/config.js')) return;

    if (request.mode === 'navigate') {
        event.respondWith(networkFirst(request));
        return;
    }

    if (CDN_HOSTS.has(url.hostname)) {
        event.respondWith(cacheFirst(request));
        return;
    }

    if (isSameOriginStatic(url)) {
        event.respondWith(staleWhileRevalidate(request));
        return;
    }
});
