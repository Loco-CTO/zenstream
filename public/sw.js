const CACHE_NAME = "zenstream-shell-v0.2.0-main.0";
const APP_SHELL = ["/", "/icon.png", "/icon-pwa.png"];

self.addEventListener("install", (event) => {
	event.waitUntil(
		caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)),
	);
	self.skipWaiting();
});

self.addEventListener("activate", (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) =>
				Promise.all(
					keys
						.filter(
							(key) => key.startsWith("zenstream-shell-") && key !== CACHE_NAME,
						)
						.map((key) => caches.delete(key)),
				),
			),
	);
	self.clients.claim();
});

self.addEventListener("fetch", (event) => {
	const request = event.request;
	const url = new URL(request.url);
	if (
		request.method !== "GET" ||
		url.origin !== self.location.origin ||
		url.pathname.startsWith("/api/")
	)
		return;

	event.respondWith(
		fetch(request).catch(() =>
			caches.match(request).then((response) => response || caches.match("/")),
		),
	);
});
