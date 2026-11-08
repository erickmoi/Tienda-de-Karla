// Service worker: hace la app instalable, abre rápido y muestra notificaciones.
// Solo guarda los archivos de la app; los datos (Supabase) siempre van a la red.
const CACHE = 'tienda-v5'

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  const url = new URL(req.url)
  if (req.method !== 'GET' || url.origin !== self.location.origin) return

  // Páginas: red primero (para recibir la versión nueva), caché si no hay internet
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copia = res.clone()
          caches.open(CACHE).then((c) => c.put('/', copia))
          return res
        })
        .catch(() => caches.match('/')),
    )
    return
  }

  // Archivos con hash (assets) e íconos: caché primero
  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(
      caches.match(req).then((hit) =>
        hit || fetch(req).then((res) => {
          if (res.ok) {
            const copia = res.clone()
            caches.open(CACHE).then((c) => c.put(req, copia))
          }
          return res
        }),
      ),
    )
  }
})

// ---------- Notificaciones ----------
self.addEventListener('push', (event) => {
  let d = {}
  try { d = event.data?.json() ?? {} } catch { d = { body: event.data?.text() } }
  event.waitUntil(
    self.registration.showNotification(d.title || 'Tienda', {
      body: d.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: d.tag,
      renotify: !!d.tag,
      data: { url: d.url || '/' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const destino = new URL(event.notification.data?.url || '/', self.location.origin).href
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((ventanas) => {
      const abierta = ventanas.find((v) => new URL(v.url).origin === self.location.origin)
      if (abierta) return abierta.focus().then((v) => v.navigate?.(destino))
      return self.clients.openWindow(destino)
    }),
  )
})
