/* Service worker do CALT CRM.
   Estratégia: network-first para navegação (sempre tenta o HTML mais novo, cai no cache offline)
   e cache-first para assets versionados do Vite (que já têm hash no nome). /api nunca é cacheado. */
const VERSAO = 'calt-v1';
const APP_SHELL = ['/', '/index.html', '/manifest.webmanifest', '/favicon.svg', '/icons/icon-192.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSAO).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((chaves) => Promise.all(chaves.filter((c) => c !== VERSAO).map((c) => caches.delete(c))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Nunca interferir em API ou em origens externas.
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api')) return;

  // Navegação (SPA): network-first com fallback ao index cacheado.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((resp) => {
          const copia = resp.clone();
          caches.open(VERSAO).then((c) => c.put('/index.html', copia));
          return resp;
        })
        .catch(() => caches.match('/index.html').then((r) => r || caches.match('/'))),
    );
    return;
  }

  // Assets: cache-first, atualizando o cache em segundo plano.
  event.respondWith(
    caches.match(request).then((cacheado) => {
      const rede = fetch(request)
        .then((resp) => {
          if (resp.ok) {
            const copia = resp.clone();
            caches.open(VERSAO).then((c) => c.put(request, copia));
          }
          return resp;
        })
        .catch(() => cacheado);
      return cacheado || rede;
    }),
  );
});
