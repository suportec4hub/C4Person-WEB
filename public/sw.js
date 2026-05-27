/**
 * C4Person Service Worker
 * Provides offline support, caching and PWA capabilities.
 */

const CACHE_VERSION = "v1";
const STATIC_CACHE   = `c4person-static-${CACHE_VERSION}`;
const RUNTIME_CACHE  = `c4person-runtime-${CACHE_VERSION}`;
const IMAGE_CACHE    = `c4person-images-${CACHE_VERSION}`;

const STATIC_ASSETS = [
  "/",
  "/manifest.json",
  "/favicon-32.png",
  "/apple-touch-icon.png",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
  "/offline",
];

/* ------------------------------------------------------------------ */
/* Install — pre-cache static assets                                    */
/* ------------------------------------------------------------------ */
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(STATIC_ASSETS).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

/* ------------------------------------------------------------------ */
/* Activate — clean up old caches                                       */
/* ------------------------------------------------------------------ */
self.addEventListener("activate", (event) => {
  const validCaches = [STATIC_CACHE, RUNTIME_CACHE, IMAGE_CACHE];
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => !validCaches.includes(key))
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

/* ------------------------------------------------------------------ */
/* Fetch — routing strategies                                           */
/* ------------------------------------------------------------------ */
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin + supabase requests
  const isSameOrigin = url.origin === self.location.origin;
  const isSupabase   = url.hostname.includes("supabase.co");
  const isExternal   = !isSameOrigin && !isSupabase;

  if (isExternal) return; // Let browser handle third-party requests

  // Skip non-GET requests
  if (request.method !== "GET") return;

  // Supabase API → network-only (never cache auth / data calls)
  if (isSupabase) return;

  // Next.js HMR / _next/webpack — skip in dev
  if (url.pathname.startsWith("/_next/webpack-hmr")) return;

  // Static assets (_next/static, images, fonts) → cache-first
  if (
    url.pathname.startsWith("/_next/static") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.match(/\.(png|jpg|jpeg|webp|svg|ico|woff2?|ttf|eot)$/)
  ) {
    event.respondWith(cacheFirst(request, IMAGE_CACHE));
    return;
  }

  // API routes → network-only
  if (url.pathname.startsWith("/api/")) return;

  // HTML navigation → network-first with offline fallback
  if (request.mode === "navigate") {
    event.respondWith(networkFirstWithFallback(request));
    return;
  }

  // Everything else → stale-while-revalidate
  event.respondWith(staleWhileRevalidate(request, RUNTIME_CACHE));
});

/* ------------------------------------------------------------------ */
/* Strategies                                                           */
/* ------------------------------------------------------------------ */

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response("", { status: 503 });
  }
}

async function networkFirstWithFallback(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    // Return the cached offline page if available, otherwise a minimal response
    const offline = await caches.match("/offline");
    if (offline) return offline;
    return new Response(
      `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>C4Person — Offline</title>
      <meta name="viewport" content="width=device-width,initial-scale=1">
      <style>body{font-family:sans-serif;background:#0f0f11;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;flex-direction:column;gap:16px}
      h1{font-size:1.5rem;font-weight:700}p{color:#aaa;font-size:.9rem}</style></head>
      <body><h1>📴 Sem conexão</h1><p>Conecte-se à internet para usar o C4Person.</p></body></html>`,
      { headers: { "Content-Type": "text/html" } }
    );
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache    = await caches.open(cacheName);
  const cached   = await cache.match(request);
  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);

  return cached ?? (await fetchPromise) ?? new Response("", { status: 503 });
}
