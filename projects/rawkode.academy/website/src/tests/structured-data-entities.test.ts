import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildBroadcastEventJsonLd } from "../lib/broadcast-event-jsonld";
import { buildNewsArticleJsonLd } from "../lib/news-jsonld";
import { buildPersonJsonLd } from "../lib/person-jsonld";

const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const readSource = (path: string) =>
	readFileSync(resolve(sourceRoot, path), "utf8");

describe("Person JSON-LD", () => {
	it("points at the profile on the site and lists social profiles as sameAs", () => {
		const person = buildPersonJsonLd(
			{
				id: "rawkode",
				name: "David Flanagan",
				github: "https://github.com/rawkode",
				twitter: "https://x.com/rawkode",
			},
			"https://rawkode.academy",
		);

		expect(person).toEqual({
			"@type": "Person",
			name: "David Flanagan",
			url: "https://rawkode.academy/people/rawkode",
			sameAs: ["https://github.com/rawkode", "https://x.com/rawkode"],
		});
	});

	it("omits sameAs when the person has no social profiles", () => {
		const person = buildPersonJsonLd(
			{ id: "guest", name: "Guest" },
			"https://rawkode.academy",
		);

		expect(person).not.toHaveProperty("sameAs");
		expect(person.url).toBe("https://rawkode.academy/people/guest");
	});

	it("carries the profile URL and sameAs through news article authors", () => {
		const jsonLd = buildNewsArticleJsonLd({
			article: {
				title: "Kubernetes 2.0",
				description: "What changed.",
				publishedAt: new Date("2026-11-01T09:00:00.000Z"),
			},
			authors: [
				buildPersonJsonLd(
					{
						id: "rawkode",
						name: "David Flanagan",
						github: "https://github.com/rawkode",
					},
					"https://rawkode.academy",
				),
			],
			url: "https://rawkode.academy/news/kubernetes-2",
			imageUrl: "https://image.rawkode.academy/image",
			siteUrl: "https://rawkode.academy",
		});

		expect(jsonLd.author).toEqual([
			{
				"@type": "Person",
				name: "David Flanagan",
				url: "https://rawkode.academy/people/rawkode",
				sameAs: ["https://github.com/rawkode"],
			},
		]);
	});

	it("keeps author and creator URLs on the site rather than GitHub", () => {
		for (const path of [
			"components/html/article-jsonld.astro",
			"components/html/news-jsonld.astro",
			"components/html/course-jsonld.astro",
		]) {
			const source = readSource(path);
			expect(source, path).toContain("buildPersonJsonLd(");
			expect(source, path).not.toMatch(/url:\s*\w+\.data\.github/);
		}
	});
});

describe("ProfilePage JSON-LD", () => {
	it("describes the page's person as mainEntity instead of mainEntityOfPage", () => {
		const opengraph = readSource("components/html/opengraph.astro");

		expect(opengraph).not.toContain("mainEntityOfPage");
		expect(opengraph).toContain("mainEntity ? { mainEntity }");
	});
});

describe("BroadcastEvent JSON-LD", () => {
	it("gives a scheduled stream a start time", () => {
		expect(
			buildBroadcastEventJsonLd({ startDate: "2026-11-11T17:00:00.000Z" }),
		).toEqual({
			"@type": "BroadcastEvent",
			isLiveBroadcast: true,
			startDate: "2026-11-11T17:00:00.000Z",
		});
	});

	it("derives the end time from the recorded duration", () => {
		const broadcast = buildBroadcastEventJsonLd({
			startDate: "2026-11-11T17:00:00.000Z",
			durationSeconds: 3600,
		});

		expect(broadcast.endDate).toBe("2026-11-11T18:00:00.000Z");
	});

	it("is attached to live videos as the VideoObject publication", () => {
		const source = readSource("components/html/video-metadata.astro");

		expect(source).toContain("publication: broadcastEvent");
		expect(source).toMatch(/isLiveBroadcast && publishedAt/);
	});
});
