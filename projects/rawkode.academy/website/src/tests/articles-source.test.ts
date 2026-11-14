import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { getCollection } from "astro:content";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	articleId,
	loadArticleFiles,
	loadSeriesFiles,
} from "@/lib/articles/loader";
import {
	ArticleError,
	checkSeries,
	parseArticle,
	parseSeries,
} from "@/lib/articles/source";
import { getAllSeries } from "@/lib/live-content/articles";

const noAssets = (path: string): never => {
	throw new Error(`unexpected asset ${path}`);
};

const file = (frontmatter: string, body = "Hello **world**.\n") => ({
	id: "example",
	file: "content/articles/example.mdx",
	mdx: true,
	raw: `---\n${frontmatter}\n---\n\n${body}`,
});

const MINIMAL = [
	'title: "An example"',
	"description: What the example is about.",
	"publishedAt: 2026-01-02",
	"authors:",
	"  - rawkode",
].join("\n");

describe("article files", () => {
	it("map frontmatter and body to the entry data the pages render", () => {
		const data = parseArticle(
			file(
				[
					MINIMAL,
					"type: guide",
					"technologies:",
					"  - kubernetes",
					"cover:",
					"  image: https://content.rawkode.academy/articles/example/cover.jpeg",
					"  alt: A cover",
					"  width: 1600",
					"  height: 900",
					"updates:",
					"  - date: 2026-02-03",
					"    description: Corrected the example",
				].join("\n"),
			),
			noAssets,
		);
		expect(data).toMatchObject({
			title: "An example",
			type: "guide",
			howto: false,
			draft: false,
			publishedAt: new Date("2026-01-02"),
			// With no updatedAt, the latest update is the revision date.
			updatedAt: new Date("2026-02-03"),
			authors: [{ collection: "people", id: "rawkode" }],
			technologies: ["kubernetes"],
			categories: [],
			tags: [],
			cover: {
				image: {
					src: "https://content.rawkode.academy/articles/example/cover.jpeg",
					width: 1600,
					height: 900,
					format: "jpg",
				},
				alt: "A cover",
			},
		});
		expect(data.body?.content[0]).toMatchObject({ type: "paragraph" });
		expect("subtitle" in data).toBe(false);
		expect("resources" in data).toBe(false);
	});

	it("resolve a cover beside the article and take its size from the file", () => {
		const data = parseArticle(
			file(`${MINIMAL}\ncover:\n  image: ./cover.png\n  alt: A cover`),
			(path) => {
				expect(path).toBe("./cover.png");
				return {
					src: "/_content/articles/example/cover.png",
					width: 800,
					height: 450,
				};
			},
		);
		expect(data.cover?.image).toEqual({
			src: "/_content/articles/example/cover.png",
			width: 800,
			height: 450,
			format: "png",
		});
	});

	it("name the file and the field when frontmatter is wrong", () => {
		expect(() => parseArticle(file("title: Only a title"), noAssets)).toThrow(
			/content\/articles\/example\.mdx: invalid frontmatter .*description/,
		);
		expect(() =>
			parseArticle(file(`${MINIMAL}\npublishdAt: 2026-01-01`), noAssets),
		).toThrow(/publishdAt/);
		expect(() =>
			parseArticle(
				file(
					`${MINIMAL}\ncover:\n  image: https://example.com/c.png\n  alt: x`,
				),
				noAssets,
			),
		).toThrow(/cover\.width and cover\.height/);
		expect(() =>
			parseArticle({ ...file(""), raw: "No frontmatter" }, noAssets),
		).toThrow(ArticleError);
	});

	it("reject components the site does not provide", () => {
		expect(() =>
			parseArticle(file(MINIMAL, "<Unknown />\n"), noAssets),
		).toThrow(/content\/articles\/example\.mdx/);
	});
});

describe("series", () => {
	const seriesFile = (frontmatter: string, body = "") => ({
		id: "understanding-mcp",
		file: "content/series/understanding-mcp.md",
		mdx: false,
		raw: `---\n${frontmatter}\n---\n\n${body}`,
	});
	const SERIES =
		'title: "Understanding MCP"\ndescription: One piece at a time.';

	it("carry an article's series", () => {
		const data = parseArticle(
			file(`${MINIMAL}\nseries: understanding-mcp`),
			noAssets,
		);
		expect(data.series).toBe("understanding-mcp");
	});

	it("order published parts by file name and leave out series without one", async () => {
		const article = (id: string, series?: string) => ({
			id,
			data: {
				title: id,
				description: id,
				publishedAt: new Date("2026-01-01"),
				authors: [],
				categories: [],
				tags: [],
				technologies: [],
				type: "article",
				howto: false,
				draft: false,
				...(series ? { series } : {}),
			},
		});
		const meta = { title: "T", description: "D" };
		vi.mocked(getCollection).mockImplementation((async (name: string) =>
			name === "series"
				? [
						{ id: "understanding-mcp", data: meta },
						{ id: "not-started", data: meta },
					]
				: [
						article("10-servers", "understanding-mcp"),
						article("2-tools", "understanding-mcp"),
						article("0-what-is-mcp", "understanding-mcp"),
						article("how-i-git"),
					]) as never);
		const series = await getAllSeries();
		expect(series.map(({ id }) => id)).toEqual(["understanding-mcp"]);
		expect(series[0]?.parts.map(({ id }) => id)).toEqual([
			"0-what-is-mcp",
			"2-tools",
			"10-servers",
		]);
	});

	it("map a series file to its title, description, cover and intro", () => {
		expect(parseSeries(seriesFile(SERIES), noAssets)).toEqual({
			title: "Understanding MCP",
			description: "One piece at a time.",
		});
		const data = parseSeries(
			seriesFile(
				`${SERIES}\ncover:\n  image: ./cover.png\n  alt: A cover`,
				"Start **here**.\n",
			),
			() => ({
				src: "/_content/series/understanding-mcp/cover.png",
				width: 8,
				height: 4,
			}),
		);
		expect(data.cover?.image.src).toBe(
			"/_content/series/understanding-mcp/cover.png",
		);
		expect(JSON.stringify(data.body)).toContain("here");
		expect(() =>
			parseSeries(seriesFile(`${SERIES}\npart: 1`), noAssets),
		).toThrow(
			/content\/series\/understanding-mcp\.md: invalid frontmatter .*part/,
		);
	});

	it("fail when an article names a series that has no file", () => {
		const known = new Set(["understanding-mcp"]);
		expect(() =>
			checkSeries(
				[
					{ file: "a.mdx", data: { series: "understanding-mcp" } },
					{ file: "b.mdx", data: {} },
				],
				known,
			),
		).not.toThrow();
		expect(() =>
			checkSeries([{ file: "a.mdx", data: { series: "unknown" } }], known),
		).toThrow(/a\.mdx: series "unknown" does not exist/);
	});
});

describe("the articles directory", () => {
	const temporary: string[] = [];
	const scratch = () => {
		const dir = mkdtempSync(join(tmpdir(), "articles-"));
		temporary.push(dir);
		return dir;
	};
	afterEach(() => {
		for (const dir of temporary.splice(0)) {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("uses the file name, or the directory of an index file, as the slug", () => {
		expect(articleId("/c", "/c/how-i-git.mdx")).toBe("how-i-git");
		expect(articleId("/c", "/c/seccomp/index.md")).toBe("seccomp");
	});

	it("copies images referenced by a relative path and rejects bad slugs", async () => {
		const root = join(scratch(), "articles");
		const assets = join(scratch(), "public");
		mkdirSync(join(root, "with-image"), { recursive: true });
		writeFileSync(join(root, "with-image", "shot.png"), "not really a png");
		writeFileSync(
			join(root, "with-image", "index.md"),
			`---\n${MINIMAL}\n---\n\n![A screenshot](./shot.png)\n`,
		);
		const [article] = await loadArticleFiles(root, assets);
		expect(article?.id).toBe("with-image");
		expect(JSON.stringify(article?.data.body)).toContain(
			"/_content/articles/with-image/shot.png",
		);
		expect(existsSync(join(assets, "with-image", "shot.png"))).toBe(true);

		writeFileSync(join(root, "Bad Name.md"), `---\n${MINIMAL}\n---\n\nText\n`);
		await expect(loadArticleFiles(root, assets)).rejects.toThrow(
			/not a valid slug/,
		);
	});

	it("copies a series cover to /_content/series, and needs no series directory", async () => {
		const root = join(scratch(), "series");
		const assets = join(scratch(), "public");
		expect(await loadSeriesFiles(root, assets)).toEqual([]);
		mkdirSync(join(root, "understanding-mcp"), { recursive: true });
		writeFileSync(join(root, "understanding-mcp", "cover.png"), "not a png");
		writeFileSync(
			join(root, "understanding-mcp", "index.md"),
			"---\ntitle: MCP\ndescription: D.\ncover:\n  image: ./cover.png\n  alt: A\n  width: 8\n  height: 4\n---\n",
		);
		const [series] = await loadSeriesFiles(root, assets);
		expect(series?.id).toBe("understanding-mcp");
		expect(series?.data.cover?.image.src).toBe(
			"/_content/series/understanding-mcp/cover.png",
		);
		expect(existsSync(join(assets, "understanding-mcp", "cover.png"))).toBe(
			true,
		);
	});

	it("loads every article committed to content/articles", async () => {
		const repository = resolve(__dirname, "../../../../..");
		const articles = await loadArticleFiles(
			join(repository, "content", "articles"),
			join(scratch(), "public"),
		);
		expect(articles.length).toBeGreaterThan(30);
		for (const article of articles) {
			expect(article.data.authors.length).toBeGreaterThan(0);
			expect(article.data.body?.content.length).toBeGreaterThan(0);
		}
	});
});
