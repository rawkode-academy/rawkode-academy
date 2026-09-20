// From website: node --experimental-vm-modules --test src/tests/watch-recommendations.test.mjs
// Execute the page's actual selection block and render its recommendation branch.
// Collection, player, captions, auth, and live services are never called.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { transform } from "@astrojs/compiler";
import * as runtime from "astro/runtime/server/index.js";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { parse } from "node-html-parser";

const source = readFileSync(
	new URL("../pages/watch/[...slug].astro", import.meta.url),
	"utf8",
);
const selection = source.slice(
	source.indexOf("const RELATED_VIDEO_LIMIT"),
	source.indexOf("const hostEntries"),
);
assert(selection.includes("technologyRecommendation"));
const transpile = (input) =>
	ts.transpileModule(input, {
		compilerOptions: {
			target: ts.ScriptTarget.ES2022,
			module: ts.ModuleKind.ESNext,
		},
	}).outputText;
const normalization = readFileSync(
	new URL("../utils/normalize-technology-refs.ts", import.meta.url),
	"utf8",
);
const normalizer = new vm.SourceTextModule(transpile(normalization));
await normalizer.link(() => {
	throw new Error("Unexpected normalizer import");
});
await normalizer.evaluate();

const makeVideo = (slug, changes = {}) => ({
	id: slug,
	data: {
		id: `asset-${slug}`,
		slug,
		title: `Title ${slug}`,
		duration: 65,
		publishedAt: new Date("2025-01-01"),
		technologies: ["first"],
		show: "show",
		...changes,
	},
});
const current = makeVideo("current", {
	technologies: ["first", { id: "second/index" }, "third", "fourth", "fifth"],
});
const show = { id: "show", data: { name: "Fixture show" } };
async function select(videos, showEntry = show, video = current) {
	const lookups = [];
	const selected = await vm.runInNewContext(
		`(async () => { ${transpile(selection)}; return { showEntry, showRelatedAll, showRelatedVideos, technologyRecommendation, techEntries }; })()`,
		{
			videos,
			video,
			slug: video.data.slug,
			showEntry,
			normalizeTechnologyReferences:
				normalizer.namespace.normalizeTechnologyReferences,
			getVideoThumbnailUrl: (id) => `https://example.test/${id}.webp`,
			getEntry: async (collection, id) => {
				assert.equal(collection, "technologies");
				lookups.push(id);
				if (id === "missing") throw new Error("No matching technology");
				return { id: `${id}/index`, data: { name: id } };
			},
		},
	);
	return { ...selected, lookups };
}

async function renderRecommendations(props) {
	const calls = [];
	const markup = source.slice(
		source.indexOf("{showEntry && showRelatedVideos.length > 0 ?"),
		source.indexOf("<NewsletterCTA />"),
	);
	assert(markup.includes("TechnologyVideoSection"));
	const input = `---\nimport ShowVideoSection from "show";\nimport TechnologyVideoSection from "technology";\nconst { showEntry, showRelatedAll, showRelatedVideos, technologyRecommendation } = Astro.props;\n---\n${markup}`;
	const compiled = await transform(input, {
		filename: "recommendations.astro",
	});
	assert.deepEqual(compiled.diagnostics, []);
	const context = vm.createContext({ URL });
	const stub = (kind) =>
		runtime.createComponent((_, props) => {
			calls.push({ kind, props });
			return runtime.render(
				['<section data-recommendation="', '">', "</section>"],
				kind,
				props.videos.map((video) =>
					runtime.render(
						['<a href="/watch/', '">', "</a>"],
						video.slug,
						video.title,
					),
				),
			);
		});
	const mocks = {
		"astro/runtime/server/index.js": { ...runtime, createMetadata: () => ({}) },
		show: { default: stub("show") },
		technology: { default: stub("technology") },
	};
	const module = new vm.SourceTextModule(transpile(compiled.code), { context });
	await module.link((specifier) => {
		const exports = mocks[specifier];
		assert(exports, `Unexpected import ${specifier}`);
		return new vm.SyntheticModule(
			Object.keys(exports),
			function () {
				for (const [key, value] of Object.entries(exports))
					this.setExport(key, value);
			},
			{ context },
		);
	});
	await module.evaluate();
	const container = await AstroContainer.create();
	const html = await container.renderToString(module.namespace.default, {
		props,
	});
	return { calls, dom: parse(html) };
}

test("one show section wins, capped at six newest, without reading technology recommendations", async () => {
	const alternatives = Array.from({ length: 9 }, (_, i) =>
		makeVideo(`show-${i}`, {
			show: { id: "show/index" },
			publishedAt: new Date(`2025-01-${String(i + 1).padStart(2, "0")}`),
		}),
	);
	for (const video of alternatives)
		Object.defineProperty(video.data, "technologies", {
			get() {
				throw new Error("Technology recommendations must be skipped");
			},
		});
	const selected = await select([current, ...alternatives]);
	assert.equal(selected.showRelatedAll.length, 9);
	assert.equal(selected.technologyRecommendation, null);
	assert.deepEqual(
		Array.from(selected.showRelatedVideos, (video) => video.slug),
		["show-8", "show-7", "show-6", "show-5", "show-4", "show-3"],
	);
	assert.equal(
		selected.techEntries.length,
		5,
		"All technology profiles still resolve for chips",
	);
	const { dom, calls } = await renderRecommendations(selected);
	assert.equal(dom.querySelectorAll("section").length, 1);
	assert.equal(dom.querySelectorAll("a").length, 6);
	assert.equal(calls[0].kind, "show");
	assert.equal(calls[0].props.totalVideos, 9);
});

test("fallback chooses only the first declared technology with published alternatives", async () => {
	const alternatives = Array.from({ length: 8 }, (_, i) =>
		makeVideo(`second-${i}`, {
			show: undefined,
			technologies: [{ id: "second/index" }],
			publishedAt: new Date(`2025-01-${String(i + 1).padStart(2, "0")}`),
		}),
	);
	const selected = await select([
		current,
		makeVideo("later-technology", { show: undefined, technologies: ["third"] }),
		...alternatives,
	]);
	assert.equal(selected.showRelatedVideos.length, 0);
	assert.equal(selected.technologyRecommendation.technology.id, "second/index");
	assert.equal(selected.technologyRecommendation.totalVideos, 8);
	assert.equal(selected.technologyRecommendation.videos.length, 6);
	assert.equal(selected.technologyRecommendation.videos[0].slug, "second-7");
	const { dom, calls } = await renderRecommendations(selected);
	assert.equal(dom.querySelectorAll("section").length, 1);
	assert.equal(dom.querySelectorAll("a").length, 6);
	assert.equal(calls[0].kind, "technology");
});

test("current and future videos cannot become recommendations or inflate totals", async () => {
	const future = ["recorded", "live"].map((type) =>
		makeVideo(`future-${type}`, { type, publishedAt: new Date("2999-01-01") }),
	);
	const eligible = makeVideo("published", { show: undefined });
	const selected = await select([current, ...future, eligible]);
	assert.equal(selected.showRelatedAll.length, 0);
	assert.equal(selected.technologyRecommendation.totalVideos, 1);
	assert.equal(selected.technologyRecommendation.videos[0].slug, "published");
	const none = await select([current, ...future]);
	assert.equal(none.technologyRecommendation, null);
	assert.equal(
		(await renderRecommendations(none)).dom.querySelectorAll("section").length,
		0,
	);
});

test("missing show/technology and empty catalogs stay safe without changing caller data", async () => {
	const video = makeVideo("current", { technologies: ["missing", "second"] });
	const alternatives = [
		video,
		makeVideo("published", { technologies: ["second"], show: undefined }),
	];
	Object.freeze(alternatives);
	const selected = await select(alternatives, null, video);
	assert.equal(selected.technologyRecommendation.technology.id, "second/index");
	assert.equal(alternatives[0], video);
	assert.equal(selected.techEntries.length, 1);
	const empty = await select(
		[makeVideo("current", { technologies: [] })],
		null,
		makeVideo("current", { technologies: [] }),
	);
	assert.equal(empty.technologyRecommendation, null);
});

test("breadcrumb status exists only for actual live/upcoming states; page remains valid Astro", async () => {
	const status = source.match(/const watchStatusLabel = [\s\S]*?;/)?.[0];
	assert(status);
	for (const [isLiveNow, isUpcomingLive, expected] of [
		[true, false, "Live now"],
		[false, true, "Upcoming"],
		[false, false, null],
	]) {
		assert.equal(
			vm.runInNewContext(`${status}\nwatchStatusLabel`, {
				isLiveNow,
				isUpcomingLive,
			}),
			expected,
		);
	}
	assert(source.includes("{watchStatusLabel && <span"));
	assert(
		!/On demand|getVideosForTechnology|suggestedVideoSlugs|videosPerTechnology|technologiesWithVideos/.test(
			source,
		),
	);
	assert(source.includes("techEntries.map((tech) =>"));
	assert.deepEqual(
		(await transform(source, { filename: "watch/[...slug].astro" }))
			.diagnostics,
		[],
	);
});
