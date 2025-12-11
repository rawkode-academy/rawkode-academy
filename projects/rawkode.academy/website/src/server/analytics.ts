import { CloudEvent } from "cloudevents";
import { createLogger } from "@/lib/logger";

const logger = createLogger("analytics");

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
		// Video events
		video_play: "com.rawkode.academy.video.play",
		video_pause: "com.rawkode.academy.video.pause",
		video_seek: "com.rawkode.academy.video.seek",
		video_progress: "com.rawkode.academy.video.progress",
		video_complete: "com.rawkode.academy.video.complete",
		video_tab_viewed: "com.rawkode.academy.video.tab_viewed",
		// Content events
		share: "com.rawkode.academy.share.created",
		reaction_add: "com.rawkode.academy.reaction.added",
		reaction_remove: "com.rawkode.academy.reaction.removed",
		// Course/signup events
		course_signup: "com.rawkode.academy.course.signup",
		lead_magnet_viewed: "com.rawkode.academy.lead_magnet.viewed",
		lead_magnet_signup: "com.rawkode.academy.lead_magnet.signup",
		// Auth events
		sign_in_initiated: "com.rawkode.academy.auth.sign_in_initiated",
		sign_out_completed: "com.rawkode.academy.auth.sign_out_completed",
		// Search events
		search_performed: "com.rawkode.academy.search.performed",
		command_palette_opened: "com.rawkode.academy.command_palette.opened",
		command_palette_navigation: "com.rawkode.academy.command_palette.navigation",
		// Filter events
		filter_applied: "com.rawkode.academy.filter.applied",
		filter_cleared: "com.rawkode.academy.filter.cleared",
		// UI events
		theme_switched: "com.rawkode.academy.ui.theme_switched",
		sidebar_mode_switched: "com.rawkode.academy.ui.sidebar_mode_switched",
		accordion_toggled: "com.rawkode.academy.ui.accordion_toggled",
		// External link events
		external_link_clicked: "com.rawkode.academy.external_link.clicked",
		discord_link_clicked: "com.rawkode.academy.external_link.discord",
		podcast_subscribe_clicked: "com.rawkode.academy.external_link.podcast_subscribe",
		// Game events
		game_started: "com.rawkode.academy.game.started",
		game_completed: "com.rawkode.academy.game.completed",
		game_failed: "com.rawkode.academy.game.failed",
		achievement_unlocked: "com.rawkode.academy.game.achievement_unlocked",
	};

	const cloudEventType =
		eventTypeMap[event] || `com.rawkode.academy.custom.${event}`;

	const cloudEvent = createCloudEvent(cloudEventType, "/website", {
		...properties,
		distinct_id: distinctId ?? "anonymous",
	});

	// Determine which attributes to promote to PostHog properties
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
			logger.error("Analytics service binding call failed", err);
		}
	} else {
		// Fallback: log warning (service binding should always be available in production)
		logger.warn("Analytics service binding not available; event not tracked", {
			event,
		});
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
 * Tracked as a custom CloudEvent via the analytics service.
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
			logger.error("Analytics identify call failed", err);
		}
	}
}
