import { describe, expect, test } from "bun:test";
import mapping from "../basin/posthog-mapping.json";
import botRules from "../src/bot-rules.json";
import { classifyUserAgent, isHostingAsn } from "../src/events";

type Target = { source: string; type: string; family: string };
type Entry = Target | { exclude: string };

const families = Object.keys(mapping.families);
const events = mapping.events as Record<string, Entry>;
const bySource = mapping.bySource as Record<string, Record<string, Target>>;

describe("PostHog mapping", () => {
	test("maps every name to a source, type and known family, or excludes it", () => {
		const targets = [
			...Object.values(events),
			...Object.values(bySource).flatMap((sources) => Object.values(sources)),
		];
		expect(targets.length).toBeGreaterThan(100);
		for (const entry of targets) {
			if ("exclude" in entry) {
				expect(entry.exclude).toMatch(/^[a-z0-9-]+$/);
				continue;
			}
			expect(entry.source).toMatch(/^[a-z0-9-]+$/);
			expect(entry.type).toMatch(/^[A-Za-z0-9_.]+$/);
			expect(families).toContain(entry.family);
		}
	});

	test("excludes every redirect spelling and raw autocapture", () => {
		for (const [name, entry] of Object.entries(events)) {
			if (name.endsWith("link.redirect") || name === "$autocapture")
				expect(entry).toHaveProperty("exclude");
		}
	});

	test("browser events use the collector's source and web.<event> types", () => {
		for (const name of ["$pageview", "page_view"])
			expect(events[name]).toEqual({
				source: "rawkode-academy-browser",
				type: "web.page_view",
				family: "browser",
			});
		expect(events.video_play).toEqual({
			source: "rawkode-academy-website",
			type: "video.play",
			family: "server",
		});
	});

	test("cutoffs are ISO instants or unset", () => {
		for (const family of Object.values(mapping.families)) {
			if (family.cutoff !== null)
				expect(new Date(family.cutoff).toISOString()).toBe(
					family.cutoff.replace("Z", ".000Z"),
				);
		}
	});
});

describe("shared bot rules", () => {
	test("drive the collector's classification", () => {
		expect(classifyUserAgent("Googlebot/2.1").is_bot).toBe(true);
		expect(isHostingAsn(botRules.hostingAsns[0]?.asn)).toBe(true);
		expect(isHostingAsn(2856)).toBe(false);
	});
});
