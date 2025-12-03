import { CloudEvent } from "cloudevents";

type CaptureOptions = {
	event: string;
	properties?: Record<string, unknown> | undefined;
	distinctId?: string | undefined;
};

/**
 * Attempt to extract an anonymous distinct id from cookies.
 * Looks for a session cookie or generates a fingerprint.
 */
export function getAnonDistinctIdFromCookies(req: Request): string | undefined {
	const cookieHeader = req.headers.get("cookie");
	if (!cookieHeader) return undefined;

	// Look for session cookie
	const match = cookieHeader.match(/(?:^|;\s*)session_id=([^;]+)/);
	if (match?.[1]) {
		return match[1];
	}

	return undefined;
}

/**
 * Get the distinct ID for analytics tracking from the context.
 * Prefers authenticated user ID, falls back to anonymous ID from cookies.
 */
export function getDistinctId(ctx: {
	locals: { user?: { id: string } };
	request?: Request;
}): string | undefined {
	return (
		ctx.locals.user?.id ||
		(ctx.request ? getAnonDistinctIdFromCookies(ctx.request) : undefined) ||
		undefined
	);
}

/**
 * Create a CloudEvent using the official SDK
 */
function createCloudEvent(
	type: string,
	source: string,
	data: Record<string, unknown>,
): CloudEvent<Record<string, unknown>> {
	return new CloudEvent({
		specversion: "1.0",
		type,
		source,
		id: crypto.randomUUID(),
		time: new Date().toISOString(),
		datacontenttype: "application/json",
		data,
	});
}

/**
 * Send an analytics event via the analytics worker service binding.
 * Uses the POST /track endpoint of the analytics service.
 */
export async function captureServerEvent(
	opts: CaptureOptions,
	analytics?: Fetcher,
): Promise<void> {
	const { event, properties = {}, distinctId } = opts;

	// Map event names to CloudEvent types
	const eventTypeMap: Record<string, string> = {
		video_play: "com.rawkode.academy.video.play",
		video_pause: "com.rawkode.academy.video.pause",
		video_seek: "com.rawkode.academy.video.seek",
		video_progress: "com.rawkode.academy.video.progress",
		video_complete: "com.rawkode.academy.video.complete",
		share: "com.rawkode.academy.share.created",
		reaction_add: "com.rawkode.academy.reaction.added",
		reaction_remove: "com.rawkode.academy.reaction.removed",
		course_signup: "com.rawkode.academy.course.signup",
	};

	const cloudEventType =
		eventTypeMap[event] || `com.rawkode.academy.custom.${event}`;

	const cloudEvent = createCloudEvent(cloudEventType, "/website", {
		...properties,
		distinct_id: distinctId ?? "anonymous",
	});

	// Determine which attributes to promote to OTLP attributes
	const attributesToPromote = ["distinct_id", "video_id", "content_id"];

	if (analytics) {
		// Use service binding via fetch to POST /track endpoint
		try {
			await analytics.fetch("https://analytics.internal/track", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					event: cloudEvent,
					attributes: attributesToPromote,
				}),
			});
		} catch (err) {
			console.error("Analytics service binding call failed", err);
		}
	} else {
		// Fallback: log warning (service binding should always be available in production)
		console.warn(
			"Analytics service binding not available; event not tracked",
			event,
		);
	}
}

type IdentifyOptions = {
	distinctId: string;
	anonId?: string | undefined;
	set?: Record<string, unknown> | undefined;
	setOnce?: Record<string, unknown> | undefined;
};

/**
 * Associate an anonymous id with an identified user.
 * With Grafana, we track this as a custom event.
 */
export async function identifyServerUser(
	opts: IdentifyOptions,
	analytics?: Fetcher,
): Promise<void> {
	const { distinctId, anonId, set, setOnce } = opts;

	const cloudEvent = createCloudEvent(
		"com.rawkode.academy.user.identified",
		"/website",
		{
			distinct_id: distinctId,
			anon_id: anonId,
			set_properties: set,
			set_once_properties: setOnce,
		},
	);

	if (analytics) {
		try {
			await analytics.fetch("https://analytics.internal/track", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					event: cloudEvent,
					attributes: ["distinct_id", "anon_id"],
				}),
			});
		} catch (err) {
			console.error("Analytics identify call failed", err);
		}
	}
}
