import { CloudEvent } from "cloudevents";
import {
	parseCampaignAttribution,
	type CampaignAttribution,
} from "@/lib/analytics/attribution";
import { createLogger } from "@/lib/logger";

const logger = createLogger("analytics");

export type CaptureOptions = {
	event: string;
	properties?: Record<string, unknown> | undefined;
	distinctId?: string | undefined;
};

export type AnalyticsAttribution = {
	source?: string;
	source_system?: string;
	source_surface?: string;
	source_context?: string;
	page_path?: string;
};

function cookieValue(header: string, name: string): string | undefined {
	const prefix = `${name}=`;
	return header
		.split(";")
		.map((part) => part.trim())
		.find((part) => part.startsWith(prefix))
		?.slice(prefix.length);
}

/** Only first-party anonymous IDs belong in analytics; never use an auth cookie. */
export function getAnonDistinctIdFromCookies(req: Request): string | undefined {
	if (req.headers.get("dnt") === "1") return;
	const raw = cookieValue(req.headers.get("cookie") ?? "", "rk_aid");
	if (!raw) return;
	try {
		const value = decodeURIComponent(raw);
		return /^[a-zA-Z0-9._:-]{1,128}$/.test(value) ? value : undefined;
	} catch {
		return;
	}
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

type AttributionSnapshot = CampaignAttribution;
function parseAttributionCookie(raw?: string): AttributionSnapshot | undefined {
	if (!raw) return;
	try {
		const snapshot = parseCampaignAttribution(decodeURIComponent(raw));
		return Object.keys(snapshot).length ? snapshot : undefined;
	} catch {
		return;
	}
}

/**
 * Read the `rk_first_touch` and `rk_last_touch` cookies written by the
 * first-party analytics component. Use these to attach campaign attribution to
 * server-emitted funnel events without requiring every CTA call site to pass
 * it explicitly.
 */
export function getAttributionFromCookies(req: Request): {
	first?: AttributionSnapshot;
	last?: AttributionSnapshot;
} {
	if (req.headers.get("dnt") === "1") return {};
	const cookieHeader = req.headers.get("cookie");
	if (!cookieHeader) return {};
	const first = parseAttributionCookie(
		cookieValue(cookieHeader, "rk_first_touch"),
	);
	const last = parseAttributionCookie(
		cookieValue(cookieHeader, "rk_last_touch"),
	);

	return {
		...(first ? { first } : {}),
		...(last ? { last } : {}),
	};
}

/**
 * Build the canonical event-attribution properties for funnel events.
 * Flattens the two attribution snapshots into `first_touch_*` / `last_touch_*`
 * keys so analytics can group on them without parsing nested objects.
 */
export function getEventAttribution(req?: Request): Record<string, string> {
	if (!req) return {};
	const { first, last } = getAttributionFromCookies(req);
	const out: Record<string, string> = {};
	if (first) {
		for (const [k, v] of Object.entries(first)) {
			if (typeof v === "string" && v) {
				out[`first_touch_${k}`] = v;
			}
		}
	}
	if (last) {
		for (const [k, v] of Object.entries(last)) {
			if (typeof v === "string" && v) {
				out[`last_touch_${k}`] = v;
			}
		}
	}
	return out;
}

export function getAttributionFromSource(
	source?: string,
): AnalyticsAttribution {
	if (!source) return {};

	const [sourceSystem, sourceSurface, ...rest] = source.split(":");
	const lastSegment = rest.at(-1);
	const pagePath = lastSegment?.startsWith("/") ? lastSegment : undefined;
	const sourceContext = pagePath ? rest.slice(0, -1).join(":") : rest.join(":");

	return {
		source,
		...(sourceSystem ? { source_system: sourceSystem } : {}),
		...(sourceSurface ? { source_surface: sourceSurface } : {}),
		...(sourceContext ? { source_context: sourceContext } : {}),
		...(pagePath ? { page_path: pagePath } : {}),
	};
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
		// Growth events
		activated_user: "growth.activated_user",
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
		lead_magnet_clicked: "lead_magnet.clicked",
		lead_magnet_submission_attempted: "lead_magnet.submission_attempted",
		lead_magnet_signup: "lead_magnet.signup",
		newsletter_cta_impression: "newsletter.cta_impression",
		newsletter_cta_clicked: "newsletter.cta_clicked",
		newsletter_submission_attempted: "newsletter.submission_attempted",
		newsletter_subscribed: "newsletter.subscribed",
		newsletter_unsubscribed: "newsletter.unsubscribed",
		newsletter_preference_updated: "newsletter.preference_updated",
		newsletter_unsubscribe_all: "newsletter.unsubscribe_all",
		// Auth events
		sign_in_initiated: "auth.sign_in_initiated",
		sign_in_completed: "auth.sign_in_completed",
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

	const cloudEvent = createCloudEvent(
		cloudEventType,
		"rawkode-academy-website",
		{
			...properties,
			distinct_id: distinctId ?? "anonymous",
		},
	);

	// Determine which attributes to promote to PostHog properties
	const attributesToPromote = [
		"distinct_id",
		"video_id",
		"content_id",
		"audience",
		"audience_id",
		"channel",
		"status",
		"subscriber_type",
		"already_subscribed",
		"is_authenticated",
		"entry_point",
		"lead_magnet",
		"method",
		"auth_method",
		"return_to",
		"allow_sponsor_contact",
		"activation_trigger",
		"activation_surface",
		"activation_context",
		"source",
		"source_context",
		"page_path",
		"source_surface",
		"source_system",
		"landing_page",
		"initial_referrer",
		"utm_source",
		"utm_medium",
		"utm_campaign",
		"utm_term",
		"utm_content",
		"first_touch_utm_source",
		"first_touch_utm_medium",
		"first_touch_utm_campaign",
		"first_touch_utm_term",
		"first_touch_utm_content",
		"first_touch_landing_page",
		"first_touch_initial_referrer",
		"last_touch_utm_source",
		"last_touch_utm_medium",
		"last_touch_utm_campaign",
		"last_touch_utm_term",
		"last_touch_utm_content",
		"last_touch_landing_page",
		"last_touch_initial_referrer",
	];

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
