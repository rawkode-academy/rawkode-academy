import { readFileSync } from "node:fs";
import { parse } from "node-html-parser";
import { describe, expect, it } from "vitest";
import { createSSRApp } from "vue";
import { renderToString } from "vue/server-renderer";
import AcademyPage from "../components/academy/AcademyPage.vue";
import {
	selectWatchArchive,
	watchArchiveHref,
	WATCH_PAGE_SIZE,
} from "../lib/watch-archive";

const video = (title: string, changes: Record<string, unknown> = {}) => ({
	data: {
		title,
		description: "An introduction. " + "Background context. ".repeat(30),
		...changes,
	},
});
const catalogs = {
	technologies: [
		{
			id: "tool/index",
			data: { name: "Extended Berkeley Packet Filter", id: "ebpf" },
		},
	],
	people: [
		{ id: "guest", data: { name: "Ada Lovelace" } },
		{ id: "host/index", data: { name: "Liz Rice" } },
		{ id: "other", data: { name: "Unrelated Person" } },
	],
	shows: [
		{ id: "show/index", data: { id: "show-alias", hosts: [{ id: "host" }] } },
	],
};
const archive = (
	videos: ReturnType<typeof video>[],
	query = "",
	page?: string,
) => selectWatchArchive(videos, { ...catalogs, query, page });

describe("server Watch search and pagination", () => {
	it("pages 329 items in stable groups of 24 without mutating the input", () => {
		const videos = Array.from({ length: 329 }, (_, i) => video(`Session ${i}`));
		Object.freeze(videos);
		const seen: typeof videos = [];
		for (let page = 1; page <= 14; page++) {
			const result = archive(videos, "", String(page));
			expect(result.pageCount).toBe(14);
			expect(result.items).toHaveLength(page === 14 ? 17 : 24);
			expect(result.first).toBe((page - 1) * 24 + 1);
			seen.push(...result.items);
		}
		expect(seen).toEqual(videos);
		expect(seen[0]).toBe(videos[0]);
		expect(WATCH_PAGE_SIZE).toBe(24);
	});

	it.each([
		null,
		undefined,
		"",
		"0",
		"-1",
		"1.5",
		"2junk",
		"NaN",
		"Infinity",
	])("normalizes invalid or lower-bound page %s to page 1", (page) => {
		expect(
			selectWatchArchive(
				Array.from({ length: 50 }, () => video("session")),
				{ ...catalogs, page },
			).page,
		).toBe(1);
	});

	it.each([
		"999",
		"9".repeat(400),
	])("clamps excessive page values to the final page", (page) => {
		const result = archive(
			Array.from({ length: 50 }, () => video("session")),
			"",
			page,
		);
		expect(result.page).toBe(3);
		expect(result.items).toHaveLength(2);
		expect(result.last).toBe(50);
	});

	it("searches full descriptions beyond a first sentence/220 characters, title, and subtitle", () => {
		const videos = [
			video("ordinary", {
				description: "Intro. " + "context ".repeat(50) + "eBPF",
			}),
			video("Kernel story"),
			video("other", { subtitle: "Tracing internals" }),
		];
		expect(archive(videos, "eBpF").items).toEqual([videos[0]]);
		expect(archive(videos, "kernel").items).toEqual([videos[1]]);
		expect(archive(videos, "tracing").items).toEqual([videos[2]]);
	});

	it.each([
		"tool",
		"tool/index",
		{ id: "tool/index" },
		{ id: "ebpf" },
	])("resolves technology names and aliases from %j", (reference) => {
		const videos = [
			video("ordinary", { technologies: [reference] }),
			video("other"),
		];
		expect(archive(videos, "berkeley packet").items).toEqual([videos[0]]);
	});

	it("indexes only each video's guests and show hosts, not every person in the catalog", () => {
		const videos = [
			video("guest talk", { guests: [{ id: "guest" }] }),
			video("host talk", { show: { id: "show-alias" } }),
			video("unrelated"),
		];
		expect(archive(videos, "Ada Lovelace").items).toEqual([videos[0]]);
		expect(archive(videos, "liz rice").items).toEqual([videos[1]]);
		expect(archive(videos, "Unrelated Person").items).toHaveLength(0);
	});

	it("handles missing references and ANDs literal query terms without treating them as patterns", () => {
		const videos = [
			video("C++ [a+b]", {
				guests: [null, { id: "missing" }],
				technologies: ["missing-tool"],
				subtitle: "kernel",
			}),
		];
		expect(archive(videos, "  C++   [a+b]  kernel ").items).toEqual(videos);
		expect(archive(videos, ".*").items).toHaveLength(0);
		expect(archive(videos, "C++ missing-tool").items).toEqual(videos);
	});

	it("filters before paging, handles zero results, and features only the unfiltered first page", () => {
		const videos = Array.from({ length: 50 }, (_, i) =>
			video(i < 25 ? "match" : "other"),
		);
		const result = archive(videos, "match", "2");
		expect(result).toMatchObject({
			total: 25,
			pageCount: 2,
			page: 2,
			first: 25,
			last: 25,
			showFeatured: false,
		});
		expect(result.items).toHaveLength(1);
		expect(archive(videos, "none", "999")).toMatchObject({
			total: 0,
			pageCount: 1,
			page: 1,
			first: 0,
			last: 0,
			items: [],
		});
		expect(archive(videos, " ").showFeatured).toBe(true);
		expect(archive(videos, "", "2").showFeatured).toBe(false);
		expect(archive(videos, "match").showFeatured).toBe(false);
	});

	it("uses ordinary encoded Watch URLs and preserves the query on the first page too", () => {
		for (const page of [1, 2, 14]) {
			const url = new URL(
				watchArchiveHref("C++ & <script>", page),
				"https://example.test",
			);
			expect(url.pathname).toBe("/watch");
			expect(url.searchParams.get("q")).toBe("C++ & <script>");
			expect(url.searchParams.get("page")).toBe(
				page === 1 ? null : String(page),
			);
		}
		expect(watchArchiveHref("")).toBe("/watch");
	});
});

describe("Home and Learn remain server-rendered AcademyPage consumers", () => {
	const card = {
		href: "/watch/real-session",
		title: "Real session",
		description: "Authored description",
		meta: ["Beginner", "2h core video"],
	};
	const entry = (collection: string, index: number) => ({
		href: `/${collection}/item-${index}`,
		title: `${collection} item ${index}`,
		publishedAt: "2026-09-20T12:00:00.000Z",
	});
	const column = (id: string, length: number, total = 40) => ({
		id,
		title: id,
		href: `/${id}`,
		more: `All ${id}`,
		total,
		entries: Array.from({ length }, (_, index) => entry(id, index)),
	});
	const props = {
		collections: [
			{
				href: "/watch",
				label: "Videos",
				count: 329,
				description: "Hands-on sessions.",
			},
			{
				href: "/read",
				label: "Articles",
				count: 34,
				description: "Written guides.",
			},
		],
		featured: {
			href: "/watch/real-session",
			title: "Real session",
			publishedAt: "2026-10-22T16:00:00.000Z",
			mediaSrc: "/real.webp",
			runtime: "25 min",
			guests: ["Real Guest"],
			show: { href: "/shows/real-show", name: "Real Show", episodes: 175 },
		},
		ledger: [column("watch", 5), column("read", 5), column("news", 5)],
		upcoming: [
			{
				href: "/watch/next-stream",
				title: "Next stream",
				description: "What the stream covers.",
				publishedAt: "2026-11-11T12:00:00.000Z",
				mediaSrc: "/next.webp",
			},
		],
		learningPaths: Array.from({ length: 5 }, (_, i) => ({
			...card,
			href: `/learning-paths/path-${i}`,
			title: `Path ${i}`,
			sessions: i + 1,
		})),
	};
	const solidActions = (dom: ReturnType<typeof parse>) =>
		dom
			.querySelectorAll("a, button")
			.filter((control) =>
				(control.getAttribute("class") ?? "")
					.split(/\s+/)
					.some((name) => /^bg-c_academy\.(accent|inkAccent)$/.test(name)),
			)
			.map((control) => control.text.trim());
	const renderHome = async (overrides: Record<string, unknown> = {}) =>
		parse(
			await renderToString(
				createSSRApp(AcademyPage, { ...props, ...overrides }),
			),
		);
	it("keeps Home's statement, index, latest session, ledger and every path", async () => {
		const html = await renderToString(
			createSSRApp(AcademyPage, { ...props, page: "home" }),
		);
		const dom = parse(html);
		expect(dom.querySelectorAll("h1")).toHaveLength(1);
		expect(dom.querySelector("h1")?.text).toBe("Understand the system.");
		expect(html).toContain("Recently published");
		expect(html).toContain('href="/learning-paths/path-4"');
		expect(html).not.toContain("email.rawkode.academy/subscribe");
		expect(html).not.toContain("video-search");
	});
	it("uses the shared newsletter CTA on Home", () => {
		const source = readFileSync("src/pages/index.astro", "utf8");
		expect(source).toContain(
			'import NewsletterCTA from "@/components/newsletter/NewsletterCTA.astro"',
		);
		expect(source).toContain("<NewsletterCTA");
		expect(source).not.toContain("email.rawkode.academy/subscribe");
	});
	it("defaults to exactly the Home branch when page is omitted", async () => {
		const implicit = await renderToString(createSSRApp(AcademyPage, props));
		const explicit = await renderToString(
			createSSRApp(AcademyPage, { ...props, page: "home" }),
		);
		expect(implicit).toBe(explicit);
	});
	it("sets each collection in the index with its real count, hidden from and restated for assistive technology", async () => {
		const dom = await renderHome();
		const nav = dom.querySelector('nav[aria-labelledby="archive-title"]');
		expect(dom.querySelector("#archive-title")?.text).toBe("The archive");
		// The index is its own section: the hero holds only the statement.
		expect(dom.querySelector('[aria-labelledby="home-title"] nav')).toBeNull();
		expect(
			dom
				.querySelector('[aria-labelledby="home-title"]')
				?.text.replace(/\s+/g, " ")
				.trim(),
		).toBe(
			"Understand the system.Cloud native, taught by the engineers doing the work, with every decision on screen.",
		);
		const links = nav?.querySelectorAll("a") ?? [];
		expect(links.map((link) => link.getAttribute("href"))).toEqual([
			"/watch",
			"/read",
		]);
		const [videos] = links;
		expect(videos?.querySelector("sup")?.text).toBe("329");
		expect(videos?.querySelector("sup")?.getAttribute("aria-hidden")).toBe(
			"true",
		);
		expect(videos?.text).toContain(
			"Videos329, 329 in the archive. Hands-on sessions.",
		);
		expect(videos?.text).toContain("Hands-on sessions.");
	});
	it("states the latest session's real facts once, and gives the page one solid action", async () => {
		const dom = await renderHome();
		const spread = dom.querySelector(
			'[aria-labelledby="latest-session-title"]',
		);
		expect(spread?.querySelector("h2")?.text).toBe("Real session");
		const facts = Object.fromEntries(
			(spread?.querySelectorAll("dl > div") ?? []).map((row) => [
				row.querySelector("dt")?.text,
				row.querySelector("dd")?.text,
			]),
		);
		expect(facts).toEqual({
			Published: "22 Oct 2026",
			Runtime: "25 min",
			Guest: "Real Guest",
			Show: "Real Show 175 episodes",
		});
		expect(spread?.querySelector("time")?.getAttribute("datetime")).toBe(
			"2026-10-22T16:00:00.000Z",
		);
		expect(spread?.querySelector('dd a[href="/shows/real-show"]')?.text).toBe(
			"Real Show",
		);
		// The still is a pointer target only: one link to the session is in
		// the tab order and the accessibility tree.
		const still = spread?.querySelector("a[aria-hidden]");
		expect(still?.getAttribute("tabindex")).toBe("-1");
		expect(still?.querySelector("img")?.getAttribute("alt")).toBe("");
		expect(
			spread?.querySelectorAll(
				'a[href="/watch/real-session"]:not([aria-hidden])',
			),
		).toHaveLength(1);
		// A solid button is the one filled with the accent. The time-bound
		// action takes it; with nothing scheduled the session does.
		expect(solidActions(dom)).toEqual(["Get notified →"]);
		const alone = await renderHome({ upcoming: [] });
		expect(solidActions(alone)).toEqual(["Watch the session →"]);
		expect(
			alone
				.querySelector('[aria-labelledby="latest-session-title"]')
				?.querySelectorAll("dt")
				.map((term) => term.text),
		).toEqual(["Published", "Runtime", "Guest", "Show"]);
	});
	it("leaves out a fact the content does not have", async () => {
		const dom = await renderHome({
			featured: {
				href: "/watch/real-session",
				title: "Real session",
				publishedAt: "2026-10-22T16:00:00.000Z",
				guests: [],
			},
		});
		const spread = dom.querySelector(
			'[aria-labelledby="latest-session-title"]',
		);
		expect(spread?.querySelectorAll("dt").map((term) => term.text)).toEqual([
			"Published",
		]);
		expect(spread?.querySelector("img")).toBeNull();
		expect(
			(await renderHome({ featured: undefined })).querySelector(
				'[aria-labelledby="latest-session-title"]',
			),
		).toBeNull();
	});
	it("keeps each supplied column in order, every row a date, a title and one line of facts", async () => {
		const ledger = [
			column("watch", 5),
			{
				...column("read", 5),
				entries: [
					{ ...entry("read", 0), meta: ["Guide", "Real Author"] },
					...column("read", 5).entries.slice(1),
				],
			},
			column("news", 5),
		];
		const dom = await renderHome({ ledger });
		const section = dom.querySelector('[aria-labelledby="latest-title"]');
		expect(section?.querySelector("p")?.text).toBe("15 entries, newest first");
		const columns = section?.querySelectorAll("section") ?? [];
		expect(columns.map((item) => item.querySelector("h3")?.text)).toEqual([
			"watch 5 of 40",
			"read 5 of 40",
			"news 5 of 40",
		]);
		expect(
			columns.map((item) =>
				item.querySelectorAll("ol a").map((row) => row.getAttribute("href")),
			),
		).toEqual(ledger.map((item) => item.entries.map((row) => row.href)));
		// Each column closes on its own link to the collection.
		expect(
			columns.map((item) => item.querySelector("ol + a")?.getAttribute("href")),
		).toEqual(["/watch", "/read", "/news"]);
		const [first] = columns[1]?.querySelectorAll("ol a") ?? [];
		expect(first?.text).toContain("Guide · Real Author");
		// The three columns are the same thing: no column carries a cover.
		expect(section?.querySelectorAll("img")).toHaveLength(0);
		for (const row of section?.querySelectorAll("ol a") ?? []) {
			expect(row.querySelector("time")?.getAttribute("datetime")).toBe(
				"2026-09-20T12:00:00.000Z",
			);
			expect(row.querySelector("time strong")?.text).toBe("20");
			expect(row.querySelector("time span")?.text).toBe("Sep 2026");
		}
	});
	it("collapses the ledger instead of drawing an empty column", async () => {
		const dom = await renderHome({
			ledger: [column("watch", 5), column("read", 1), column("news", 0)],
		});
		const section = dom.querySelector('[aria-labelledby="latest-title"]');
		expect(
			section?.querySelector("[data-columns]")?.getAttribute("data-columns"),
		).toBe("2");
		expect(
			section?.querySelectorAll("h3").map((heading) => heading.text),
		).toEqual(["watch 5 of 40", "read 1 of 40"]);
		expect(section?.querySelectorAll("ol:empty")).toHaveLength(0);
		expect(
			(
				await renderHome({ ledger: [column("watch", 0), column("news", 0)] })
			).querySelector('[aria-labelledby="latest-title"]'),
		).toBeNull();
	});
	it("sets the next stream beside the latest session, next first, only when one is scheduled", async () => {
		const scheduled = await renderHome();
		const pair = scheduled.querySelector(
			'[aria-label="Next live stream and latest session"]',
		);
		expect(
			pair
				?.querySelectorAll("article")
				.map((item) => item.querySelector("h2")?.text),
		).toEqual(["Next stream", "Real session"]);
		const next = pair?.querySelector('[aria-labelledby="upcoming-title"]');
		expect(next?.text).toContain("What the stream covers.");
		expect(next?.querySelector("time")?.getAttribute("datetime")).toBe(
			"2026-11-11T12:00:00.000Z",
		);
		expect(next?.querySelector("time strong")?.text).toBe("11");
		expect(next?.querySelector("[data-date]")?.text).toBe(
			"Wednesday 11 November 2026 12:00 UTC",
		);
		// Every part of the start follows the reader's time zone in the browser.
		for (const part of next?.querySelectorAll("[data-local-time]") ?? []) {
			expect(part.getAttribute("data-datetime")).toBe(
				"2026-11-11T12:00:00.000Z",
			);
		}
		expect(next?.querySelectorAll("[data-local-time]")).toHaveLength(4);
		const still = next?.querySelector("a[aria-hidden]");
		expect(still?.getAttribute("tabindex")).toBe("-1");
		expect(
			next
				?.querySelectorAll('a[href="/watch/next-stream"]:not([aria-hidden])')
				.map((link) => link.text.trim()),
		).toEqual(["Get notified →"]);
		expect(next?.text).not.toContain("Also scheduled");
		// The pair replaces the band: the stream is stated once.
		expect(scheduled.querySelectorAll("#upcoming-title")).toHaveLength(1);

		for (const upcoming of [[], undefined]) {
			const quiet = await renderHome({ upcoming });
			expect(
				quiet.querySelector(
					'[aria-label="Next live stream and latest session"]',
				),
			).toBeNull();
			expect(quiet.querySelector("#upcoming-title")).toBeNull();
			expect(quiet.toString()).not.toContain("Next live stream");
			expect(quiet.querySelectorAll("#latest-session-title")).toHaveLength(1);
		}
	});
	it("orders the page: statement, next and latest, the index, the ledger, the paths", async () => {
		const dom = await renderHome();
		expect(
			dom.querySelectorAll("h1, h2").map((heading) => heading.text),
		).toEqual([
			"Understand the system.",
			"Next stream",
			"Real session",
			"The archive",
			"Recently published",
			"Learning paths",
		]);
	});
	it("does not stretch a ledger column that has fewer than three rows", async () => {
		const dom = await renderHome({
			ledger: [column("watch", 5), column("read", 2), column("news", 3)],
		});
		expect(
			dom
				.querySelectorAll('[aria-labelledby="latest-title"] section')
				.map((item) => item.hasAttribute("data-short")),
		).toEqual([false, true, false]);
	});
	it("lists streams after the next one under it, in order", async () => {
		const dom = await renderHome({
			upcoming: [
				...props.upcoming,
				{
					href: "/watch/later-stream",
					title: "Later stream",
					publishedAt: "2026-11-18T17:30:00.000Z",
				},
				{
					href: "/watch/last-stream",
					title: "Last stream",
					publishedAt: "2026-11-25T17:30:00.000Z",
				},
			],
		});
		const next = dom.querySelector('[aria-labelledby="upcoming-title"]');
		const list = next?.querySelector("ul");
		expect(
			dom.querySelector(`#${list?.getAttribute("aria-labelledby")}`)?.text,
		).toBe("Also scheduled");
		expect(
			list
				?.querySelectorAll("a")
				.map((link) => [
					link.getAttribute("href"),
					link.querySelector("time")?.getAttribute("datetime"),
					link.querySelector("span")?.text,
				]),
		).toEqual([
			["/watch/later-stream", "2026-11-18T17:30:00.000Z", "Later stream"],
			["/watch/last-stream", "2026-11-25T17:30:00.000Z", "Last stream"],
		]);
		expect(
			dom.querySelectorAll("h2").map((heading) => heading.text),
		).not.toContain("Later stream");
	});
	it("counts each path's sessions and leaves the count out when there is none", async () => {
		const dom = await renderHome({
			learningPaths: [
				{ ...card, href: "/learning-paths/a", title: "A", sessions: 1 },
				{ ...card, href: "/learning-paths/b", title: "B", sessions: 7 },
				{ ...card, href: "/learning-paths/c", title: "C" },
			],
		});
		const rows = dom.querySelectorAll('[aria-labelledby="paths-title"] ul a');
		expect(rows.map((row) => row.text.replace(/\s+/g, " ").trim())).toEqual([
			"A Beginner · 2h core video 1 session",
			"B Beginner · 2h core video 7 sessions",
			"C Beginner · 2h core video",
		]);
	});
	it("escapes authored text", async () => {
		const html = (
			await renderHome({
				featured: { ...props.featured, title: "<script>alert(1)</script>" },
			})
		).toString();
		expect(html).not.toContain("<script>alert(1)</script>");
		expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
	});
	it.each([
		"index.astro",
		"learning-paths/index.astro",
	])("does not hydrate static AcademyPage markup in %s", (route) => {
		const source = readFileSync(`src/pages/${route}`, "utf8");
		expect(source).not.toMatch(/client:(load|idle|visible|only|media)/);
	});
	it("titles Learn with the shared collection masthead", () => {
		const source = readFileSync("src/pages/learning-paths/index.astro", "utf8");
		const masthead = source.match(
			/<AcademyCatalogMasthead\b([\s\S]*?)\/>/,
		)?.[1];
		expect(masthead).toMatch(/title="Learning paths"/);
		expect(masthead).toMatch(/figure=\{paths\.length\}/);
	});
	it("keeps Learn's complete path list without Watch controls", async () => {
		const app = createSSRApp(AcademyPage, {
			page: "learn",
			learningPaths: props.learningPaths,
		});
		const warnings: string[] = [];
		app.config.warnHandler = (message) => warnings.push(message);
		const html = await renderToString(app);
		expect(warnings).toEqual([]);
		expect(html).toContain('aria-label="Available learning paths"');
		expect(html).toContain('href="/learning-paths/path-4"');
		expect(html).not.toContain("video-search");
		expect(html).not.toContain("Show more sessions");
		expect(html).not.toContain('videos="');
		expect(html).not.toContain('featured="');
		expect(html).not.toContain('ledger="');
		expect(html).not.toContain('collections="');
		expect(html).not.toContain("Recently published");
	});
	it("passes only Learn's discriminator and path data from the Astro route", () => {
		const source = readFileSync("src/pages/learning-paths/index.astro", "utf8");
		const component = source.match(/<AcademyPage\b([\s\S]*?)\/>/)?.[1];
		expect(component).toBeDefined();
		expect(component).toMatch(/page="learn"/);
		expect(component).toMatch(/learningPaths=\{paths\}/);
		expect(component).not.toMatch(
			/\b(featured|latest|ledger|collections|upcoming|archive|stats)=/,
		);
		expect(source).not.toContain("const featured =");
	});
});
