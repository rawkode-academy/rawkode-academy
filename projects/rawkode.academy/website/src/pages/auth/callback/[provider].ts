import type { APIRoute } from "astro";

export const GET: APIRoute = async (context) => {
	const { provider } = context.params;
	const authService = context.locals.runtime?.env?.AUTH_SERVICE;

	if (!authService || !provider) {
		return new Response("Auth service not configured", { status: 500 });
	}

	// Construct the URL to forward to the auth service
	const url = new URL(context.request.url);
	const serviceUrl = new URL(
		`/auth/callback/${provider}${url.search}`,
		"https://auth.internal",
	);

	try {
		const response = await authService.fetch(serviceUrl.toString(), {
			method: "GET",
			headers: context.request.headers,
			redirect: "manual",
		});

		// Create a new response with the same status and headers
		// We explicitly create a new Headers object to ensure we can modify it if needed
		// but simply passing response.headers should work for most cases.
		const newResponse = new Response(response.body, {
			status: response.status,
			statusText: response.statusText,
			headers: response.headers,
		});

		return newResponse;
	} catch (error) {
		console.error("Auth callback error:", error);
		return new Response("Authentication failed", { status: 500 });
	}
};
