// Builds the cutover seeds (new databases) and backfills (live databases)
// from a content/ tree as it was at a git revision.
//
//   bun scripts/build-seeds.ts --content <dir>/content --rev cc079bee7 --out <dir>
//
// <dir>/content is `git archive <rev> content | tar -x -C <dir>`. Timestamps
// (updated_at) are the last commit that touched each file at <rev>. Diagrams
// are rendered with the d2 CLI, which must be on PATH.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { basename, dirname, extname, join, posix, relative } from "node:path";
import { parseArgs } from "node:util";
import {
	type DiagramSource,
	fromMarkdown,
	type ResolvedAsset,
} from "../../../../../packages/rich-text/src/markdown/index";
import { validateDoc } from "../../../../../packages/rich-text/src/schema";
import { imageSize } from "./image-size";

const richText = createRequire(
	join(import.meta.dir, "../../../../../packages/rich-text/package.json"),
);
const { load } = richText("js-yaml") as typeof import("js-yaml");
const GithubSlugger = richText("github-slugger").default as typeof import("github-slugger").default;

const { values: args } = parseArgs({
	options: {
		content: { type: "string" },
		rev: { type: "string" },
		out: { type: "string" },
		repo: { type: "string", default: process.cwd() },
	},
});
if (!args.content || !args.rev || !args.out)
	throw new Error("usage: --content <dir> --rev <git rev> --out <dir>");
const CONTENT = args.content;
const REV = args.rev;
const OUT = args.out;
const REPO = args.repo as string;
const CDN = "https://content.rawkode.academy";

// D1 rejects statements over 100 KB; long bodies are appended in chunks.
const MAX_STATEMENT = 90_000;

type Row = Record<string, unknown>;
type Data = Record<string, any>;

// ---------------------------------------------------------------- reading

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;

// js-yaml is the parser Astro used for frontmatter.
function readEntry(path: string): { data: Data; body: string } {
	const raw = readFileSync(path, "utf8");
	const match = raw.match(FRONTMATTER);
	if (!match) return { data: {}, body: raw };
	return {
		data: (load(match[1] ?? "") ?? {}) as Data,
		body: raw.slice(match[0].length),
	};
}

function walk(dir: string, depth = Number.POSITIVE_INFINITY, pattern = /\.mdx?$/): string[] {
	const out: string[] = [];
	let names: string[];
	try {
		names = readdirSync(dir).sort();
	} catch {
		return out;
	}
	for (const name of names) {
		const path = join(dir, name);
		if (statSync(path).isDirectory()) {
			if (depth > 1) out.push(...walk(path, depth - 1, pattern));
		} else if (pattern.test(name)) out.push(path);
	}
	return out;
}

const rel = (path: string) => relative(CONTENT, path);

// Astro's glob loader id: frontmatter slug, else the slugged path without
// its extension and a trailing /index.
function entryId(base: string, path: string, data: Data): string {
	if (typeof data.slug === "string" && data.slug) return data.slug;
	const entry = relative(base, path).replace(new RegExp(`${extname(path).replace(".", "\\.")}$`), "");
	const slugger = new GithubSlugger();
	return entry
		.split("/")
		.map((segment) => {
			slugger.reset();
			return slugger.slug(segment);
		})
		.join("/")
		.replace(/\/index$/, "");
}

const commitTimes = new Map<string, number>();
function updatedAt(path: string): number {
	const key = rel(path);
	let time = commitTimes.get(key);
	if (time === undefined) {
		const out = execFileSync("git", ["-C", REPO, "log", "-1", "--format=%ct", REV, "--", `content/${key}`], {
			encoding: "utf8",
		}).trim();
		if (!out) throw new Error(`no commit touches content/${key} at ${REV}`);
		time = Number(out) * 1000;
		commitTimes.set(key, time);
	}
	return time;
}

// z.coerce.date(): js-yaml yields Date for unquoted dates, strings otherwise.
function date(value: unknown, field: string, path: string): Date {
	const parsed = value instanceof Date ? value : new Date(String(value));
	if (value === undefined || Number.isNaN(parsed.getTime()))
		throw new Error(`${rel(path)}: invalid ${field}: ${value}`);
	return parsed;
}
const ms = (d: Date) => d.getTime();
const seconds = (d: Date) => Math.floor(d.getTime() / 1000);
const optional = <T>(value: T | undefined | null) => (value === undefined ? null : value);
const json = (value: unknown) => JSON.stringify(value);

// ---------------------------------------------------------------- assets

// R2 objects to upload: `content` files are relative to content/, rendered
// ones (diagrams) to the output directory.
export interface Asset {
	key: string;
	content?: string;
	rendered?: string;
	contentType: string;
}
const assets = new Map<string, Asset>();

const CONTENT_TYPES: Record<string, string> = {
	".png": "image/png",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".webp": "image/webp",
	".gif": "image/gif",
	".svg": "image/svg+xml",
	".avif": "image/avif",
};

// An entry's assets are published under <collection>/<entry id>/<file name>,
// wherever the file sits in content/ (zed-show-and-tell's are in articles/images).
// `entry` is that <collection>/<entry id> prefix.
function resolveAsset(path: string, from: string, entry: string): ResolvedAsset {
	const source = posix.normalize(posix.join(dirname(rel(from)), path));
	if (source.startsWith("..")) throw new Error(`${rel(from)}: ${path} escapes content/`);
	const file = join(CONTENT, source);
	const key = `${entry}/${posix.basename(source)}`;
	const existing = assets.get(key);
	if (existing && existing.content !== source) throw new Error(`${key}: both ${existing.content} and ${source}`);
	assets.set(key, {
		key,
		content: source,
		contentType: CONTENT_TYPES[extname(key).toLowerCase()] ?? "application/octet-stream",
	});
	const size = imageSize(file);
	return { src: `${CDN}/${key}`, width: size?.width ?? null, height: size?.height ?? null };
}

function cover(data: Data, path: string, entry: string): Row {
	const image = data.cover?.image;
	if (!image) return { cover_url: null, cover_alt: optional(data.cover?.alt), cover_width: null, cover_height: null };
	const asset = /^https?:\/\//.test(image)
		? { src: image, width: null, height: null }
		: resolveAsset(image, path, entry);
	return {
		cover_url: asset.src,
		cover_alt: optional(data.cover.alt),
		cover_width: asset.width ?? null,
		cover_height: asset.height ?? null,
	};
}

// astro-d2's defaults, as the site rendered diagrams before (`d2({ inline: true })`).
const D2_DEFAULTS = { theme: "0", darkTheme: "200", layout: "dagre", pad: "100", sketch: "false" };

function d2Options(meta: string | null): Record<string, string> {
	const options: Record<string, string> = { ...D2_DEFAULTS };
	for (const match of (meta ?? "").matchAll(/(\w+)=(?:"([^"]*)"|'([^']*)'|(\S+))/g)) {
		const [, name, a, b, c] = match;
		if (name) options[name] = a ?? b ?? c ?? "";
	}
	return options;
}

const diagramsDir = join(OUT, "diagrams");
function renderDiagram(diagram: DiagramSource, entry: string): string {
	const options = d2Options(diagram.meta);
	const hash = createHash("sha256")
		.update(json({ source: diagram.source, options }))
		.digest("hex")
		.slice(0, 16);
	const key = `${entry}/diagrams/${hash}.svg`;
	const file = join(diagramsDir, key);
	mkdirSync(dirname(file), { recursive: true });
	const flags = [
		`--theme=${options.theme}`,
		`--dark-theme=${options.darkTheme}`,
		`--layout=${options.layout}`,
		`--pad=${options.pad}`,
		`--sketch=${options.sketch}`,
	];
	execFileSync("d2", [...flags, "-", file], { input: diagram.source, stdio: ["pipe", "ignore", "pipe"] });
	assets.set(key, { key, rendered: relative(OUT, file), contentType: "image/svg+xml" });
	return `${CDN}/${key}`;
}

// `normalize` writes the document as ProseMirror serializes it (a text node's
// marks before its text), as the articles seed did; the others kept the
// converter's key order.
function richTextDoc(
	markdown: string,
	path: string,
	entry: string,
	options: { mdx?: boolean; breaks?: boolean; normalize?: boolean } = {},
): string {
	const doc = fromMarkdown(markdown, {
		mdx: options.mdx ?? path.endsWith(".mdx"),
		breaks: options.breaks,
		file: rel(path),
		assetResolver: (asset) => resolveAsset(asset, path, entry),
		diagramResolver: (diagram) => renderDiagram(diagram, entry),
	});
	const node = validateDoc(doc);
	return json(options.normalize ? node.toJSON() : doc);
}

// ---------------------------------------------------------------- shapes

// resourceSchema's output: keys in schema order, defaults applied. A
// WebContainer import's localDir becomes the demo id "<course>/<demo>" under
// website/src/webcontainer-demos.
function resource(input: Data, course?: string): Data {
	const out: Data = {};
	for (const key of ["id", "title", "description", "type", "url", "filePath"])
		if (input[key] !== undefined) out[key] = input[key];
	if (input.embedConfig !== undefined) {
		const e = input.embedConfig;
		const embed: Data = { container: e.container, src: e.src, height: e.height ?? "600px", width: e.width ?? "100%" };
		if (e.files !== undefined) embed.files = e.files;
		if (e.import !== undefined) {
			if (!course) throw new Error(`embedConfig.import outside a course: ${e.import.localDir}`);
			embed.import = { localDir: `${course}/${posix.basename(e.import.localDir)}` };
		}
		if (e.startCommand !== undefined) embed.startCommand = e.startCommand;
		out.embedConfig = embed;
	}
	out.category = input.category ?? "other";
	return out;
}
const resources = (value: unknown, course?: string) =>
	Array.isArray(value) ? value.map((r) => resource(r, course)) : undefined;

const authorsOf = (data: Data): string[] => data.authors ?? ["rawkode"];
const stripIndex = (id: string) => id.replace(/\/index$/, "");

function joinRows(table: string, key: string, other: string, id: string, values: string[]): Row[] {
	void table;
	return values.map((value, position) => ({ [key]: id, [other]: stripIndex(value), position }));
}

// ---------------------------------------------------------------- SQL

function literal(value: unknown): string {
	if (value === null || value === undefined) return "NULL";
	if (typeof value === "boolean") return value ? "1" : "0";
	if (typeof value === "number") {
		if (!Number.isFinite(value)) throw new Error(`non-finite number ${value}`);
		return String(value);
	}
	if (typeof value === "string") return `'${value.replaceAll("'", "''")}'`;
	throw new Error(`cannot write ${typeof value} as SQL`);
}
const ident = (name: string) => `\`${name}\``;

// A row as INSERT, with long text columns appended by UPDATE so that no
// statement exceeds MAX_STATEMENT.
function insert(table: string, row: Row, keys: Row): string[] {
	const columns = Object.keys(row);
	const deferred = new Map<string, string>();
	const values = columns.map((column) => {
		const value = row[column];
		if (typeof value === "string" && value.length > MAX_STATEMENT / 2) {
			deferred.set(column, value);
			return "''";
		}
		return literal(value);
	});
	const statements = [
		`INSERT INTO ${ident(table)} (${columns.map(ident).join(", ")}) VALUES (${values.join(", ")});`,
	];
	for (const [column, value] of deferred) statements.push(...append(table, column, value, keys));
	return statements;
}

function append(table: string, column: string, value: string, keys: Row): string[] {
	const where = Object.entries(keys)
		.map(([k, v]) => `${ident(k)} = ${literal(v)}`)
		.join(" AND ");
	const out: string[] = [];
	let chunk = "";
	// Chunk on code points so a surrogate pair is never split.
	const flush = () => {
		if (chunk) out.push(`UPDATE ${ident(table)} SET ${ident(column)} = ${ident(column)} || ${literal(chunk)} WHERE ${where};`);
		chunk = "";
	};
	for (const char of value) {
		chunk += char;
		if (chunk.length >= MAX_STATEMENT / 2) flush();
	}
	flush();
	return out;
}

function update(table: string, set: Row, keys: Row): string[] {
	const small: Row = {};
	const large = new Map<string, string>();
	for (const [column, value] of Object.entries(set)) {
		if (typeof value === "string" && value.length > MAX_STATEMENT / 2) large.set(column, value);
		else small[column] = value;
	}
	for (const column of large.keys()) small[column] = "";
	const where = Object.entries(keys)
		.map(([k, v]) => `${ident(k)} = ${literal(v)}`)
		.join(" AND ");
	const statements = [
		`UPDATE ${ident(table)} SET ${Object.entries(small)
			.map(([k, v]) => `${ident(k)} = ${literal(v)}`)
			.join(", ")} WHERE ${where};`,
	];
	for (const [column, value] of large) statements.push(...append(table, column, value, keys));
	return statements;
}

const files = new Map<string, string[]>();
function emit(file: string, statements: string[]) {
	const list = files.get(file) ?? [];
	list.push(...statements);
	files.set(file, list);
}

// ---------------------------------------------------------------- seeds

function articles() {
	const base = join(CONTENT, "articles");
	for (const path of walk(base)) {
		const { data, body } = readEntry(path);
		const id = entryId(base, path, data);
		if (!Array.isArray(data.technologies) || data.technologies.length === 0)
			throw new Error(`${rel(path)}: at least one technology is required`);
		emit("articles.sql", insert("articles", {
			id,
			title: data.title,
			subtitle: optional(data.subtitle),
			description: data.description,
			body: richTextDoc(body, path, `articles/${id}`, { normalize: true }),
			type: data.type ?? "tutorial",
			howto: data.howto ?? false,
			draft: data.draft ?? false,
			series: optional(data.series),
			categories: json(data.categories ?? []),
			tags: json(data.tags ?? []),
			...cover(data, path, `articles/${id}`),
			open_graph_title: optional(data.openGraph?.title),
			open_graph_subtitle: optional(data.openGraph?.subtitle),
			updates: json(
				(data.updates ?? []).map((u: Data) => ({ date: date(u.date, "updates.date", path).toISOString(), description: u.description })),
			),
			resources: json(resources(data.resources) ?? []),
			published_at: ms(date(data.publishedAt, "publishedAt", path)),
			revised_at: data.updatedAt === undefined ? null : ms(date(data.updatedAt, "updatedAt", path)),
			updated_at: updatedAt(path),
		}, { id }));
		for (const row of joinRows("", "article_id", "person_id", id, authorsOf(data)))
			emit("articles.sql", insert("article_authors", row, row));
		for (const row of joinRows("", "article_id", "technology_id", id, data.technologies))
			emit("articles.sql", insert("article_technologies", row, row));
	}
}

function news() {
	const base = join(CONTENT, "news");
	for (const path of walk(base)) {
		const { data, body } = readEntry(path);
		const id = entryId(base, path, data);
		emit("news.sql", insert("news_stories", {
			id,
			title: data.title,
			description: data.description,
			body: richTextDoc(body, path, `news/${id}`),
			published_at: ms(date(data.publishedAt, "publishedAt", path)),
			updated_at: updatedAt(path),
		}, { id }));
		for (const row of joinRows("", "story_id", "person_id", id, authorsOf(data))) emit("news.sql", insert("news_authors", row, row));
		for (const row of joinRows("", "story_id", "technology_id", id, data.technologies ?? []))
			emit("news.sql", insert("news_technologies", row, row));
	}
}

function changelog() {
	const base = join(CONTENT, "changelog");
	for (const path of walk(base)) {
		const { data, body } = readEntry(path);
		const id = entryId(base, path, data);
		emit("changelog.sql", insert("changelog_entries", {
			id,
			title: data.title,
			date: ms(date(data.date, "date", path)),
			type: data.type,
			description: richTextDoc(String(data.description), path, `changelog/${id}`, { mdx: false }),
			pull_request: optional(data.pullRequest),
			author_id: data.author,
			body: body.trim() ? richTextDoc(body, path, `changelog/${id}`) : null,
			updated_at: updatedAt(path),
		}, { id }));
	}
}

function adrs() {
	const base = join(CONTENT, "adrs");
	for (const path of walk(base, Number.POSITIVE_INFINITY, /\.md$/)) {
		const { data, body } = readEntry(path);
		const id = entryId(base, path, data);
		emit("adrs.sql", insert("adrs", {
			id,
			title: data.title,
			adopted_at: ms(date(data.adoptedAt, "adoptedAt", path)),
			body: richTextDoc(body, path, `adrs/${id}`),
			updated_at: updatedAt(path),
		}, { id }));
		for (const row of joinRows("", "adr_id", "person_id", id, authorsOf(data))) emit("adrs.sql", insert("adr_authors", row, row));
	}
}

function testimonials() {
	const base = join(CONTENT, "testimonials");
	for (const path of walk(base, Number.POSITIVE_INFINITY, /\.ya?ml$/)) {
		const data = load(readFileSync(path, "utf8")) as Data;
		const id = entryId(base, path, {});
		emit("testimonials.sql", insert("testimonials", {
			id,
			type: data.type,
			quote: data.quote,
			author_name: data.author.name,
			author_title: data.author.title,
			author_image: data.author.image,
			author_link: optional(data.author.link),
			updated_at: updatedAt(path),
		}, { id }));
	}
}

function courses() {
	const base = join(CONTENT, "courses");
	for (const path of walk(base, 1)) {
		const { data, body } = readEntry(path);
		const id = entryId(base, path, data);
		const signup = data.signupConfig
			? {
					audienceId: data.signupConfig.audienceId,
					...(data.signupConfig.sponsor !== undefined ? { sponsor: data.signupConfig.sponsor } : {}),
					...(data.signupConfig.sponsorAudienceId !== undefined
						? { sponsorAudienceId: data.signupConfig.sponsorAudienceId }
						: {}),
					allowSponsorContact: data.signupConfig.allowSponsorContact ?? false,
				}
			: null;
		const res = resources(data.resources, id);
		emit("courses.sql", insert("courses", {
			id,
			title: data.title,
			description: data.description,
			...cover(data, path, `courses/${id}`),
			published_at: seconds(date(data.publishedAt, "publishedAt", path)),
			difficulty: data.difficulty,
			learning_path: json(data.learningPath ?? []),
			authors: json(authorsOf(data)),
			technologies: json((data.technologies ?? []).map(stripIndex)),
			resources: res ? json(res) : null,
			signup_config: signup ? json(signup) : null,
			body: richTextDoc(body, path, `courses/${id}`),
			updated_at: updatedAt(path),
		}, { id }));
	}
	// courseModules: */*.md(x), id is the path without its extension.
	for (const path of walk(base, 2).filter((p) => relative(base, p).split("/").length === 2)) {
		const { data, body } = readEntry(path);
		const id = relative(base, path).replace(/\.mdx?$/, "");
		const video = data.video
			? Object.fromEntries(
					["id", "thumbnailUrl", "youtube", "rawkode", "poster"]
						.filter((k) => data.video[k] !== undefined)
						.map((k) => [k, data.video[k]]),
				)
			: null;
		const res = resources(data.resources, data.course);
		emit("courses.sql", insert("course_modules", {
			id,
			course_id: data.course,
			slug: basename(id),
			frontmatter_slug: optional(data.slug),
			title: data.title,
			description: data.description,
			...cover(data, path, `courses/${id}`),
			section: optional(data.section),
			sort_order: data.order,
			video: video ? json(video) : null,
			duration: optional(data.duration),
			difficulty: optional(data.difficulty),
			published_at: seconds(date(data.publishedAt, "publishedAt", path)),
			draft: data.draft ?? true,
			authors: json(authorsOf(data)),
			resources: res ? json(res) : null,
			body: richTextDoc(body, path, `courses/${id}`),
			updated_at: updatedAt(path),
		}, { id }));
	}
	const lpBase = join(CONTENT, "learning-paths");
	for (const path of walk(lpBase)) {
		const { data, body } = readEntry(path);
		const id = entryId(lpBase, path, data);
		emit("courses.sql", insert("learning_paths", {
			id,
			title: data.title,
			description: data.description,
			difficulty: data.difficulty,
			estimated_duration: data.estimatedDuration,
			prerequisites: json(data.prerequisites ?? []),
			technologies: json(data.technologies),
			published_at: seconds(date(data.publishedAt, "publishedAt", path)),
			authors: json(authorsOf(data)),
			body: richTextDoc(body, path, `learning-paths/${id}`),
			updated_at: updatedAt(path),
		}, { id }));
	}
}

// ---------------------------------------------------------------- backfills

function videos() {
	for (const path of walk(join(CONTENT, "videos"))) {
		const { data } = readEntry(path);
		if (typeof data.description !== "string") continue;
		emit("backfill-videos.sql", update("videos", {
			description_doc: richTextDoc(data.description, path, `videos/${data.id}`, { mdx: false, breaks: true }),
		}, { id: data.id }));
	}
}

function shows() {
	for (const path of walk(join(CONTENT, "shows"))) {
		const { data } = readEntry(path);
		const set: Row = {};
		if (typeof data.description === "string")
			set.description_doc = richTextDoc(data.description, path, `shows/${data.id}`, { mdx: false });
		const c = cover(data, path, `shows/${data.id}`);
		if (c.cover_url) {
			set.cover_url = c.cover_url;
			set.cover_width = c.cover_width;
			set.cover_height = c.cover_height;
		}
		if (Object.keys(set).length) emit("backfill-shows.sql", update("shows", set, { id: data.id }));
	}
}

function technologies() {
	const base = join(CONTENT, "technologies");
	for (const id of readdirSync(base).sort()) {
		const path = join(base, id, "index.mdx");
		try {
			statSync(path);
		} catch {
			continue;
		}
		// Logos are served from technologies/<id>/<file> (read-model logo URLs).
		for (const name of readdirSync(join(base, id)).sort()) {
			if (name === "index.mdx") continue;
			const key = `technologies/${id}/${name}`;
			assets.set(key, {
				key,
				content: key,
				contentType: CONTENT_TYPES[extname(name).toLowerCase()] ?? (name.endsWith(".ico") ? "image/x-icon" : "application/octet-stream"),
			});
		}
		const { body } = readEntry(path);
		if (!body.trim()) continue;
		emit("backfill-technologies.sql", update("technologies", { body: richTextDoc(body, path, `technologies/${id}`) }, { id }));
	}
}

function biographies() {
	const base = join(CONTENT, "people");
	for (const path of walk(base)) {
		const { data, body } = readEntry(path);
		if (!body.trim()) continue;
		emit("backfill-people-biographies.sql", update("people_biographies", {
			biography_doc: richTextDoc(body, path, `people/${data.id}`),
		}, { person_id: data.id }));
	}
}

// ---------------------------------------------------------------- main

articles();
news();
changelog();
adrs();
testimonials();
courses();
videos();
shows();
technologies();
biographies();

mkdirSync(OUT, { recursive: true });
const header = `-- Generated by tasks/content-cutover/scripts/build-seeds.ts from content/ at ${REV}.\n`;
for (const [file, statements] of files) {
	for (const s of statements)
		if (Buffer.byteLength(s) > 100_000) throw new Error(`${file}: statement over 100 KB`);
	writeFileSync(join(OUT, file), `${header}${statements.join("\n")}\n`);
	console.log(`${file}: ${statements.length} statements`);
}
writeFileSync(
	join(OUT, "assets.json"),
	`${JSON.stringify(
		[...assets.values()].sort((a, b) => a.key.localeCompare(b.key)),
		null,
		"\t",
	)}\n`,
);
console.log(`assets.json: ${assets.size} objects`);
