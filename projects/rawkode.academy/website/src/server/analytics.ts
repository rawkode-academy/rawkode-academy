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

	// Map event names to CloudEvent types (domain events only, prefix added by observability-collector)
	const eventTypeMap: Record<string, string> = {
		// Video events
		video_play: "video.play",
		video_pause: "video.pause",
		video_seek: "video.seek",
		video_progress: "video.progress",
		video_complete: "video.complete",
		video_tab_viewed: "video.tab_viewed",
		// Content events
		share: "share.created",
		reaction_add: "reaction.added",
		reaction_remove: "reaction.removed",
		// Course/signup events
		course_signup: "course.signup",
		lead_magnet_viewed: "lead_magnet.viewed",
		lead_magnet_signup: "lead_magnet.signup",
		// Auth events
		sign_in_initiated: "auth.sign_in_initiated",
		sign_out_completed: "auth.sign_out_completed",
		// Search events
		search_performed: "search.performed",
		command_palette_opened: "command_palette.opened",
		command_palette_navigation: "command_palette.navigation",
		// Filter events
		filter_applied: "filter.applied",
		filter_cleared: "filter.cleared",
		// UI events
		theme_switched: "ui.theme_switched",
		sidebar_mode_switched: "ui.sidebar_mode_switched",
		accordion_toggled: "ui.accordion_toggled",
		// External link events
		external_link_clicked: "external_link.clicked",
		discord_link_clicked: "external_link.discord",
		podcast_subscribe_clicked: "external_link.podcast_subscribe",
		// Game events
		game_started: "game.started",
		game_completed: "game.completed",
		game_failed: "game.failed",
		achievement_unlocked: "game.achievement_unlocked",
	};

	const cloudEventType = eventTypeMap[event] || `custom.${event}`;

	const cloudEvent = createCloudEvent(cloudEventType, "rawkode-academy-website", {
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
		"user.identified",
		"rawkode-academy-website",
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
