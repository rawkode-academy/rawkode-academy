import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	campaignAttributionProperties,
	clearCampaignAttribution,
	persistCampaignAttribution,
} from "@/lib/analytics/attribution-cookies";
import {
	getAnonDistinctIdFromCookies,
	getAttributionFromCookies,
} from "@/server/analytics";

const NOW = Date.parse("2026-11-14T00:00:00Z");
const YEAR = 365 * 86400;
let jar: Map<string, string>;
let writes: string[];
function navigate(path: string) {
	window.history.replaceState({}, "", path);
}
function seed(name: string, payload: unknown) {
	jar.set(name, encodeURIComponent(JSON.stringify(payload)));
}
function request(cookie: string, dnt?: string) {
	return {
		headers: {
			get: (key: string) =>
				key === "cookie" ? cookie : key === "dnt" ? dnt : null,
		},
	} as Request;
}
beforeEach(() => {
	clearCampaignAttribution();
	jar = new Map();
	writes = [];
	vi.spyOn(document, "cookie", "get").mockImplementation(() =>
		[...jar].map(([k, v]) => `${k}=${v}`).join("; "),
	);
	vi.spyOn(document, "cookie", "set").mockImplementation((value) => {
		writes.push(value);
		const [pair] = value.split(";");
		const index = pair!.indexOf("=");
		const key = pair!.slice(0, index);
		if (value.includes("max-age=0;")) jar.delete(key);
		else jar.set(key, pair!.slice(index + 1));
	});
	Object.defineProperty(navigator, "doNotTrack", {
		value: null,
		configurable: true,
	});
	navigate("/watch?utm_source=first&utm_medium=email&token=secret");
	vi.spyOn(Date, "now").mockReturnValue(NOW);
});
afterEach(() => {
	vi.restoreAllMocks();
	clearCampaignAttribution();
});

describe("first-party attribution", () => {
	it("preserves first touch and atomically replaces last campaign without extending first expiry", () => {
		const first = persistCampaignAttribution(NOW);
		expect(first.first?.data).toMatchObject({
			utm_source: "first",
			utm_medium: "email",
			landing_page: "/watch?utm_source=first&utm_medium=email",
		});
		navigate("/new?utm_campaign=second");
		const next = persistCampaignAttribution(NOW + 86400000);
		expect(next.first).toEqual(first.first);
		expect(next.last?.data).toEqual({
			landing_page: "/new?utm_campaign=second",
			utm_campaign: "second",
		});
		expect(
			writes.filter((v) => v.startsWith("rk_first_touch=")).at(-1),
		).toContain(`max-age=${YEAR - 86400};`);
		navigate("/direct");
		expect(persistCampaignAttribution(NOW + 172800000).last).toEqual(next.last);
	});
	it("normalizes old cookies and keeps their original capture time", () => {
		seed("rk_first_touch", {
			captured_at: new Date(NOW - 86400000).toISOString(),
			landing_page: "/reset-password/secret?token=x&utm_source=safe",
			initial_referrer: "https://example.com/private?email=someone@example.com",
			utm_source: "someone@example.com",
			password: "secret",
		});
		const first = persistCampaignAttribution(NOW).first;
		expect(first?.capturedAt).toBe(NOW - 86400000);
		expect(first?.data).toEqual({
			landing_page: "/reset-password/[redacted]?utm_source=safe",
			initial_referrer: "https://example.com/",
		});
		expect(decodeURIComponent(jar.get("rk_first_touch")!)).not.toContain(
			"secret",
		);
	});
	it("discards expired and malformed snapshots", () => {
		seed("rk_first_touch", {
			captured_at: new Date(NOW - YEAR * 1000).toISOString(),
			utm_source: "expired",
		});
		seed("rk_last_touch", { captured_at: "bad", utm_source: "broken" });
		expect(persistCampaignAttribution(NOW).first?.data.utm_source).toBe(
			"first",
		);
	});
	it("attaches first and last touch without a PostHog SDK", () => {
		expect(campaignAttributionProperties()).toMatchObject({
			first_touch_utm_source: "first",
			last_touch_utm_medium: "email",
			first_touch_captured_at: new Date(NOW).toISOString(),
		});
	});
	it("does not read or write attribution when DNT is set", () => {
		Object.defineProperty(navigator, "doNotTrack", {
			value: "1",
			configurable: true,
		});
		const read = vi.spyOn(document, "cookie", "get");
		expect(campaignAttributionProperties()).toEqual({});
		expect(read).not.toHaveBeenCalled();
		expect(writes).toEqual([]);
	});
	it("keeps in-memory first touch if cookies are blocked", () => {
		vi.spyOn(document, "cookie", "set").mockImplementation(() => {
			throw new Error("blocked");
		});
		const original = persistCampaignAttribution(NOW).first;
		navigate("/other?utm_source=next");
		expect(persistCampaignAttribution(NOW + 1000).first).toEqual(original);
	});
	it("clears attribution and session campaign state on logout", () => {
		persistCampaignAttribution(NOW);
		sessionStorage.setItem("growth:campaign-attribution", "old");
		clearCampaignAttribution();
		expect(jar.size).toBe(0);
		expect(sessionStorage.getItem("growth:campaign-attribution")).toBeNull();
		navigate("/fresh");
		expect(persistCampaignAttribution(NOW + 1000).first?.data).toEqual({
			landing_page: "/fresh",
		});
	});
});

describe("server identity and attribution", () => {
	it("never uses PostHog or authentication session cookies as anonymous identity", () => {
		expect(
			getAnonDistinctIdFromCookies(
				request("posthog_distinct_id=ph; session_id=auth-secret"),
			),
		).toBeUndefined();
		expect(
			getAnonDistinctIdFromCookies(
				request("session_id=auth;rk_aid=first-party"),
			),
		).toBe("first-party");
		expect(
			getAnonDistinctIdFromCookies(request("rk_aid=first-party", "1")),
		).toBeUndefined();
	});
	it("sanitizes untrusted cookies and honors DNT", () => {
		const cookie = `rk_first_touch=${encodeURIComponent(JSON.stringify({ utm_source: "person@example.com", landing_page: "/watch?token=secret&utm_medium=email", initial_referrer: "https://example.com/private?token=x", password: "x" }))}`;
		expect(getAttributionFromCookies(request(cookie))).toEqual({
			first: {
				landing_page: "/watch?utm_medium=email",
				initial_referrer: "https://example.com/",
			},
		});
		expect(getAttributionFromCookies(request(cookie, "1"))).toEqual({});
	});
});
