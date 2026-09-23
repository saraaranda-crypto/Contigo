// Mi Diario Devocional — funciona sin internet (excepto los audios)
// Si cambias index.html, sube también este archivo cambiando el número de versión:
const CACHE = 'mi-diario-v3';
const BASE = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(BASE)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Audios y PDF: siempre desde internet (son pesados)
  if (/\.(mp3|m4a|wav|pdf)$/i.test(url.pathname) || req.headers.has('range')) return;

  // La app: primero internet (para ver siempre la última versión), si no hay, la copia guardada
  const scope = new URL(self.registration.scope);
  const esApp = req.mode === 'navigate' && url.origin === scope.origin &&
                (url.pathname === scope.pathname || url.pathname === scope.pathname + 'index.html');
  if (esApp) {
    e.respondWith(
      fetch(req).then(r => {
        const copia = r.clone();
        caches.open(CACHE).then(c => c.put('./index.html', copia));
        return r;
      }).catch(() => caches.match('./index.html'))
    );
    return;
  }
  if (req.mode === 'navigate') return;

  // Imágenes, fuentes, íconos: copia guardada y se actualiza por detrás
  const cacheable = url.origin === scope.origin || /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (!cacheable) return;
  e.respondWith(
    caches.open(CACHE).then(c => c.match(req).then(guardado => {
      const red = fetch(req).then(r => {
        if (r && (r.ok || r.type === 'opaque')) c.put(req, r.clone());
        return r;
      }).catch(() => guardado);
      return guardado || red;
    }))
  );
});
