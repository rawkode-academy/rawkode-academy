// First-party analytics: batches browser events to /api/e, which forwards them
// to the Basin `analytics_events` stream through the observability collector.
//
// During the PostHog dual-run, call `capture()` so each event reaches both.

import {
	campaignAttributionProperties,
	clearCampaignAttribution,
} from "./attribution-cookies";

const ENDPOINT = "/api/e";
const ANON_COOKIE = "rk_aid";
const SESSION_KEY = "rk_sid";
const SESSION_IDLE_MS = 30 * 60 * 1000;
const FLUSH_DELAY_MS = 2000;
const MAX_BATCH = 50;
// /api/e rejects bodies over 64 KiB, and keepalive fetch and sendBeacon share
// a 64 KiB budget, so batches are cut by size, leaving room for the envelope.
const MAX_BATCH_BYTES = 60 * 1024;
// The collector keeps at most 8 KB of properties per event anyway.
const MAX_EVENT_BYTES = 8 * 1024;

export interface TrackedEvent {
	event_id: string;
	ts_ms: number;
	event: string;
	anonymous_id: string;
	session_id: string;
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
let identityGeneration = 0;
let fallbackAnonymousId: string | undefined;
let fallbackSession: { id: string; seen: number } | undefined;
const retryTimers = new Set<ReturnType<typeof setTimeout>>();
const MAX_RETRY_BATCHES = 20;

function readCookie(name: string): string | undefined {
	const prefix = `${name}=`;
	const cookie = document.cookie
		.split(";")
		.map((value) => value.trim())
		.find((value) => value.startsWith(prefix));
	const value = cookie?.slice(prefix.length);
	if (!value) return undefined;
	try {
		return decodeURIComponent(value);
	} catch {
		return value;
	}
}

function anonymousId(): string {
	let id = readCookie(ANON_COOKIE);
	if (!id) id = fallbackAnonymousId ?? crypto.randomUUID();
	fallbackAnonymousId = id;
	// Refresh the year-long expiry on every visit.
	document.cookie = `${ANON_COOKIE}=${encodeURIComponent(id)}; path=/; max-age=31536000; SameSite=Lax; Secure`;
	return id;
}

function sessionId(now: number): string {
	try {
		const stored = JSON.parse(
			sessionStorage.getItem(SESSION_KEY) ?? "null",
		) as { id: string; seen: number } | null;
		const id =
			stored && now - stored.seen < SESSION_IDLE_MS
				? stored.id
				: crypto.randomUUID();
		sessionStorage.setItem(SESSION_KEY, JSON.stringify({ id, seen: now }));
		return id;
	} catch {
		const id =
			fallbackSession && now - fallbackSession.seen < SESSION_IDLE_MS
				? fallbackSession.id
				: crypto.randomUUID();
		fallbackSession = { id, seen: now };
		return id;
	}
}

function trackingDisabled(): boolean {
	return (
		navigator.doNotTrack === "1" ||
		(window as Window & { doNotTrack?: string }).doNotTrack === "1"
	);
}

function send(
	events: TrackedEvent[],
	unloading: boolean,
	attempt = 0,
	generation = identityGeneration,
): void {
	if (trackingDisabled() || generation !== identityGeneration) return;
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
		signal: AbortSignal.timeout(5_000),
		credentials: "same-origin",
	})
		.then((response) => {
			if (response.status === 429 || response.status >= 500) retry();
		})
		.catch(retry);

	function retry() {
		if (
			generation !== identityGeneration ||
			attempt >= 3 ||
			trackingDisabled() ||
			retryTimers.size >= MAX_RETRY_BATCHES
		)
			return;
		const retryTimer = setTimeout(
			() => {
				retryTimers.delete(retryTimer);
				send(events, false, attempt + 1, generation);
			},
			1_000 * 2 ** attempt,
		);
		retryTimers.add(retryTimer);
	}
}

export function flush(unloading = false): void {
	if (timer) {
		clearTimeout(timer);
		timer = undefined;
	}
	const encoder = new TextEncoder();
	let batch: TrackedEvent[] = [];
	let batchBytes = 0;
	for (const queued of queue.splice(0)) {
		let event = queued;
		let bytes = encoder.encode(JSON.stringify(event)).byteLength;
		if (bytes > MAX_EVENT_BYTES && event.properties) {
			event = {
				...event,
				properties: { _truncated: true, keys: Object.keys(event.properties) },
			};
			bytes = encoder.encode(JSON.stringify(event)).byteLength;
		}
		if (bytes > MAX_EVENT_BYTES) continue;
		if (
			batch.length > 0 &&
			(batch.length >= MAX_BATCH || batchBytes + bytes > MAX_BATCH_BYTES)
		) {
			send(batch, unloading);
			batch = [];
			batchBytes = 0;
		}
		batch.push(event);
		batchBytes += bytes + 1;
	}
	if (batch.length > 0) send(batch, unloading);
}

function listenForUnload(): void {
	if (listening) return;
	listening = true;
	addEventListener("pagehide", () => flush(true));
	document.addEventListener("visibilitychange", () => {
		if (document.visibilityState === "hidden") flush(true);
	});
}

export function track(
	event: string,
	properties?: Record<string, unknown>,
): void {
	if (typeof window === "undefined") return;
	try {
		if (trackingDisabled()) return;
		const now = Date.now();
		queue.push({
			event_id: crypto.randomUUID(),
			ts_ms: now,
			event,
			anonymous_id: anonymousId(),
			session_id: sessionId(now),
			url: location.href,
			...(document.referrer ? { referrer: document.referrer } : {}),
			properties: { ...campaignAttributionProperties(), ...properties },
		});
		listenForUnload();
		// web-vitals reports final CLS/INP after the page is hidden, when a
		// timer may never fire.
		if (document.visibilityState === "hidden") {
			flush(true);
		} else if (queue.length >= MAX_BATCH) {
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
	if (typeof window === "undefined" || trackingDisabled()) return;
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

/** Start a fresh first-party identity after a successful sign-out. */
export function resetIdentity(): void {
	resetForTests();
	clearCampaignAttribution();
	document.cookie = `${ANON_COOKIE}=; path=/; max-age=0; SameSite=Lax; Secure`;
	try {
		sessionStorage.removeItem(SESSION_KEY);
	} catch {
		/* Storage may be blocked. */
	}
}

/** Drop queued events and timers; also used by identity reset. */
export function resetForTests(): void {
	queue = [];
	identityGeneration++;
	fallbackAnonymousId = undefined;
	fallbackSession = undefined;
	for (const retryTimer of retryTimers) clearTimeout(retryTimer);
	retryTimers.clear();
	if (timer) clearTimeout(timer);
	timer = undefined;
}
