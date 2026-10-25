// First-party analytics: batches browser events to /api/e, which forwards them
// to the Basin `analytics_events` stream through the observability collector.
//
// During the PostHog dual-run, call `capture()` so each event reaches both.

const ENDPOINT = "/api/e";
const ANON_COOKIE = "rk_aid";
const SESSION_KEY = "rk_sid";
const SESSION_IDLE_MS = 30 * 60 * 1000;
const FLUSH_DELAY_MS = 2000;
const MAX_BATCH = 50;

export interface TrackedEvent {
	event_id: string;
	ts_ms: number;
	event: string;
	anonymous_id: string;
	session_id: string;
	distinct_id?: string;
	url: string;
	referrer?: string;
	properties?: Record<string, unknown>;
}

type PostHogLike = {
	capture?: (event: string, properties?: Record<string, unknown>) => void;
};

let queue: TrackedEvent[] = [];
let timer: ReturnType<typeof setTimeout> | undefined;
let listening = false;

function readCookie(name: string): string | undefined {
	const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
	if (!match?.[1]) return undefined;
	try {
		return decodeURIComponent(match[1]);
	} catch {
		return match[1];
	}
}

function anonymousId(): string {
	let id = readCookie(ANON_COOKIE);
	if (!id) id = crypto.randomUUID();
	// Refresh the year-long expiry on every visit.
	document.cookie = `${ANON_COOKIE}=${encodeURIComponent(id)}; path=/; max-age=31536000; SameSite=Lax; Secure`;
	return id;
}

function sessionId(now: number): string {
	try {
		const stored = JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? "null") as
			| { id: string; seen: number }
			| null;
		const id =
			stored && now - stored.seen < SESSION_IDLE_MS
				? stored.id
				: crypto.randomUUID();
		sessionStorage.setItem(SESSION_KEY, JSON.stringify({ id, seen: now }));
		return id;
	} catch {
		return "no-storage";
	}
}

function trackingDisabled(): boolean {
	return (
		navigator.doNotTrack === "1" ||
		(window as Window & { doNotTrack?: string }).doNotTrack === "1"
	);
}

function send(events: TrackedEvent[], unloading: boolean): void {
	const body = JSON.stringify({ events });
	if (unloading && navigator.sendBeacon) {
		const sent = navigator.sendBeacon(
			ENDPOINT,
			new Blob([body], { type: "application/json" }),
		);
		if (sent) return;
	}
	fetch(ENDPOINT, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body,
		keepalive: true,
		credentials: "same-origin",
	}).catch(() => {
		// Analytics must never surface an error to the reader.
	});
}

export function flush(unloading = false): void {
	if (timer) {
		clearTimeout(timer);
		timer = undefined;
	}
	while (queue.length > 0) {
		send(queue.splice(0, MAX_BATCH), unloading);
	}
}

function listenForUnload(): void {
	if (listening) return;
	listening = true;
	addEventListener("pagehide", () => flush(true));
	document.addEventListener("visibilitychange", () => {
		if (document.visibilityState === "hidden") flush(true);
	});
}

export function track(event: string, properties?: Record<string, unknown>): void {
	if (typeof window === "undefined") return;
	try {
		if (trackingDisabled()) return;
		const now = Date.now();
		const distinctId = readCookie("posthog_distinct_id");
		queue.push({
			event_id: crypto.randomUUID(),
			ts_ms: now,
			event,
			anonymous_id: anonymousId(),
			session_id: sessionId(now),
			...(distinctId ? { distinct_id: distinctId } : {}),
			url: location.href,
			...(document.referrer ? { referrer: document.referrer } : {}),
			...(properties && Object.keys(properties).length > 0
				? { properties }
				: {}),
		});
		listenForUnload();
		if (queue.length >= MAX_BATCH) {
			flush();
		} else if (!timer) {
			timer = setTimeout(() => flush(), FLUSH_DELAY_MS);
		}
	} catch {
		// Ignore tracking errors on the client.
	}
}

/** Send to PostHog and Basin. Drop the PostHog call at cutover. */
export function capture(
	event: string,
	properties?: Record<string, unknown>,
): void {
	if (typeof window === "undefined") return;
	try {
		(window as Window & { posthog?: PostHogLike }).posthog?.capture?.(
			event,
			properties,
		);
	} catch {
		// Ignore tracking errors on the client.
	}
	track(event, properties);
}

/** Test hook: drop queued events and timers. */
export function resetForTests(): void {
	queue = [];
	if (timer) clearTimeout(timer);
	timer = undefined;
}
