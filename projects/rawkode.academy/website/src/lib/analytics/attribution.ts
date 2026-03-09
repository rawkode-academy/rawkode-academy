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
const SENSITIVE_QUERY_PARAMS = new Set(["email", "token", "code", "state"]);

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
			const trimmed = value.trim();
			if (trimmed) {
				normalized[key] = trimmed;
			}
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
		if (!parsed || typeof parsed !== "object") return {};
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
		if (value) {
			allowedParams.set(key, value);
		}
	}

	for (const key of url.searchParams.keys()) {
		if (SENSITIVE_QUERY_PARAMS.has(key)) {
			continue;
		}
	}

	const query = allowedParams.toString();
	return query ? `${url.pathname}?${query}` : url.pathname;
}

function getCurrentCampaignAttribution(): CampaignAttribution {
	if (typeof window === "undefined") return {};

	try {
		const url = new URL(window.location.href);
		const current = normalizeCampaignAttribution({
			landing_page: getSanitizedLandingPage(url),
			initial_referrer: document.referrer || undefined,
		});

		for (const key of UTM_KEYS) {
			const value = url.searchParams.get(key);
			if (value) {
				current[key] = value;
			}
		}

		return current;
	} catch {
		return {};
	}
}

export function getSessionCampaignAttribution(): CampaignAttribution {
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
