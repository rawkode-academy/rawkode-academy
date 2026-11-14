export const UTM_KEYS = [
	"utm_source",
	"utm_medium",
	"utm_campaign",
	"utm_term",
	"utm_content",
] as const;

export type UtmKey = (typeof UTM_KEYS)[number];

export type CampaignAttribution = Partial<
	Record<UtmKey, string> & {
		landing_page: string;
		initial_referrer: string;
	}
>;

const ATTRIBUTION_SESSION_KEY = "growth:campaign-attribution";
const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/;
const encoder = new TextEncoder();
function bounded(value: string, maximum = 128): string | undefined {
	const trimmed = value.trim();
	if (!trimmed || EMAIL.test(trimmed) || /[\u0000-\u001f\u007f]/.test(trimmed))
		return;
	let output = "",
		bytes = 0;
	for (const character of trimmed) {
		bytes += encoder.encode(character).byteLength;
		if (bytes > maximum) break;
		output += character;
	}
	return output || undefined;
}
function sanitizeLocation(value: string): string | undefined {
	try {
		const url = new URL(value, "https://rawkode.academy");
		if (url.protocol !== "http:" && url.protocol !== "https:") return;
		return getSanitizedLandingPage(url);
	} catch {
		return;
	}
}
function sanitizeReferrer(value: string): string | undefined {
	try {
		const url = new URL(value);
		if (url.protocol !== "http:" && url.protocol !== "https:") return;
		return `${url.origin}/`.slice(0, 256);
	} catch {
		return;
	}
}
function disabled(): boolean {
	return (
		typeof window !== "undefined" &&
		(navigator.doNotTrack === "1" ||
			(window as Window & { doNotTrack?: string }).doNotTrack === "1")
	);
}

function normalizeCampaignAttribution(
	input: Record<string, unknown> | CampaignAttribution | null | undefined,
): CampaignAttribution {
	if (!input) return {};

	const normalized: CampaignAttribution = {};
	for (const key of [
		"landing_page",
		"initial_referrer",
		...UTM_KEYS,
	] as const) {
		const value = input[key];
		if (typeof value === "string") {
			const sanitized =
				key === "landing_page"
					? sanitizeLocation(value)
					: key === "initial_referrer"
						? sanitizeReferrer(value)
						: bounded(value);
			if (sanitized) normalized[key] = sanitized;
		}
	}

	return normalized;
}

export function parseCampaignAttribution(
	serialized?: string | null,
): CampaignAttribution {
	if (!serialized) return {};

	try {
		const parsed = JSON.parse(serialized);
		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
			return {};
		return normalizeCampaignAttribution(parsed as Record<string, unknown>);
	} catch {
		return {};
	}
}

export function serializeCampaignAttribution(
	attribution?: CampaignAttribution,
): string | undefined {
	const normalized = normalizeCampaignAttribution(attribution);
	return Object.keys(normalized).length > 0
		? JSON.stringify(normalized)
		: undefined;
}

function getSanitizedLandingPage(url: URL): string {
	const allowedParams = new URLSearchParams();
	for (const key of UTM_KEYS) {
		const value = url.searchParams.get(key);
		const safe = value ? bounded(value) : undefined;
		if (safe) allowedParams.set(key, safe);
	}
	let path = url.pathname
		.replace(
			/(\/(?:reset-password|reset|verify-email|verify|magic-link|callback))(\/.*)$/i,
			"$1/[redacted]",
		)
		.slice(0, 512);
	try {
		if (EMAIL.test(decodeURIComponent(path))) path = "/[redacted]";
	} catch {
		return "/[redacted]";
	}
	const query = allowedParams.toString();
	return query ? `${path}?${query}` : path;
}

export function getCurrentCampaignAttribution(): CampaignAttribution {
	if (typeof window === "undefined" || disabled()) return {};

	try {
		const url = new URL(window.location.href);
		const current = normalizeCampaignAttribution({
			landing_page: getSanitizedLandingPage(url),
			initial_referrer: document.referrer || undefined,
		});

		for (const key of UTM_KEYS) {
			const value = url.searchParams.get(key);
			const safe = value ? bounded(value) : undefined;
			if (safe) current[key] = safe;
		}

		return current;
	} catch {
		return {};
	}
}

export function getSessionCampaignAttribution(): CampaignAttribution {
	if (disabled()) return {};
	const current = getCurrentCampaignAttribution();
	if (typeof window === "undefined") return current;

	try {
		const stored = parseCampaignAttribution(
			window.sessionStorage.getItem(ATTRIBUTION_SESSION_KEY),
		);
		const hasCurrentUtms = UTM_KEYS.some((key) => current[key] !== undefined);
		const merged = normalizeCampaignAttribution(
			hasCurrentUtms
				? {
						landing_page: stored.landing_page ?? current.landing_page,
						initial_referrer:
							stored.initial_referrer ?? current.initial_referrer,
						utm_source: current.utm_source,
						utm_medium: current.utm_medium,
						utm_campaign: current.utm_campaign,
						utm_term: current.utm_term,
						utm_content: current.utm_content,
					}
				: {
						landing_page: stored.landing_page ?? current.landing_page,
						initial_referrer:
							stored.initial_referrer ?? current.initial_referrer,
						utm_source: stored.utm_source,
						utm_medium: stored.utm_medium,
						utm_campaign: stored.utm_campaign,
						utm_term: stored.utm_term,
						utm_content: stored.utm_content,
					},
		);
		const serialized = serializeCampaignAttribution(merged);
		if (serialized) {
			window.sessionStorage.setItem(ATTRIBUTION_SESSION_KEY, serialized);
		}
		return merged;
	} catch {
		return current;
	}
}
