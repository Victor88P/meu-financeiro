// Service worker: deixa o app abrir mesmo sem internet (depois de publicado).
// Estratégia "rede primeiro": online sempre pega a versão nova; offline usa a cópia salva.
const CACHE = 'meu-financeiro-v4';
const FIREBASE_SDK = 'https://www.gstatic.com/firebasejs/';
const ASSETS = [
  './', 'index.html', 'css/style.css', 'manifest.webmanifest',
  'js/util.js', 'js/firebase-config.js', 'js/store.js', 'js/views/login.js', 'js/finance.js', 'js/ui.js', 'js/charts.js', 'js/forms.js',
  'js/views/dashboard.js', 'js/views/extrato.js', 'js/views/cartoes.js', 'js/views/patrimonio.js', 'js/views/cadastros.js',
  'js/app.js', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  // Bibliotecas do Firebase: a versão está no endereço, então guarda a cópia e usa sempre ela.
  if (req.url.startsWith(FIREBASE_SDK)) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(req, copy));
      return res;
    })));
    return;
  }
  // Dados do Firestore e o resto da internet passam direto.
  if (new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req)
      .then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return res; })
      .catch(() => caches.match(req).then(r => r || caches.match('index.html'))),
  );
});
