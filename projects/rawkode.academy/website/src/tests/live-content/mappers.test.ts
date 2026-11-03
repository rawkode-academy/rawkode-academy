import { describe, expect, it } from "vitest";
import {
	mapArticle,
	mapChangelog,
	mapCourse,
	mapCourseModule,
	mapPerson,
	mapShow,
	mapTechnology,
	mapVideo,
	toEntry,
} from "@/lib/live-content/mappers";

const NOW = Date.parse("2026-10-23T12:00:00Z");
const bodyDoc = {
	type: "doc",
	content: [
		{ type: "paragraph", content: [{ type: "text", text: "Body text here" }] },
	],
};

describe("gateway → entry data", () => {
	it("maps videos with references, dates and the old defaults", () => {
		const data = mapVideo({
			id: "abc",
			slug: "hello",
			title: "Hello world",
			description: "Markdown *description*",
			descriptionDoc: bodyDoc,
			publishedAt: "2026-01-02T03:04:05Z",
			duration: 0,
			whatYouWillLearn: null,
			technologies: [{ id: "kubernetes/index" }, { id: "docker" }],
			guests: [{ id: "rawkode" }],
			episode: { code: "42", show: { id: "rawkode-live" } },
			chapters: [
				{ startTime: 60, title: "Two" },
				{ startTime: 0, title: "One" },
			],
			resources: [
				{ title: "Repo", type: "url", url: "https://x", category: null },
			],
			realtimeKit: { streamId: null, meetingId: "m" },
			type: "live",
			tagline: null,
		});
		expect(data.publishedAt).toEqual(new Date("2026-01-02T03:04:05Z"));
		expect(data.duration).toBeUndefined();
		expect(data.whatYouWillLearn).toEqual([]);
		expect(data.technologies).toEqual([
			{ collection: "technologies", id: "kubernetes" },
			{ collection: "technologies", id: "docker" },
		]);
		expect(data.show).toEqual({ collection: "shows", id: "rawkode-live" });
		expect(data.episodeCode).toBe("42");
		expect(data.guests).toEqual([{ collection: "people", id: "rawkode" }]);
		expect(data.chapters.map((c) => c.title)).toEqual(["One", "Two"]);
		expect(data.resources).toEqual([
			{ title: "Repo", type: "url", url: "https://x", category: "other" },
		]);
		expect(data.realtimeKit).toEqual({ meetingId: "m" });
		expect("tagline" in data).toBe(false);
	});

	it("trims video text like the old content schema", () => {
		const data = mapVideo({
			id: "abc",
			title: " Hello world ",
			description: "Folded YAML description\n",
			whatYouWillLearn: [" One "],
			publishedAt: "2026-01-02T03:04:05Z",
		});
		expect(data.title).toBe("Hello world");
		expect(data.description).toBe("Folded YAML description");
		expect(data.whatYouWillLearn).toEqual(["One"]);
	});

	it("maps show status coming_soon to coming-soon and builds a cover", () => {
		const data = mapShow({
			id: "s",
			name: "Show",
			status: "coming_soon",
			published: true,
			coverUrl: "https://content.rawkode.academy/shows/s/cover.png",
			coverAlt: "Cover",
			coverWidth: 1280,
			coverHeight: 720,
			hosts: [{ id: "rawkode" }],
			subscribeLinks: [
				{ platform: "RSS", url: "https://x/rss", icon: "weird" },
			],
		});
		expect(data.status).toBe("coming-soon");
		expect(data.publish).toBe(true);
		expect(data.cover).toEqual({
			image: {
				src: "https://content.rawkode.academy/shows/s/cover.png",
				width: 1280,
				height: 720,
				format: "png",
			},
			alt: "Cover",
		});
		expect(data.subscribeLinks[0]!.icon).toBe("other");
		expect(mapShow({ id: "x", status: "archived" }).status).toBe("archived");
		expect(mapShow({ id: "x" }).status).toBe("active");
	});

	it("maps people to the old transformed shape (URLs plus handles)", () => {
		const data = mapPerson({
			id: "rawkode",
			name: "David",
			githubHandle: "rawkode",
			githubUrl: "https://github.com/rawkode",
			avatarUrl: null,
			twitterHandle: "rawkode",
			surname: "",
			links: [{ name: "Site", url: "https://rawkode.dev" }],
		});
		expect(data.github).toBe("https://github.com/rawkode");
		expect(data.twitter).toBe("https://x.com/rawkode");
		expect(data.avatarUrl).toBe(
			"https://avatars.githubusercontent.com/rawkode",
		);
		expect(data.handles).toEqual({ github: "rawkode", twitter: "rawkode" });
		expect(data.surname).toBeUndefined();
	});

	it("uses revisedAt as the article's updatedAt and plain technology ids", () => {
		const data = mapArticle({
			id: "a",
			title: "A",
			publishedAt: "2026-01-01",
			revisedAt: "2026-02-01",
			updatedAt: "2026-10-01T10:00:00Z",
			technologies: [{ id: "kubernetes" }],
			authors: [],
			type: null,
			draft: null,
			cover: { url: "https://c/a.jpeg", alt: "x", width: null, height: null },
		});
		expect(data.updatedAt).toEqual(new Date("2026-02-01"));
		expect(data.recordUpdatedAt).toEqual(new Date("2026-10-01T10:00:00Z"));
		expect(data.technologies).toEqual(["kubernetes"]);
		expect(data.authors).toEqual([{ collection: "people", id: "rawkode" }]);
		expect(data.type).toBe("tutorial");
		expect(data.draft).toBe(false);
		expect(data.cover?.image).toMatchObject({
			width: 1280,
			height: 720,
			format: "jpg",
		});
	});

	it("keeps the changelog description as text plus its document", () => {
		const data = mapChangelog({
			id: "c",
			title: "T",
			date: "2026-03-01",
			type: "fix",
			description: bodyDoc,
			author: { id: "rawkode" },
		});
		expect(data.description).toBe("Body text here");
		expect(data.descriptionDoc).toEqual(bodyDoc);
		expect(data.author).toEqual({ collection: "people", id: "rawkode" });
	});

	it("maps courses and modules (embed import dir, draft default, course reference)", () => {
		const course = mapCourse({
			id: "c",
			title: "Course",
			publishedAt: "2026-01-01",
			updatedAt: "2026-09-09",
			difficulty: "advanced",
			technologies: [{ id: "zitadel" }],
			resources: [
				{
					title: "Demo",
					type: "embed",
					category: "demos",
					embedConfig: {
						container: "webcontainer",
						src: "oauth-pkce-app",
						importLocalDir: "c/oauth-pkce-app",
						height: null,
						width: null,
						files: null,
						startCommand: "npm start",
					},
				},
			],
		});
		expect(course.updatedAt).toBeUndefined();
		expect(course.technologies).toEqual([
			{ collection: "technologies", id: "zitadel" },
		]);
		expect(course.resources?.[0]?.embedConfig).toEqual({
			container: "webcontainer",
			src: "oauth-pkce-app",
			height: "600px",
			width: "100%",
			import: { localDir: "c/oauth-pkce-app" },
			startCommand: "npm start",
		});
		const module = mapCourseModule(
			{
				id: "c/intro",
				slug: "intro",
				title: "Intro",
				order: 2,
				publishedAt: "2026-01-01",
			},
			"c",
		);
		expect(module.course).toEqual({ collection: "courses", id: "c" });
		expect(module.draft).toBe(true);
		expect(module.slug).toBe("intro");
	});

	it("only exposes logo URLs whose flags are set", () => {
		const data = mapTechnology({
			id: "k",
			name: "K",
			icon: "https://c/icon.svg",
			horizontalLogo: "https://c/h.svg",
			logos: { icon: true, horizontal: false, stacked: false },
			relatedTechnologies: ["docker/index"],
			matrix: { status: null },
		});
		expect(data.icon).toBe("https://c/icon.svg");
		expect(data.horizontalLogo).toBeUndefined();
		expect(data.logos).toEqual({ icon: true });
		expect(data.relatedTechnologies).toEqual(["docker"]);
		expect(data.matrix).toBeUndefined();
		expect(data.license).toBe("Unknown");
		expect(data.status).toBe("stable");
	});
});

describe("entries", () => {
	it("carry body text and cache hints with collection, entity and related tags", () => {
		const data = mapArticle({
			id: "a",
			title: "A",
			publishedAt: "2026-01-01",
			body: bodyDoc,
			authors: [{ id: "icepuma" }],
			technologies: [{ id: "bun" }],
			updatedAt: "2026-05-01",
		});
		const entry = toEntry("articles", "a", data, NOW);
		expect(entry.body).toBe("Body text here");
		expect(entry.collection).toBe("articles");
		expect(entry.cacheHint?.tags).toEqual([
			"articles",
			"articles:a",
			"people:icepuma",
			"technologies:bun",
		]);
		expect(entry.cacheHint?.lastModified).toEqual(new Date("2026-05-01"));
	});

	it("leave code out of body text, as reading time did for Markdown", () => {
		const data = mapArticle({
			id: "a",
			title: "A",
			publishedAt: "2026-01-01",
			body: {
				type: "doc",
				content: [
					{
						type: "paragraph",
						content: [
							{ type: "text", text: "Run " },
							{
								type: "text",
								text: "kubectl apply",
								marks: [{ type: "code" }],
							},
							{ type: "text", text: " now" },
						],
					},
					{
						type: "codeBlock",
						attrs: { language: "bash" },
						content: [{ type: "text", text: "echo hidden" }],
					},
				],
			},
		});
		expect(toEntry("articles", "a", data, NOW).body).toBe("Run  now");
	});
});
