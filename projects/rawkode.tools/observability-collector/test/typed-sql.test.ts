import { describe, expect, test } from "bun:test";
import typedSql from "../basin/typed.sql" with { type: "text" };
import { prepareCloudEvent } from "../src/events";
import { browserCloudEvent } from "../src/web-events";

const CHROME_MAC =
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const now = Date.parse("2026-11-24T12:00:00Z");

// A labelled bot carries every optional field: botreason and asn.
const shortLink = prepareCloudEvent({
	specversion: "1.0",
	id: "evt-1",
	source: "rawkode-link",
	type: "shortLink",
	time: "2026-11-07T18:12:08.315Z",
	referrer: "https://www.youtube.com/",
	country: "GB",
	continent: "EU",
	useragent: CHROME_MAC,
	asn: 132203,
	data: {
		domain: "rawkode.link",
		path: "discord",
		matched: true,
		destination: "https://discord.gg/rawkode",
	},
});

function browser(event: string, properties: Record<string, unknown>) {
	const normalized = browserCloudEvent(
		{
			event_id: `evt-${event}`,
			anonymous_id: "anon-1",
			session_id: "session-1",
			ts_ms: now,
			event,
			url: "https://rawkode.academy/watch/example?utm_source=youtube&utm_medium=video&utm_campaign=launch",
			referrer: "https://youtube.com/",
			properties,
		},
		{
			url_origin: "https://rawkode.academy",
			user_id: "user-1",
			user_agent: CHROME_MAC,
			country: "GB",
			continent: "EU",
			asn: 132203,
		},
		now,
	);
	if (!normalized) throw new Error(`${event} was rejected`);
	return normalized;
}

const click = {
	tag: "a",
	data_attr: "hero-cta",
	href: "/watch",
	text: "Watch now",
};

// One representative event per statement, keyed by the type it filters on.
const fixtures: Record<string, Record<string, unknown>> = {
	shortLink,
	"web.page_view": browser("page_view", { title: "Example" }),
	"web.click": browser("click", click),
	"web.page_leave": browser("page_leave", {
		time_on_page_ms: 12_000,
		max_scroll_pct: 80,
	}),
	"web.exception": browser("exception", {
		type: "TypeError",
		message: "x is undefined",
		stack: "TypeError: x is undefined\n    at https://rawkode.academy/app.js:1:1",
		source: "onerror",
	}),
	"web.web_vitals": browser("web_vitals", {
		name: "LCP",
		value: 1234.5,
		rating: "good",
		navigation_type: "navigate",
	}),
};

const statements = typedSql
	.split(";")
	.map((statement) => statement.trim())
	.filter(Boolean);

describe("typed pipeline", () => {
	test("has one statement per sink", () => {
		const sinks = statements.map(
			(statement) => /^INSERT INTO (\w+)/.exec(statement)?.[1],
		);
		expect(sinks).toEqual([
			"short_link_redirects",
			"web_page_views",
			"web_clicks",
			"web_page_leaves",
			"web_exceptions",
			"web_vitals",
		]);
	});

	for (const statement of statements) {
		const sink = /^INSERT INTO (\w+)/.exec(statement)?.[1];
		const type = /'type'\) (?:=|IN \() ?'([^']+)'/.exec(statement)?.[1];
		test(`${sink} reads only fields its events carry`, () => {
			expect(type).toBeDefined();
			const event = fixtures[type as string];
			expect(event, String(type)).toBeDefined();
			const paths = [
				...statement.matchAll(/json_get_\w+\(value, ([^)]+)\)/g),
			].map((match) =>
				match[1].split(",").map((key) => key.trim().slice(1, -1)),
			);
			expect(paths.length).toBeGreaterThan(0);
			for (const path of paths) {
				const value = path.reduce<unknown>(
					(node, key) => (node as Record<string, unknown> | undefined)?.[key],
					event,
				);
				expect(value, path.join(".")).toBeDefined();
			}
		});
	}

	test("browser statements filter on the browser source", () => {
		for (const statement of statements.filter((s) => s.includes("web_"))) {
			expect(statement).toContain(
				"json_get_str(value, 'source') = 'rawkode-academy-browser'",
			);
		}
	});
});
