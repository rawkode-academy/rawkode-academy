import type { APIRoute } from "astro";
import {
	Analytics,
	getSessionId,
	createAnalyticsHeaders,
} from "../../lib/analytics";

interface AnalyticsEvent {
	action: string;
	path: string;
	title?: string; // Page title from document.title
	browser: string;
	os: string;
	referrer?: string;
	time_on_page?: number;
	utm_source?: string;
	utm_medium?: string;
	utm_campaign?: string;
	utm_term?: string;
	utm_content?: string;
}

export const POST: APIRoute = async ({ request, locals }) => {
	try {
		const event = (await request.json()) as AnalyticsEvent;
		const sessionId = getSessionId(request);

		// Initialize analytics with session and user info
		const analytics = new Analytics(
			locals.runtime.env,
			sessionId,
			locals.user?.sub,
		);

		// Build UTM parameters object
		const utmParams: Record<string, string> = {};
		if (event.utm_source) utmParams.utm_source = event.utm_source;
		if (event.utm_medium) utmParams.utm_medium = event.utm_medium;
		if (event.utm_campaign) utmParams.utm_campaign = event.utm_campaign;
		if (event.utm_term) utmParams.utm_term = event.utm_term;
		if (event.utm_content) utmParams.utm_content = event.utm_content;

		let success = false;

		switch (event.action) {
			case "page.view":
				success = await analytics.trackPageView(
					event.path,
					event.title || event.path, // Use actual title if provided, fallback to path
					event.referrer,
					utmParams,
				);
				break;
			case "page.exit":
				success = await analytics.trackPageExit(
					event.path,
					event.time_on_page || 0,
				);
				break;
			default:
				// Track as custom event
				success = await analytics.trackCustomEvent(event.action, {
					path: event.path,
					browser: event.browser,
					os: event.os,
					referrer: event.referrer,
					...utmParams,
				});
		}

		const responseHeaders = createAnalyticsHeaders(sessionId);
		responseHeaders.set("Content-Type", "application/json");

		return new Response(JSON.stringify({ success }), {
			status: success ? 200 : 500,
			headers: responseHeaders,
		});
	} catch (error) {
		console.error("Failed to process analytics event:", error);

		return new Response(
			JSON.stringify({
				success: false,
				message: error instanceof Error ? error.message : "Unknown error",
			}),
			{
				status: 500,
				headers: {
					"Content-Type": "application/json",
				},
			},
		);
	}
};
