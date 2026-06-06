const notificationServiceWorkerUrl = "/notification-service-worker.js";
const notificationServiceWorkerScope = "/";

export async function getNotificationServiceWorkerRegistration(
	serviceWorker: Pick<ServiceWorkerContainer, "ready" | "register">,
): Promise<ServiceWorkerRegistration> {
	const registration = await serviceWorker.register(
		notificationServiceWorkerUrl,
		{
			scope: notificationServiceWorkerScope,
		},
	);

	return registration.active ? registration : serviceWorker.ready;
}
