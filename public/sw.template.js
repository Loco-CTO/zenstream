const CACHE_NAME = "__CACHE_NAME__";
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
						.filter((key) => key.startsWith("zenstream-shell-") && key !== CACHE_NAME)
						.map((key) => caches.delete(key)),
				),
			),
	);
	self.clients.claim();
});

self.addEventListener("push", (event) => {
		let payload = {};
		try {
			payload = event.data?.json() || {};
		} catch {
			payload = {};
		}
		const title = payload.title || "ZenStream";
		const options = {
			body: payload.body || "New media is available.",
			icon: "/icon.png",
			badge: "/icon.png",
			data: { url: payload.url || "/notifications" },
		};
		event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
		event.notification.close();
		const target = new URL(
			event.notification.data?.url || "/notifications",
			self.location.origin,
		).href;
		event.waitUntil(
			self.clients
				.matchAll({ type: "window", includeUncontrolled: true })
				.then((clients) => {
					const current = clients.find((client) => "focus" in client);
					if (current) {
						return current.navigate(target).then(() => current.focus());
					}
					return self.clients.openWindow(target);
				}),
		);
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
	if (url.pathname.startsWith("/_next/static/")) {
		event.respondWith(
			caches.match(request).then((cached) => {
				const network = fetch(request).then((response) => {
					if (response.ok) {
						const copy = response.clone();
						caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
					}
					return response;
				});
				return cached || network;
			}),
		);
		return;
	}

	event.respondWith(
		fetch(request).catch(() =>
			caches.match(request).then((response) => response || caches.match("/")),
		),
	);
});
