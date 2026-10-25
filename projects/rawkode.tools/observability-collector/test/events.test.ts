import { describe, expect, test } from "bun:test";
import schema from "../basin/schema.json";
import {
	classifyUserAgent,
	rowFromCloudEvent,
	rowFromException,
	rowFromMetric,
	rowFromWebEvent,
	toStreamRecord,
} from "../src/events";

const CHROME_MAC =
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const IPHONE_SAFARI =
	"Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

const fields = new Map(schema.fields.map((field) => [field.name, field]));

function expectMatchesSchema(record: Record<string, unknown>) {
	for (const field of schema.fields) {
		if (field.required) expect(record).toHaveProperty(field.name);
	}
	for (const [key, value] of Object.entries(record)) {
		const field = fields.get(key);
		expect(field, `unexpected field ${key}`).toBeDefined();
		switch (field?.type) {
			case "string":
				expect(typeof value).toBe("string");
				break;
			case "bool":
				expect(typeof value).toBe("boolean");
				break;
			case "int32":
			case "int64":
				expect(Number.isInteger(value)).toBe(true);
				break;
		}
	}
}

describe("classifyUserAgent", () => {
	test("desktop chrome", () => {
		expect(classifyUserAgent(CHROME_MAC)).toEqual({
			device: "desktop",
			browser: "chrome",
			is_bot: false,
		});
	});

	test("mobile safari", () => {
		expect(classifyUserAgent(IPHONE_SAFARI)).toEqual({
			device: "mobile",
			browser: "safari",
			is_bot: false,
		});
	});

	test("crawlers and empty agents are bots", () => {
		expect(classifyUserAgent("Googlebot/2.1").is_bot).toBe(true);
		expect(classifyUserAgent("curl/8.4.0").is_bot).toBe(true);
		expect(classifyUserAgent("").is_bot).toBe(true);
	});

	test("an unknown agent is not a bot", () => {
		expect(classifyUserAgent(undefined)).toEqual({
			device: null,
			browser: null,
			is_bot: false,
		});
	});
});

describe("rowFromCloudEvent", () => {
	const linkRedirect = {
		specversion: "1.0",
		id: "evt-1",
		source: "rawkode-link",
		type: "link.redirect",
		time: "2026-10-25T12:00:00.000Z",
		data: {
			domain: "rawkode.link",
			path: "discord",
			referrer: "https://www.youtube.com/watch?v=abc",
			country: "GB",
			continent: "EU",
			user_agent: CHROME_MAC,
		},
	};

	test("uses the PostHog event name and promotes known fields", () => {
		const row = rowFromCloudEvent(linkRedirect);
		expect(row.event).toBe("rawkode-link.link.redirect");
		expect(row.ts_ms).toBe(Date.parse("2026-10-25T12:00:00.000Z"));
		expect(row.url_host).toBe("rawkode.link");
		expect(row.url_path).toBe("discord");
		expect(row.referrer_host).toBe("www.youtube.com");
		expect(row.country).toBe("GB");
		expect(row.device).toBe("desktop");
		expect(row.properties_json).toBeNull();
	});

	test("never stores the raw user agent", () => {
		const row = rowFromCloudEvent(linkRedirect);
		expect(JSON.stringify(row)).not.toContain("Macintosh");
	});

	test("resolves distinct_id the way the PostHog flush does", () => {
		const row = rowFromCloudEvent({
			id: "evt-2",
			source: "rawkode-academy-website",
			type: "auth.sign_in_completed",
			data: { user_id: "user-1", distinct_id: "ph-anon", method: "github" },
		});
		expect(row.distinct_id).toBe("user-1");
		expect(row.user_id).toBe("user-1");
		expect(JSON.parse(row.properties_json ?? "{}")).toEqual({
			method: "github",
		});
	});

	test("matches the stream schema", () => {
		expectMatchesSchema(toStreamRecord(rowFromCloudEvent(linkRedirect)));
	});
});

describe("rowFromWebEvent", () => {
	const pageView = {
		event_id: "web-1",
		ts_ms: 1761393600000,
		event: "page_view",
		anonymous_id: "anon-1",
		session_id: "sess-1",
		url: "https://rawkode.academy/watch/foo?utm_source=YouTube&utm_medium=video",
		referrer: "https://www.google.com/",
		properties: { title: "Foo" },
	};

	test("parses the URL into host, path and UTM columns", () => {
		const row = rowFromWebEvent(pageView, {
			user_agent: CHROME_MAC,
			country: "US",
		});
		expect(row?.source).toBe("web");
		expect(row?.url_host).toBe("rawkode.academy");
		expect(row?.url_path).toBe("/watch/foo");
		expect(row?.utm_source).toBe("YouTube");
		expect(row?.referrer_host).toBe("www.google.com");
		expect(row?.distinct_id).toBe("anon-1");
		expect(row?.is_bot).toBe(false);
	});

	test("the signed-in user wins distinct_id", () => {
		const row = rowFromWebEvent(pageView, { user_id: "user-9" });
		expect(row?.distinct_id).toBe("user-9");
	});

	test("rejects events without an id or name", () => {
		expect(rowFromWebEvent({ ...pageView, event_id: "" }, {})).toBeNull();
		expect(rowFromWebEvent({ ...pageView, event: "" }, {})).toBeNull();
	});

	test("caps oversized properties", () => {
		const row = rowFromWebEvent(
			{ ...pageView, properties: { blob: "x".repeat(20_000) } },
			{},
		);
		expect(JSON.parse(row?.properties_json ?? "{}")._truncated).toBe(true);
	});

	test("matches the stream schema", () => {
		const row = rowFromWebEvent(pageView, { user_agent: CHROME_MAC });
		expectMatchesSchema(toStreamRecord(row!));
	});
});

describe("metrics and exceptions", () => {
	test("both match the stream schema", () => {
		expectMatchesSchema(
			toStreamRecord(
				rowFromMetric({
					name: "kubele.solve_time",
					value: 42,
					attributes: { userId: "u1", puzzle: "7" },
				}),
			),
		);
		expectMatchesSchema(
			toStreamRecord(
				rowFromException({
					message: "boom",
					name: "TypeError",
					timestamp: new Date().toISOString(),
				}),
			),
		);
	});
});
