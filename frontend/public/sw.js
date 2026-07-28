/* SIGMA PWA — cache do shell + assets Next para vistoria offline */
const CACHE_VERSION = 'sigma-campo-v6';
const SHELL_URL = '/mobile';
const PRECACHE_URLS = [
  SHELL_URL,
  '/icon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-512.png',
  '/apple-touch-icon.png',
  '/manifest.webmanifest',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || typeof data !== 'object') return;

  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }

  if (data.type === 'CACHE_URLS' && Array.isArray(data.urls)) {
    event.waitUntil(cacheUrls(data.urls));
  }
});

self.addEventListener('push', (event) => {
  let payload = { title: 'SIGMA', body: 'Nova notificacao operacional.', url: '/dashboard' };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {
    // payload padrao
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/icon-192.png',
      data: { url: payload.url },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? SHELL_URL;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});

function isApiPath(pathname) {
  return (
    pathname.startsWith('/api-gestop') ||
    pathname.startsWith('/api-sigma') ||
    pathname.startsWith('/api/')
  );
}

function isAuthPath(pathname) {
  return pathname.startsWith('/login') || pathname.startsWith('/recuperar-senha');
}

function isNextStaticAsset(pathname) {
  return pathname.startsWith('/_next/static/');
}

function isNextBypass(pathname) {
  return pathname.startsWith('/_next/') && !isNextStaticAsset(pathname);
}

async function putInCache(request, response) {
  if (!response || !response.ok) return;
  const cache = await caches.open(CACHE_VERSION);
  await cache.put(request, response.clone());
}

async function cacheUrls(urls) {
  const cache = await caches.open(CACHE_VERSION);
  const unique = [...new Set(urls.filter((url) => typeof url === 'string' && url.length > 0))];

  await Promise.all(
    unique.map(async (url) => {
      try {
        const absolute = new URL(url, self.location.origin);
        if (absolute.origin !== self.location.origin) return;
        if (isApiPath(absolute.pathname) || isAuthPath(absolute.pathname) || isNextBypass(absolute.pathname)) {
          return;
        }

        const response = await fetch(absolute.href, { credentials: 'same-origin', cache: 'reload' });
        if (!response.ok) return;

        await cache.put(absolute.href, response.clone());
        if (absolute.pathname === SHELL_URL) {
          await cache.put(SHELL_URL, response.clone());
        }
        if (isNextStaticAsset(absolute.pathname)) {
          await cache.put(`${absolute.pathname}${absolute.search}`, response.clone());
        }
      } catch {
        // ignora URL individual
      }
    }),
  );
}

async function networkFirstNavigate(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      await putInCache(request, response);
      // Mantém cópia canônica do shell de vistoria
      const url = new URL(request.url);
      if (url.pathname === SHELL_URL || url.pathname === '/') {
        const cache = await caches.open(CACHE_VERSION);
        await cache.put(SHELL_URL, response.clone());
      }
    }
    return response;
  } catch {
    const cachedExact = await caches.match(request);
    if (cachedExact) return cachedExact;

    const shell = await caches.match(SHELL_URL);
    if (shell) return shell;

    return new Response(
      '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>SIGMA Offline</title></head><body style="font-family:system-ui;padding:2rem;background:#f8fafc;color:#0f172a"><h1>SIGMA — Offline</h1><p>Abra a Vistoria com internet e toque em “Baixar dados offline” para preparar o aplicativo.</p><p><a href="/mobile">Tentar abrir Vistoria</a></p></body></html>',
      {
        status: 503,
        headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
      },
    );
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) {
    // Atualiza em background quando online
    fetch(request)
      .then((response) => putInCache(request, response))
      .catch(() => undefined);
    return cached;
  }

  const response = await fetch(request);
  await putInCache(request, response);
  return response;
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (isApiPath(url.pathname) || isAuthPath(url.pathname) || isNextBypass(url.pathname)) return;

  // Documentos / navegação: network-first com fallback para shell /mobile
  if (event.request.mode === 'navigate' || event.request.destination === 'document') {
    event.respondWith(networkFirstNavigate(event.request));
    return;
  }

  // Assets estáticos do Next e ícones: cache-first
  if (
    isNextStaticAsset(url.pathname) ||
    url.pathname === '/icon.svg' ||
    url.pathname === '/icon-192.png' ||
    url.pathname === '/icon-512.png' ||
    url.pathname === '/icon-maskable-512.png' ||
    url.pathname === '/apple-touch-icon.png' ||
    url.pathname === '/icon-maskable.svg' ||
    url.pathname === '/manifest.webmanifest' ||
    url.pathname.startsWith('/icons/')
  ) {
    event.respondWith(
      cacheFirst(event.request).catch(
        () =>
          caches.match(event.request).then(
            (cached) =>
              cached ||
              new Response('', {
                status: 503,
                statusText: 'Offline',
              }),
          ),
      ),
    );
  }
});
