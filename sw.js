// Mana Beer — service worker
// Guarda la página para abrirla rápido (y sin internet) y las imágenes de cartas de Scryfall.
// Al subir una versión nueva de la página, cambia VERSION para que los celulares la descarguen.
const VERSION = 'mb-2026-10-28-1';
const SHELL = VERSION + '-shell';
const IMAGES = 'mb-images';
const MAX_IMAGES = 800;
const SHELL_FILES = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png', 'favicon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(SHELL_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.endsWith('-shell') && k !== SHELL).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function trimImages(){
  const c = await caches.open(IMAGES);
  const keys = await c.keys();
  for(let i = 0; i < keys.length - MAX_IMAGES; i++) await c.delete(keys[i]);
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if(req.method !== 'GET') return;
  const url = new URL(req.url);

  // La página: primero internet (para tener siempre la última versión); sin conexión, la guardada
  if(req.mode === 'navigate'){
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(SHELL).then(c => c.put('index.html', copy));
        return res;
      }).catch(() => caches.match('index.html'))
    );
    return;
  }

  // Imágenes de cartas: primero las guardadas
  if(url.hostname === 'cards.scryfall.io'){
    e.respondWith(
      caches.open(IMAGES).then(c => c.match(req).then(hit => hit || fetch(req).then(res => {
        if(res.ok || res.type === 'opaque'){ c.put(req, res.clone()); trimImages(); }
        return res;
      })))
    );
    return;
  }

  // Archivos propios (íconos, manifest): los guardados y se actualizan en segundo plano
  if(url.origin === self.location.origin){
    e.respondWith(
      caches.match(req).then(hit => {
        const net = fetch(req).then(res => { if(res.ok){ const copy = res.clone(); caches.open(SHELL).then(c => c.put(req, copy)); } return res; }).catch(() => hit);
        return hit || net;
      })
    );
  }
  // Todo lo demás (Firebase, Google, API de Scryfall) va directo a internet
});
