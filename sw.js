/* Service worker : l'appli marche hors-ligne, et les sons HD déjà téléchargés restent en cache. */
const VERSION = "pm-v1";
const SHELL = [
  "./", "index.html", "style.css", "manifest.webmanifest",
  "js/songs.js", "js/audio.js", "js/midi.js", "js/app.js",
  "icons/icon.svg", "icons/icon-180.png", "icons/icon-192.png", "icons/icon-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== "pm-sounds").map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Sons HD + polices : cache d'abord, réseau ensuite (et on garde la copie)
  if (url.hostname === "cdn.jsdelivr.net" || url.hostname.endsWith("gstatic.com") || url.hostname === "fonts.googleapis.com") {
    e.respondWith(
      caches.open("pm-sounds").then((c) =>
        c.match(req).then((hit) => hit || fetch(req).then((res) => {
          if (res.ok || res.type === "opaque") c.put(req, res.clone());
          return res;
        }))
      )
    );
    return;
  }

  // Appli : réseau d'abord (pour les mises à jour), cache si hors-ligne
  if (url.origin === self.location.origin) {
    e.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put(req, copy));
        return res;
      }).catch(() => caches.match(req).then((hit) => hit || caches.match("index.html")))
    );
  }
});
