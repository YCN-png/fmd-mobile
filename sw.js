// FMD Mobile — service worker : rend l'appli installable et l'ouvre même sans réseau (écran de l'appli seulement).
// Réseau d'abord : chaque ouverture prend la dernière version publiée. Les DONNÉES ne sont jamais gardées ici
// (Supabase n'est pas mis en cache) : tout vient du serveur.
const CACHE = 'fmd-mobile-v2-0-4-144-2';
const COQUILLE = ['./', 'index.html', 'style.css', 'app.js', 'supabase.js', 'config.js', 'manifest.webmanifest', 'icone-180.png', 'icone-192.png', 'icone-512.png'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(COQUILLE)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((l) => Promise.all(l.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== self.location.origin) return; // Supabase, polices : jamais mis en cache ici
  e.respondWith(fetch(e.request, { cache: 'no-cache' }).then((r) => { const copie = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copie)).catch(() => {}); return r; })
    .catch(() => caches.match(e.request).then((r) => r || caches.match('index.html'))));
});
