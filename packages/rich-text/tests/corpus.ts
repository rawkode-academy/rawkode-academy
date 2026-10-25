import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { load } from "js-yaml";

// A checked-in sample of the former content/ tree (same layout), covering every
// node and mark the converter produces. Content itself now lives in D1.
const fixturesRoot = join(import.meta.dir, "fixtures");

export interface CorpusEntry {
	collection: string;
	file: string;
	field: string;
	mdx: boolean;
	source: string;
}

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;

// js-yaml is the parser Astro uses for frontmatter; Bun.YAML and yaml reject
// some of the multi-line quoted descriptions.
function splitFrontmatter(raw: string): {
	data: Record<string, unknown>;
	body: string;
} {
	const match = raw.match(FRONTMATTER);
	if (!match) return { data: {}, body: raw };
	return {
		data: (load(match[1] ?? "") ?? {}) as Record<string, unknown>,
		body: raw.slice(match[0].length),
	};
}

function listDir(path: string): string[] {
	try {
		return readdirSync(path);
	} catch {
		return [];
	}
}

function walk(dir: string, depth = Number.POSITIVE_INFINITY): string[] {
	const out: string[] = [];
	for (const name of listDir(dir).sort()) {
		const path = join(dir, name);
		if (statSync(path).isDirectory()) {
			if (depth > 1) out.push(...walk(path, depth - 1));
		} else if (/\.mdx?$/.test(name)) {
			out.push(path);
		}
	}
	return out;
}

function bodies(
	root: string,
	collection: string,
	files: string[],
): CorpusEntry[] {
	return files.map((path) => ({
		collection,
		file: relative(root, path),
		field: "body",
		mdx: path.endsWith(".mdx"),
		source: splitFrontmatter(readFileSync(path, "utf8")).body,
	}));
}

function frontmatterField(
	root: string,
	collection: string,
	files: string[],
	field: string,
): CorpusEntry[] {
	return files.flatMap((path) => {
		const value = splitFrontmatter(readFileSync(path, "utf8")).data[field];
		if (typeof value !== "string") return [];
		return [
			{
				collection,
				file: relative(root, path),
				field,
				mdx: false,
				source: value,
			},
		];
	});
}

// Mirrors the former content collections' glob patterns, so only files the
// site loaded are part of the corpus (course example apps carry READMEs).
export function loadCorpus(root = fixturesRoot): CorpusEntry[] {
	const dir = (name: string) => join(root, name);
	const technologies = listDir(dir("technologies"))
		.sort()
		.map((id) => join(dir("technologies"), id, "index.mdx"))
		.filter((path) => {
			try {
				return statSync(path).isFile();
			} catch {
				return false;
			}
		});
	return [
		...bodies(root, "articles", walk(dir("articles"))),
		...bodies(root, "news", walk(dir("news"))),
		...bodies(root, "adrs", walk(dir("adrs"))),
		...bodies(root, "changelog", walk(dir("changelog"))),
		...frontmatterField(
			root,
			"changelog",
			walk(dir("changelog")),
			"description",
		),
		...bodies(root, "courses", walk(dir("courses"), 1)),
		...bodies(
			root,
			"courseModules",
			walk(dir("courses"), 2).filter(
				(path) => relative(dir("courses"), path).split("/").length === 2,
			),
		),
		...bodies(root, "learningPaths", walk(dir("learning-paths"))),
		...bodies(root, "technologies", technologies),
		...bodies(root, "people", walk(dir("people"))),
		...frontmatterField(root, "shows", walk(dir("shows")), "description"),
		...frontmatterField(root, "videos", walk(dir("videos")), "description"),
	];
}
