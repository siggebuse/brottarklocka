const CACHE="brottarklocka-ringerdb-v7";
const ASSETS=["./","index.html","style.css","app.js?v=7","public.html","manifest.webmanifest","icon.svg"];

self.addEventListener("install", event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS)).catch(()=>{})
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const req = event.request;
  if(req.method !== "GET") return;

  event.respondWith(
    fetch(req)
      .then(resp => {
        const copy = resp.clone();
        caches.open(CACHE).then(cache => cache.put(req, copy)).catch(()=>{});
        return resp;
      })
      .catch(() => caches.match(req))
  );
});
