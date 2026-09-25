// Actual Astro SSR and route/plugin handlers, with local content/service fixtures.
// Shell/CSS and the unchanged Vue bracket board are stubs. No live I/O or auth.
// node --experimental-vm-modules --import tsx --test src/tests/shows-contract-ssr.test.mjs
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { posix } from "node:path";
import { test } from "node:test";
import vm from "node:vm";
import { transform } from "@astrojs/compiler";
import ts from "typescript";
import * as runtime from "astro/runtime/server/index.js";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { parse } from "node-html-parser";
import * as feedsmith from "feedsmith";

const now = Date.parse("2026-09-20T12:00:00Z");
class FixedDate extends Date {
	constructor(...args) {
		super(...(args.length ? args : [now]));
	}
	static now() {
		return now;
	}
}
const show = (id = "klustered", publish = true) => ({
	id,
	data: {
		id,
		name: `${id} show`,
		publish,
		hosts: [],
		description: "Authored description",
	},
});
const video = (id, data = {}) => ({
	id,
	data: {
		id,
		slug: id,
		title: id,
		description: "Authored episode",
		publishedAt: new Date("2020-01-01"),
		show: "klustered",
		duration: 90,
		chapters: [{ startTime: 0, title: "Start" }],
		...data,
	},
});
const bracket = (data = {}) => ({
	id: "b",
	name: "Bracket",
	kind: "individual",
	status: "draft",
	startsAt: "2027-01-01",
	registrationClosesAt: null,
	...data,
});
const card = (data = {}) => ({
	bracketId: "b",
	bracketName: "Bracket",
	bracketKind: "individual",
	applied: false,
	team: null,
	...data,
});
const fixtureVideos = () => [
	video("old"),
	video("future-recorded", {
		publishedAt: new Date(now + 1),
		type: "recorded",
	}),
	video("recent", { publishedAt: new Date(now), show: { id: "klustered" } }),
	video("future-live", { publishedAt: new Date(now + 1), type: "live" }),
	video("other", { show: "other" }),
];
const plugin = "lib/shows/plugins/bracket/";
const extras = "pages/shows/[showId]/[...slug].astro";
const api = "pages/api/shows/[showId]/[...slug].ts";
const feed = "pages/api/feeds/shows/[showId].xml.ts";
const chapters = "pages/api/feeds/shows/[showId]/[episodeId]/chapters.json.ts";

function harness({
	collections = { shows: [show()], videos: [] },
	participation = [],
	writeError = false,
} = {}) {
	const reads = [],
		writes = [];
	const env = {
		BRACKETS_READ: {
			fetch: async (_url, init) => {
				reads.push(init);
				return Response.json({
					data: {
						myBracketParticipation: { brackets: participation },
						seasons: [],
						brackets: [],
						schedule: [],
					},
				});
			},
		},
		BRACKETS_WRITE: {
			selfRegisterCompetitor: async (input) => {
				writes.push(input);
				if (writeError) throw new Error("fixture rejection");
				return { competitorId: "c", seasonId: "s", bracketKind: "individual" };
			},
		},
	};
	const context = vm.createContext({
		console,
		__NEWS_DEPLOYMENT_CUTOFF_MS__: now,
		URL,
		Date: FixedDate,
		Response,
		Request,
	});
	const empty = runtime.createComponent(() => runtime.render``);
	const shell = runtime.createComponent(
		(result, _props, slots) =>
			runtime.render`<main>${runtime.renderSlot(result, slots["extra-head"])}${runtime.renderSlot(result, slots.default)}</main>`,
	);
	const styles = () =>
		new Proxy({}, { get: (_, key) => `academy-${String(key)}` });
	const mocks = {
		"astro/runtime/server/index.js": { ...runtime, createMetadata: () => ({}) },
		"astro:content": {
			getCollection: async (name, filter) =>
				(collections[name] ?? []).filter(filter ?? (() => true)),
			getEntries: async (refs) =>
				refs.map((ref) =>
					(collections.people ?? []).find((p) => p.id === (ref.id ?? ref)),
				),
		},
		"cloudflare:workers": { env },
		// Feedsmith checks object.constructor === Object; bridge VM realms while
		// preserving Dates and running the real serializer on the unchanged values.
		feedsmith: {
			generateRssFeed: (input) =>
				feedsmith.generateRssFeed(structuredClone(input)),
		},
		"@rawkodeacademy/design-system": {
			academyLayout: styles,
			academyCatalog: styles,
			academyDocument: styles,
			academyNavigation: styles,
		},
		"astro:assets": {
			Image: empty,
			getImage: async ({ src }) => ({ src: src.src }),
		},
		"@/lib/logger": { createLogger: () => ({ error() {} }) },
		"@/components/breadcrumb/Breadcrumb.astro": { default: empty },
		"@/components/show/SubscribeLinks.astro": { default: empty },
		"@/components/newsletter/NewsletterCTA.astro": { default: empty },
		"@/components/html/video-metadata.astro": { default: empty },
		"@/components/video/VideoProgressBar.vue": { default: empty },
		"@/wrappers/page.astro": { default: shell },
		"@/layouts/ShowLayout.astro": { default: shell },
	};
	async function load(path) {
		const source = readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
		const compiled = path.endsWith(".astro")
			? await transform(source, { filename: path })
			: { code: source, diagnostics: [] };
		assert.deepEqual(compiled.diagnostics, []);
		const module = new vm.SourceTextModule(
			ts.transpileModule(compiled.code, {
				compilerOptions: {
					module: ts.ModuleKind.ESNext,
					target: ts.ScriptTarget.ES2022,
				},
			}).outputText,
			{ context, identifier: path },
		);
		await module.link(async (specifier) => {
			let exports = mocks[specifier];
			if (specifier.includes("?astro&type=style")) exports = {};
			if (specifier.endsWith("BracketBoard.vue")) exports = { default: empty };
			if (exports)
				return new vm.SyntheticModule(
					Object.keys(exports),
					function () {
						for (const [key, value] of Object.entries(exports))
							this.setExport(key, value);
					},
					{ context },
				);
			assert(
				specifier.startsWith("@/") || specifier.startsWith("."),
				`Unexpected import: ${specifier}`,
			);
			const local = specifier.startsWith("@/")
				? specifier.slice(2)
				: posix.join(posix.dirname(path), specifier);
			return load(
				/\.(astro|ts)$/.test(local)
					? local
					: existsSync(new URL(`../${local}.ts`, import.meta.url))
						? `${local}.ts`
						: `${local}/index.ts`,
			);
		});
		return module;
	}
	async function module(path) {
		const loaded = await load(path);
		await loaded.evaluate();
		return loaded.namespace;
	}
	async function render(
		path,
		props = {},
		{ url = "https://academy.test/shows", params = {}, locals = {} } = {},
	) {
		const component = await module(path);
		const container = await AstroContainer.create();
		const response = await container.renderToResponse(component.default, {
			props,
			params,
			locals,
			request: new Request(url),
		});
		const html = await response.text();
		return { dom: parse(html), html, status: response.status };
	}
	const routeContext = (
		method = "GET",
		form = {},
		locals = {},
		slug = "apply",
	) => {
		const url = new URL(`https://academy.test/api/shows/klustered/${slug}`);
		return {
			params: { showId: "klustered", slug },
			url,
			locals,
			request: new Request(url, {
				method,
				...(method === "POST" ? { body: new URLSearchParams(form) } : {}),
			}),
		};
	};
	return { render, module, reads, writes, routeContext };
}

test("archive filters future/draft data, sorts preview, preserves authored cover, and has H1/H2 outline", async () => {
	for (const videos of [fixtureVideos(), fixtureVideos().reverse()]) {
		const entry = show();
		entry.data.cover = { image: { src: "/real-cover.png" } };
		const { dom } = await harness({
			collections: { shows: [entry, show("hidden", false)], videos },
		}).render("pages/shows/index.astro");
		assert.deepEqual(
			dom.querySelectorAll("h1,h2,h3").map((n) => [n.tagName, n.text]),
			[
				["H1", "Shows"],
				["H2", "klustered show"],
			],
		);
		assert.match(dom.text, /2 published episodes/);
		assert.match(dom.text, /recent/);
		assert(!dom.text.includes("future-") && !dom.text.includes("hidden show"));
		assert.equal(
			dom.querySelector("a").getAttribute("href"),
			"/shows/klustered",
		);
		assert.equal(
			dom.querySelector("img").getAttribute("src"),
			"/real-cover.png",
		);
		const metadata = JSON.parse(
			dom.querySelector('script[type="application/ld+json"]').text,
		);
		assert.equal(metadata.itemListElement[0].item.numberOfEpisodes, 2);
		assert.equal(metadata.numberOfItems, 1);
	}
});

test("archive with future-only episodes reports zero, and empty directory has no cards", async () => {
	const { dom } = await harness({
		collections: {
			shows: [show()],
			videos: [video("future", { publishedAt: new Date(now + 1) })],
		},
	}).render("pages/shows/index.astro");
	assert.match(dom.text, /0 published episodes/);
	assert.equal(dom.querySelectorAll("img").length, 0);
	const empty = await harness({
		collections: { shows: [show("hidden", false)] },
	}).render("pages/shows/index.astro");
	assert.equal(empty.dom.querySelectorAll("a,h2").length, 0);
	assert.match(empty.dom.text, /No shows available/);
});

test("detail/episode list/PodcastSeries agree with archive eligibility and newest-first native links", async () => {
	const h = harness({
		collections: { shows: [show()], videos: fixtureVideos() },
	});
	const { dom } = await h.render(
		"pages/shows/[showId].astro",
		{},
		{ params: { showId: "klustered" } },
	);
	const metadata = JSON.parse(
		dom.querySelector('script[type="application/ld+json"]').text,
	);
	assert.equal(metadata.numberOfEpisodes, 2);
	assert.deepEqual(
		[
			...new Set(
				dom
					.querySelectorAll('a[href^="/watch/"]')
					.map((a) => a.getAttribute("href")),
			),
		],
		["/watch/recent", "/watch/old"],
	);
	assert(!dom.text.includes("future-") && !dom.text.includes("coming soon"));
	assert.equal(
		dom.querySelector('link[type="application/rss+xml"]').getAttribute("href"),
		"/api/feeds/shows/klustered.xml",
	);
});

test("future-only detail has an honest empty state/archive link; hidden detail returns 404", async () => {
	const h = harness({
		collections: {
			shows: [show(), show("hidden", false)],
			videos: [video("future", { publishedAt: new Date(now + 1) })],
		},
	});
	const { dom } = await h.render(
		"pages/shows/[showId].astro",
		{},
		{ params: { showId: "klustered" } },
	);
	assert.match(dom.text, /No published episodes available/);
	assert.equal(dom.querySelectorAll('a[href^="/watch/"]').length, 0);
	assert(dom.querySelector('a[href="/shows"]'));
	assert(!dom.text.includes("coming soon"));
	assert.equal(
		(
			await h.render(
				"pages/shows/[showId].astro",
				{},
				{ params: { showId: "hidden" } },
			)
		).status,
		404,
	);
});

test("forged success GET cannot claim saved/entered or call registration", async () => {
	for (const locals of [{}, { user: { id: "user" } }]) {
		const h = harness();
		const result = await h.render(
			extras,
			{},
			{
				params: { showId: "klustered", slug: "apply" },
				locals,
				url: "https://academy.test/shows/klustered/apply?submitted=1",
			},
		);
		assert.equal(result.status, 200);
		assert.match(result.dom.text, /Applications are closed/);
		assert.doesNotMatch(result.dom.text, /Application saved|Entered/);
		assert.equal(result.dom.querySelectorAll("form").length, 0);
		assert.equal(h.writes.length, 0);
	}
});

test("only service-confirmed participation shows Entered; native form/auth paths are preserved", async () => {
	for (const signedIn of [false, true]) {
		for (const applied of [false, true]) {
			const h = harness({ participation: [card({ applied })] });
			const { dom } = await h.render(
				extras,
				{},
				{
					params: { showId: "klustered", slug: "apply" },
					locals: signedIn ? { user: { id: "user" } } : {},
				},
			);
			assert.equal(dom.text.includes("Entered"), applied);
			assert.equal(
				dom.querySelectorAll("form").length,
				signedIn && !applied ? 1 : 0,
			);
			if (!signedIn)
				assert.match(
					dom.querySelector("a").getAttribute("href"),
					/^\/api\/auth\/sign-in\?returnTo=/,
				);
			if (signedIn && applied)
				assert.equal(
					dom.querySelector("a").getAttribute("href"),
					"https://klustered.dev/me/profile",
				);
			if (signedIn && !applied) {
				assert.equal(dom.querySelector("form").getAttribute("method"), "POST");
				assert.equal(
					dom.querySelector("form").getAttribute("action"),
					"/api/shows/klustered/apply",
				);
				assert.equal(
					dom.querySelector('input[name="bracketId"]').getAttribute("value"),
					"b",
				);
			}
			assert.equal(h.writes.length, 0);
			assert.equal(
				h.reads[0].headers["X-Gateway-User-Id"],
				signedIn ? "user" : undefined,
			);
		}
	}
});

test("mocked application handler preserves validation/auth and redirects only after successful write", async () => {
	const user = { user: { id: "user", name: "Fixture User" } };
	const h = harness();
	const { ALL } = await h.module(api);
	assert.equal((await ALL(h.routeContext())).status, 405);
	const anonymous = await ALL(h.routeContext("POST", { bracketId: "b" }));
	assert.equal(anonymous.status, 303);
	assert.match(anonymous.headers.get("Location"), /^\/api\/auth\/sign-in/);
	assert.equal(
		(await ALL(h.routeContext("POST", { bracketId: " " }, user))).status,
		400,
	);
	assert.equal(h.writes.length, 0);
	const success = await ALL(h.routeContext("POST", { bracketId: "b" }, user));
	assert.equal(success.status, 303);
	assert.equal(success.headers.get("Location"), "/shows/klustered/apply");
	assert.deepEqual(JSON.parse(JSON.stringify(h.writes)), [
		{ bracketId: "b", displayName: "Fixture User", userId: "user" },
	]);
	const rejected = harness({ writeError: true });
	const result = await (await rejected.module(api)).ALL(
		rejected.routeContext("POST", { bracketId: "b" }, user),
	);
	assert.equal(result.status, 400);
	assert.equal(result.headers.get("Location"), null);
});

test("hidden/missing shows reject every extension before read/write dispatch", async () => {
	for (const shows of [[show("klustered", false)], []]) {
		const h = harness({ collections: { shows } });
		for (const slug of ["seasons", "brackets", "schedule", "apply"]) {
			assert.equal(
				(await h.render(extras, {}, { params: { showId: "klustered", slug } }))
					.status,
				404,
			);
		}
		const { ALL } = await h.module(api);
		for (const slug of ["apply", "live", "schedule.ics"]) {
			assert.equal(
				(
					await ALL(
						h.routeContext(
							"POST",
							{ bracketId: "b" },
							{ user: { id: "user" } },
							slug,
						),
					)
				).status,
				404,
			);
		}
		assert.equal(h.reads.length, 0);
		assert.equal(h.writes.length, 0);
	}
});

test("Klustered exposes only the apply page and endpoint until the relaunch is ready", async () => {
	const h = harness();
	const { klusteredExtension } = await h.module("shows/klustered/index.ts");
	assert.equal(
		klusteredExtension.pages.map((page) => page.slug).join(","),
		"apply",
	);
	assert.equal(
		klusteredExtension.endpoints?.map((endpoint) => endpoint.slug).join(","),
		"apply",
	);
});

test("only active, unexpired brackets link to applications, without service calls", async () => {
	const fixtures = [
		bracket({ id: "finished", name: "Finished", status: "finished" }),
		bracket({
			id: "expired",
			name: "Expired",
			status: "active",
			registrationClosesAt: new Date(now).toISOString(),
		}),
		bracket({
			id: "open",
			name: "Open",
			status: "active",
			registrationClosesAt: new Date(now + 1).toISOString(),
		}),
		bracket({ id: "no-deadline", status: "active" }),
		bracket({ id: "draft", name: "Draft" }),
	];
	const h = harness();
	const { dom } = await h.render(`${plugin}pages/Seasons.astro`, {
		showId: "klustered",
		seasons: [
			{ name: "Real Season", slug: "s", status: "active", brackets: fixtures },
		],
	});
	assert.deepEqual(
		dom.querySelectorAll("a").map((a) => a.getAttribute("href")),
		[
			"/shows/klustered/brackets",
			"/shows/klustered/brackets",
			"/shows/klustered/apply",
			"/shows/klustered/apply",
			"/shows/klustered/brackets",
		],
	);
	assert(
		dom
			.querySelectorAll("a")
			.slice(0, 2)
			.every(
				(a) =>
					a.text.includes("View bracket") && !a.text.includes("Apply"),
			),
	);
	assert.equal(h.reads.length, 0);
	assert.equal(h.writes.length, 0);
});

test("schedule retains all noncancelled matches with year/UTC, truthful status and separate history", async () => {
	const matches = [
		{
			id: "old",
			status: "completed",
			scheduledAt: "2021-04-01T16:00:00Z",
			winner: { displayName: "Winner" },
		},
		{ id: "future", status: "scheduled", scheduledAt: "2027-04-01T16:00:00Z" },
		{
			id: "cancelled",
			status: "cancelled",
			sideA: { displayName: "Do not render" },
		},
		{ id: "missing", status: "scheduled" },
		{ id: "bad-date", status: "scheduled", scheduledAt: "invalid" },
		{ id: "live", status: "live", scheduledAt: "2026-09-20T11:00:00Z" },
		{ id: "no-winner", status: "completed" },
	];
	const before = JSON.stringify(matches);
	const { dom } = await harness().render(`${plugin}pages/Schedule.astro`, {
		matches,
	});
	assert.deepEqual(
		dom.querySelectorAll("h2").map((n) => n.text),
		["Live and upcoming matches", "Times to be announced", "Past matches"],
	);
	assert.equal(dom.querySelectorAll("li").length, 6);
	assert.equal(dom.querySelectorAll("time").length, 3);
	for (const time of dom.querySelectorAll("time")) {
		assert.match(time.text, /20\d\d.*UTC/);
		assert(Number.isFinite(Date.parse(time.getAttribute("datetime"))));
	}
	assert.match(dom.text, /2021.*16:00 UTC/);
	assert.match(dom.text, /2027.*16:00 UTC/);
	assert.match(dom.text, /Winner won/);
	assert.match(dom.text, /Completed/);
	assert.match(dom.text, /Time unavailable/);
	assert.equal(dom.text.match(/Time to be announced/g).length, 2);
	assert.equal(dom.text.match(/LIVE/g).length, 1);
	assert(
		!dom.text.includes("Do not render") && !dom.text.includes("Invalid Date"),
	);
	assert.equal(JSON.stringify(matches), before);
});

test("empty schedule/seasons have honest empty states and no actions", async () => {
	for (const [page, props] of [
		["Schedule", { matches: [] }],
		["Seasons", { showId: "klustered", seasons: [] }],
	]) {
		const { dom } = await harness().render(
			`${plugin}pages/${page}.astro`,
			props,
		);
		assert.equal(dom.querySelectorAll("a,button,form,li").length, 0);
		assert.doesNotMatch(dom.text, /ready for signups|Application saved/);
	}
});

test("real RSS and chapter handlers share publication cutoff/membership and preserve media/chapter values", async () => {
	const h = harness({
		collections: {
			shows: [show(), show("hidden", false)],
			videos: fixtureVideos(),
		},
	});
	const rss = await h.module(feed),
		chapter = await h.module(chapters);
	const paths = await rss.getStaticPaths();
	assert.deepEqual(JSON.parse(JSON.stringify(paths)), [
		{ params: { showId: "klustered" } },
	]);
	const response = await rss.GET({
		params: { showId: "klustered" },
		site: new URL("https://academy.test"),
	});
	assert.equal(response.status, 200);
	assert.match(response.headers.get("Content-Type"), /rss\+xml/);
	const xml = parse(await response.text());
	assert.deepEqual(
		xml.querySelectorAll("item title").map((n) => n.text),
		["recent", "old"],
	);
	assert.match(
		xml.querySelector("enclosure").getAttribute("url"),
		/\/recent\/original\.mp3$/,
	);
	const chapterPaths = JSON.parse(
		JSON.stringify(await chapter.getStaticPaths()),
	);
	assert.deepEqual(
		chapterPaths.map((p) => p.params.episodeId),
		["recent", "old"],
	);
	const good = await chapter.GET({
		params: { showId: "klustered", episodeId: "recent" },
	});
	assert.equal(good.status, 200);
	assert.deepEqual(await good.json(), {
		version: "1.2.0",
		chapters: [{ startTime: 0, title: "Start" }],
	});
	for (const episodeId of [
		"future-recorded",
		"future-live",
		"other",
		"missing",
	]) {
		assert.equal(
			(await chapter.GET({ params: { showId: "klustered", episodeId } }))
				.status,
			404,
		);
	}
	for (const showId of ["hidden", "missing"]) {
		assert.equal((await rss.GET({ params: { showId } })).status, 404);
		assert.equal(
			(await chapter.GET({ params: { showId, episodeId: "recent" } })).status,
			404,
		);
	}
	assert.equal(h.reads.length, 0);
	assert.equal(h.writes.length, 0);
});
