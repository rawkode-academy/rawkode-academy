self.addEventListener("push", (event) => {
	let payload = {
		title: "Rawkode Academy",
		body: "A notification is ready.",
		tag: "rawkode-academy",
		url: "/",
		data: {},
	};

	if (event.data) {
		try {
			payload = { ...payload, ...event.data.json() };
		} catch {
			payload.body = event.data.text();
		}
	}

	event.waitUntil(
		self.registration.showNotification(payload.title, {
			body: payload.body,
			tag: payload.tag,
			data: {
				...payload.data,
				url: payload.url,
			},
			icon: "/android-chrome-192x192.png",
			badge: "/favicon-32x32.png",
			requireInteraction: false,
		}),
	);
});

self.addEventListener("notificationclick", (event) => {
	event.notification.close();
	const targetUrl = new URL(
		event.notification.data?.url || "/",
		self.location.origin,
	).href;

	event.waitUntil(
		self.clients
			.matchAll({ type: "window", includeUncontrolled: true })
			.then((clients) => {
				for (const client of clients) {
					if (client.url === targetUrl && "focus" in client) {
						return client.focus();
					}
				}

				if (self.clients.openWindow) {
					return self.clients.openWindow(targetUrl);
				}
				return undefined;
			}),
	);
});
