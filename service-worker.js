// 독고다이 법률단 — Service Worker
// 캐시 전략: app shell은 cache-first, CDN은 stale-while-revalidate, API는 항상 네트워크

const CACHE_VERSION = "dokgo-v3";
const CORE = [
  "./",
  "./index.html",
  "./justice.jpg",
  "./justice.svg",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_VERSION).then((c) => c.addAll(CORE).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);

  // Anthropic API는 항상 네트워크로 (절대 캐시 X)
  if (url.hostname === "api.anthropic.com") return;

  // GET 외 무시
  if (e.request.method !== "GET") return;

  // CDN(jsdelivr 등) — stale-while-revalidate
  if (url.hostname === "cdn.jsdelivr.net") {
    e.respondWith(
      caches.open(CACHE_VERSION).then((c) =>
        c.match(e.request).then((cached) => {
          const net = fetch(e.request).then((resp) => {
            if (resp && resp.status === 200) c.put(e.request, resp.clone());
            return resp;
          }).catch(() => cached);
          return cached || net;
        })
      )
    );
    return;
  }

  // 같은 출처 — cache-first 후 네트워크 fallback
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.match(e.request).then((cached) => {
        if (cached) return cached;
        return fetch(e.request).then((resp) => {
          if (resp && resp.status === 200 && resp.type === "basic") {
            const copy = resp.clone();
            caches.open(CACHE_VERSION).then((c) => c.put(e.request, copy)).catch(() => {});
          }
          return resp;
        }).catch(() => caches.match("./index.html"));
      })
    );
  }
});
