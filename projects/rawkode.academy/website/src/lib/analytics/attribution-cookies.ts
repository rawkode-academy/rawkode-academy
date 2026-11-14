import {
	getCurrentCampaignAttribution,
	parseCampaignAttribution,
	UTM_KEYS,
	type CampaignAttribution,
} from "./attribution";
const FIRST = "rk_first_touch",
	LAST = "rk_last_touch";
const YEAR = 365 * 24 * 60 * 60,
	MONTH = 30 * 24 * 60 * 60;
type Touch = { data: CampaignAttribution; capturedAt: number };
let memoryFirst: Touch | undefined,
	memoryLast: Touch | undefined,
	initializedHref: string | undefined;
function disabled() {
	return (
		typeof window === "undefined" ||
		navigator.doNotTrack === "1" ||
		(window as Window & { doNotTrack?: string }).doNotTrack === "1"
	);
}
function read(name: string, maxAge: number, now: number): Touch | undefined {
	try {
		const prefix = `${name}=`;
		const raw = document.cookie
			.split(";")
			.map((part) => part.trim())
			.find((part) => part.startsWith(prefix))
			?.slice(prefix.length);
		if (!raw) return;
		const decoded = decodeURIComponent(raw),
			payload = JSON.parse(decoded);
		const capturedAt = Date.parse(payload.captured_at),
			data = parseCampaignAttribution(decoded);
		if (
			!Number.isFinite(capturedAt) ||
			capturedAt > now + 300_000 ||
			now - capturedAt >= maxAge * 1000 ||
			!Object.keys(data).length
		)
			return;
		return { data, capturedAt: Math.min(capturedAt, now) };
	} catch {
		return;
	}
}
function valid(touch: Touch | undefined, ttl: number, now: number) {
	return touch && now - touch.capturedAt < ttl * 1000 ? touch : undefined;
}
function write(name: string, touch: Touch, ttl: number, now: number) {
	const encoded = encodeURIComponent(
		JSON.stringify({
			...touch.data,
			captured_at: new Date(touch.capturedAt).toISOString(),
			schema_version: 1,
		}),
	);
	if (encoded.length > 3500) return;
	const remaining = Math.max(
		1,
		Math.floor(ttl - (now - touch.capturedAt) / 1000),
	);
	try {
		document.cookie = `${name}=${encoded}; path=/; max-age=${remaining}; SameSite=Lax${window.location.protocol === "https:" ? "; Secure" : ""}`;
	} catch {
		/* In-memory attribution remains usable when cookies are blocked. */
	}
}

/** Owned by first-party analytics; PostHog only consumes the resulting cookies. */
export function persistCampaignAttribution(now = Date.now()) {
	if (disabled()) return {};
	const current = getCurrentCampaignAttribution();
	let first = read(FIRST, YEAR, now) ?? valid(memoryFirst, YEAR, now);
	let last = read(LAST, MONTH, now) ?? valid(memoryLast, MONTH, now);
	if (initializedHref === window.location.href && first) return { first, last };
	if (!Object.keys(current).length) return { first, last };
	first ??= { data: current, capturedAt: now };
	if (UTM_KEYS.some((key) => current[key] !== undefined))
		last = { data: current, capturedAt: now };
	write(FIRST, first, YEAR, now);
	if (last) write(LAST, last, MONTH, now);
	memoryFirst = first;
	memoryLast = last;
	initializedHref = window.location.href;
	window.dispatchEvent(new Event("rk:attribution"));
	return { first, last };
}
export function campaignAttributionProperties(): Record<string, string> {
	const { first, last } = persistCampaignAttribution();
	const properties: Record<string, string> = {};
	for (const [prefix, touch] of [
		["first_touch", first],
		["last_touch", last],
	] as const) {
		if (!touch) continue;
		for (const [key, value] of Object.entries(touch.data))
			if (value) properties[`${prefix}_${key}`] = value;
		properties[`${prefix}_captured_at`] = new Date(
			touch.capturedAt,
		).toISOString();
	}
	return properties;
}
export function clearCampaignAttribution() {
	memoryFirst = undefined;
	memoryLast = undefined;
	initializedHref = undefined;
	if (typeof window === "undefined") return;
	for (const name of [FIRST, LAST]) {
		try {
			document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax${window.location.protocol === "https:" ? "; Secure" : ""}`;
		} catch {
			/* Storage may be blocked. */
		}
	}
	try {
		sessionStorage.removeItem("growth:campaign-attribution");
	} catch {
		/* Storage may be blocked. */
	}
}
