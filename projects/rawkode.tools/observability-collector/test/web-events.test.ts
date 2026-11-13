import { describe, expect, test } from "bun:test";
import { browserCloudEvent } from "../src/web-events";
import { validateCloudEvent } from "../src/cloudevents";
const now = Date.parse("2026-11-13T12:00:00Z");
const context = {
	url_origin: "https://rawkode.academy",
	user_id: "trusted-user",
	user_agent: "Mozilla/5.0 Chrome/130.0",
	country: "GB",
	continent: "EU",
};
const event = {
	event_id: "event-1",
	anonymous_id: "anon-1",
	session_id: "session-1",
	ts_ms: now,
	event: "page_view",
	url: "https://rawkode.academy/watch/example?utm_source=youtube&token=private#private",
	referrer: "https://youtube.com/watch?v=private",
	properties: { title: "Example" },
};

describe("browser CloudEvent v1", () => {
	test("produces a valid versioned CloudEvent with stable IDs and trusted context", () => {
		const normalized = browserCloudEvent(
			{ ...event, user_id: "forged", distinct_id: "forged", country: "forged" },
			context,
			now,
		);
		expect(validateCloudEvent(normalized).valid).toBe(true);
		expect(normalized).toMatchObject({
			id: "event-1",
			source: "rawkode-academy-browser",
			type: "web.page_view",
			schemaversion: 1,
			country: "GB",
			data: {
				schema_version: 1,
				user_id: "trusted-user",
				distinct_id: "trusted-user",
				anonymous_id: "anon-1",
				session_id: "session-1",
				url_host: "rawkode.academy",
				url_path: "/watch/example",
				utm_source: "youtube",
				referrer_host: "youtube.com",
			},
		});
		expect(JSON.stringify(normalized)).not.toContain("private");
		expect(JSON.stringify(normalized)).not.toContain("Mozilla");
	});
	test("anonymous identity is independent of PostHog", () => {
		const normalized = browserCloudEvent(
			{ ...event, distinct_id: "posthog-id" },
			{ ...context, user_id: undefined },
			now,
		);
		expect(normalized?.data).toMatchObject({ distinct_id: "anon-1" });
	});
	test("strips credentials, emails and query strings recursively", () => {
		const normalized = browserCloudEvent(
			{
				...event,
				properties: {
					password: "secret",
					nested: {
						access_token: "secret",
						email: "reader@example.com",
						url: "https://example.com/path?token=secret",
						search_query: "private question",
					},
					label: "reader@example.com",
				},
			},
			context,
			now,
		);
		expect(normalized?.data).toMatchObject({
			properties: {
				nested: { url: "https://example.com/path", search_query_length: 16 },
				label: "[redacted]",
			},
		});
		expect(JSON.stringify(normalized)).not.toContain("secret");
	});
	test("drops bots, cross-origin pages, malformed IDs and unbounded payloads", () => {
		for (const input of [
			null,
			[],
			{ ...event, event_id: "" },
			{ ...event, session_id: "" },
			{ ...event, ts_ms: NaN },
			{ ...event, ts_ms: now + 600_000 },
			{ ...event, ts_ms: now - 8 * 86_400_000 },
			{ ...event, url: "https://evil.example/" },
			{ ...event, properties: { text: "x".repeat(9000) } },
		])
			expect(browserCloudEvent(input, context, now)).toBeNull();
		expect(
			browserCloudEvent(
				event,
				{ ...context, user_agent: "Googlebot/2.1" },
				now,
			),
		).toBeNull();
	});
	test("keeps event ID and time stable across retries", () => {
		expect(browserCloudEvent(event, context, now)).toEqual(
			browserCloudEvent(event, context, now + 60_000),
		);
	});
});
