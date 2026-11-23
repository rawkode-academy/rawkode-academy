import { describe, expect, test } from "bun:test";
import typedSql from "../basin/typed.sql" with { type: "text" };
import {
	annotateServerEvent,
	classifyUserAgent,
	prepareCloudEvent,
} from "../src/events";

const CHROME_MAC =
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const IPHONE_SAFARI =
	"Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

const shortLink = {
	specversion: "1.0",
	id: "evt-1",
	source: "rawkode-link",
	type: "shortLink",
	time: "2026-11-07T18:12:08.315Z",
	referrer: "https://www.youtube.com/",
	country: "GB",
	continent: "EU",
	useragent: CHROME_MAC,
	data: {
		domain: "rawkode.link",
		path: "discord",
		matched: true,
		destination: "https://discord.gg/rawkode",
	},
};

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

	test("named crawlers that spoof Chrome are bots", () => {
		for (const ua of [
			`${CHROME_MAC} (compatible; meta-webindexer/1.1 (+https://developers.facebook.com/docs/sharing/webmasters/crawler))`,
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/146.0.7680.165 Safari/537.36",
			"Lightpanda/1.0",
			"nginx-ssl early hints",
		])
			expect(classifyUserAgent(ua).is_bot, ua).toBe(true);
	});

	test("browser requests must come from a browser", () => {
		expect(classifyUserAgent("Overcast/3.0").is_bot).toBe(false);
		expect(classifyUserAgent("Overcast/3.0", { browser: true }).is_bot).toBe(
			true,
		);
		expect(
			classifyUserAgent("Mozilla/5.0 (X11; Linux x86_64)", { browser: true })
				.is_bot,
		).toBe(true);
	});

	test("in-app browsers on phones are people", () => {
		const linkedin =
			"Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [LinkedInApp]/9.30";
		expect(classifyUserAgent(linkedin, { browser: true })).toEqual({
			device: "mobile",
			browser: "other",
			is_bot: false,
		});
	});

	test("an unknown agent is not a bot", () => {
		expect(classifyUserAgent(undefined)).toEqual({
			device: null,
			browser: null,
			is_bot: false,
		});
	});
});

describe("prepareCloudEvent", () => {
	test("replaces the user agent with device and browser", () => {
		const prepared = prepareCloudEvent(shortLink);
		expect(prepared).not.toHaveProperty("useragent");
		expect(prepared?.device).toBe("desktop");
		expect(prepared?.browser).toBe("chrome");
		expect(prepared?.bot).toBe(false);
		expect(prepared).not.toHaveProperty("botreason");
		expect(JSON.stringify(prepared)).not.toContain("Macintosh");
	});

	test("labels bot traffic instead of dropping it", () => {
		expect(
			prepareCloudEvent({ ...shortLink, useragent: "curl/8.4.0" }),
		).toMatchObject({ bot: true, botreason: "ua-pattern", device: "bot" });
		expect(prepareCloudEvent({ ...shortLink, useragent: "" })).toMatchObject({
			bot: true,
			botreason: "ua-pattern",
		});
		expect(
			prepareCloudEvent({ ...shortLink, useragent: "Overcast/3.0" }),
		).toMatchObject({ bot: true, botreason: "non-browser-ua" });
	});

	test("leaves events without request context untouched", () => {
		const { useragent: _, ...event } = shortLink;
		expect(prepareCloudEvent(event)).toBe(event);
	});

	test("keeps the ASN and labels hosting networks", () => {
		expect(prepareCloudEvent({ ...shortLink, asn: 132203 })).toMatchObject({
			asn: 132203,
			bot: true,
			botreason: "hosting-asn",
		});
		expect(prepareCloudEvent({ ...shortLink, asn: 2856 })).toMatchObject({
			asn: 2856,
			bot: false,
		});
	});

	test("a sender's reason wins over its own signals", () => {
		expect(
			prepareCloudEvent({
				...shortLink,
				asn: 132203,
				botreason: "unmatched-path",
			}),
		).toMatchObject({ bot: true, botreason: "unmatched-path" });
	});

	test("carries every field the typed pipeline reads", () => {
		// A labelled bot carries every optional field: botreason and asn.
		const prepared = prepareCloudEvent({ ...shortLink, asn: 132203 });
		const paths = [...typedSql.matchAll(/json_get_\w+\(value, ([^)]+)\)/g)].map(
			(match) => match[1].split(",").map((key) => key.trim().slice(1, -1)),
		);
		expect(paths.length).toBeGreaterThan(0);
		for (const path of paths) {
			const value = path.reduce<unknown>(
				(node, key) => (node as Record<string, unknown> | undefined)?.[key],
				prepared,
			);
			expect(value, path.join(".")).toBeDefined();
		}
	});
});

describe("annotateServerEvent", () => {
	test("replaces the raw user agent with its classification", () => {
		const event = {
			id: "1",
			data: { path: "/x", user_agent: IPHONE_SAFARI },
		};
		const redacted = annotateServerEvent(event);
		expect(redacted.data).toEqual({
			path: "/x",
			device: "mobile",
			browser: "safari",
			is_bot: false,
		});
		expect(event.data.user_agent).toBe(IPHONE_SAFARI);
	});

	test("leaves events without a user agent untouched", () => {
		const event = { id: "1", data: { path: "/x" } };
		expect(annotateServerEvent(event)).toBe(event);
	});

	test("labels hosting networks and spoofed browsers as bots", () => {
		expect(
			annotateServerEvent({ data: { user_agent: CHROME_MAC, asn: 31898 } }),
		).toEqual({
			asn: 31898,
			bot: true,
			botreason: "hosting-asn",
			device: "desktop",
			browser: "chrome",
			data: { device: "desktop", browser: "chrome", is_bot: true },
		});
		expect(
			annotateServerEvent(
				{ data: { user_agent: "nginx-ssl early hints" } },
				{ browser: true },
			),
		).toMatchObject({ bot: true, botreason: "ua-pattern" });
		expect(
			annotateServerEvent({
				data: { user_agent: CHROME_MAC, bot_reason: "spoofed-chrome" },
			}),
		).toMatchObject({
			bot: true,
			botreason: "spoofed-chrome",
			data: { is_bot: true },
		});
		expect(
			annotateServerEvent({ data: { user_agent: "AppleCoreMedia/1.0" } }),
		).toMatchObject({ bot: false, data: { is_bot: false } });
	});
});
