#!/usr/bin/env bun

/**
 * Build a YouTube description from a video's markdown frontmatter +
 * body. The output is a single plain-text block ready to paste into
 * the YouTube studio "Description" field.
 *
 * Anatomy (top to bottom, deliberately):
 *   1. First paragraph of the body description (kept short — YouTube
 *      truncates above the "Show more" fold around ~150 chars).
 *   2. A "Watch on Rawkode Academy" link with UTM tags so we can
 *      attribute the traffic in PostHog.
 *   3. Chapters in YouTube's `00:00 Title` format (auto-converted
 *      from the seconds-based `chapters[]` frontmatter).
 *   4. Resources, ordered by category.
 *   5. Topics (technologies covered).
 *   6. A small "About Rawkode Academy" footer with the newsletter +
 *      Technology Matrix links, also UTM-tagged.
 *
 * The script does not publish anything. It writes the resulting
 * description to `content/scripts/output/youtube-descriptions/<slug>.txt`
 * for the human to paste into YouTube.
 *
 * Usage:
 *   bun run scripts/build-youtube-description.ts                  # build all
 *   bun run scripts/build-youtube-description.ts --only <slug>    # one video
 *   bun run scripts/build-youtube-description.ts --stdout --only <slug>
 *     # print to stdout instead of writing a file (handy for copy-paste)
 */

import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const contentRoot = join(__dirname, "..");

const VIDEOS_DIR = join(contentRoot, "videos");
const TECHNOLOGIES_DIR = join(contentRoot, "technologies");
const OUTPUT_DIR = join(contentRoot, "scripts", "output", "youtube-descriptions");

const SITE = "https://rawkode.academy";
const UTM_MEDIUM = "video-description";
const UTM_SOURCE = "youtube";

interface Chapter {
	startTime: number;
	title: string;
}

interface Resource {
	title?: string;
	name?: string;
	url?: string;
	category?: string;
	type?: string;
}

type ResourceRef =
	| string
	| { id: string }
	| { collection: string; id: string };

interface VideoFrontmatter {
	id?: string;
	slug?: string;
	title?: string;
	description?: string;
	publishedAt?: string;
	chapters?: Chapter[];
	resources?: Resource[];
	technologies?: ResourceRef[];
	show?: ResourceRef;
	guests?: ResourceRef[];
}

interface CliOpts {
	only: string | null;
	stdout: boolean;
}

function parseArgs(argv: string[]): CliOpts {
	const opts: CliOpts = { only: null, stdout: false };
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (arg === "--only" && argv[i + 1]) {
			opts.only = argv[i + 1] ?? null;
			i += 1;
		} else if (arg === "--stdout") {
			opts.stdout = true;
		}
	}
	return opts;
}

function refId(ref: ResourceRef): string | null {
	if (!ref) return null;
	if (typeof ref === "string") return ref;
	if (typeof ref === "object" && "id" in ref) return String(ref.id);
	return null;
}

async function walkMarkdown(dir: string, rel = ""): Promise<string[]> {
	const out: string[] = [];
	let entries: { name: string; isDirectory: () => boolean; isFile: () => boolean }[];
	try {
		entries = (await readdir(dir, { withFileTypes: true })) as unknown as typeof entries;
	} catch {
		return out;
	}
	for (const entry of entries) {
		const path = join(dir, entry.name);
		const next = rel ? join(rel, entry.name) : entry.name;
		if (entry.isDirectory()) {
			out.push(...(await walkMarkdown(path, next)));
		} else if (entry.isFile() && /\.md$/i.test(entry.name)) {
			out.push(path);
		}
	}
	return out;
}

function pickFirstParagraph(description: string): string {
	const normalized = description.replace(/\\n/g, "\n").replace(/\r\n/g, "\n").trim();
	const blocks = normalized.split(/\n{2,}/);
	for (const block of blocks) {
		const trimmed = block.trim();
		if (trimmed.length > 0) {
			return trimmed.replace(/[*_`]+/g, "").replace(/\s+/g, " ").trim();
		}
	}
	return "";
}

function formatChapterTime(seconds: number): string {
	const safe = Math.max(0, Math.floor(seconds));
	const hours = Math.floor(safe / 3600);
	const minutes = Math.floor((safe % 3600) / 60);
	const secs = safe % 60;
	const mm = String(minutes).padStart(2, "0");
	const ss = String(secs).padStart(2, "0");
	if (hours > 0) {
		const hh = String(hours).padStart(2, "0");
		return `${hh}:${mm}:${ss}`;
	}
	return `${mm}:${ss}`;
}

async function loadTechnologyNames(ids: string[]): Promise<string[]> {
	const names: string[] = [];
	for (const rawId of ids) {
		const id = rawId.replace(/\/index$/, "");
		const candidates = [
			join(TECHNOLOGIES_DIR, `${id}.mdx`),
			join(TECHNOLOGIES_DIR, id, "index.mdx"),
		];
		let name = id;
		for (const candidate of candidates) {
			try {
				const raw = await readFile(candidate, "utf8");
				const fm = matter(raw).data as { name?: string };
				if (fm.name && typeof fm.name === "string") {
					name = fm.name;
					break;
				}
			} catch {
				// try the next candidate
			}
		}
		names.push(name);
	}
	return names;
}

function withUtm(path: string, campaign: string): string {
	const url = new URL(path, SITE);
	url.searchParams.set("utm_source", UTM_SOURCE);
	url.searchParams.set("utm_medium", UTM_MEDIUM);
	url.searchParams.set("utm_campaign", campaign);
	return url.toString();
}

function buildResourcesSection(resources: Resource[] | undefined): string {
	if (!resources || resources.length === 0) return "";
	const labelFor = (category?: string): string => {
		switch (category) {
			case "documentation":
				return "Documentation";
			case "code":
				return "Code";
			case "slides":
				return "Slides";
			case "demos":
				return "Demos";
			default:
				return "Resources";
		}
	};
	const order = ["documentation", "code", "slides", "demos", "other"];
	const groups = new Map<string, Resource[]>();
	for (const r of resources) {
		const key = r.category && order.includes(r.category) ? r.category : "other";
		const list = groups.get(key) ?? [];
		list.push(r);
		groups.set(key, list);
	}
	const body: string[] = [];
	for (const category of order) {
		const items = groups.get(category);
		if (!items || items.length === 0) continue;
		const entries: string[] = [];
		for (const item of items) {
			const title = item.title ?? item.name ?? "";
			const url = item.url ?? "";
			if (!title || !url) continue;
			entries.push(`  • ${title}: ${url}`);
		}
		if (entries.length === 0) continue;
		if (category !== "other" || groups.size > 1) {
			body.push(`  ${labelFor(category)}:`);
		}
		body.push(...entries);
	}
	if (body.length === 0) return "";
	return ["Resources", ...body].join("\n");
}

function buildDescription(args: {
	slug: string;
	title: string;
	bodyFirstParagraph: string;
	chapters: Chapter[];
	resources: Resource[] | undefined;
	technologyNames: string[];
}): string {
	const {
		slug,
		title,
		bodyFirstParagraph,
		chapters,
		resources,
		technologyNames,
	} = args;

	const watchUrl = withUtm(`/watch/${slug}`, "watch-on-website");
	const newsletterUrl = withUtm("/", "newsletter");
	const matrixUrl = withUtm("/technology/matrix", "technology-matrix");

	const sections: string[] = [];

	const lead = bodyFirstParagraph || title;
	sections.push(lead);

	sections.push(
		[
			"▸ Watch on Rawkode Academy with full transcript, chapters, and resources:",
			`  ${watchUrl}`,
		].join("\n"),
	);

	if (chapters.length > 0) {
		const sorted = [...chapters].sort((a, b) => a.startTime - b.startTime);
		const lines = ["Chapters"];
		for (const chapter of sorted) {
			lines.push(`${formatChapterTime(chapter.startTime)} ${chapter.title}`);
		}
		sections.push(lines.join("\n"));
	}

	const resourcesBlock = buildResourcesSection(resources);
	if (resourcesBlock) sections.push(resourcesBlock);

	if (technologyNames.length > 0) {
		sections.push(`Topics: ${technologyNames.join(", ")}`);
	}

	sections.push(
		[
			"About Rawkode Academy",
			"Long-form, hands-on coverage of Cloud Native, Kubernetes, and platform engineering. Ad-free, no algorithm.",
			`Newsletter: ${newsletterUrl}`,
			`Technology Matrix: ${matrixUrl}`,
		].join("\n"),
	);

	return sections.join("\n\n").replace(/[ \t]+$/gm, "");
}

async function processFile(
	filePath: string,
	stdout: boolean,
): Promise<{ slug: string; written: string | null; description: string }> {
	const raw = await readFile(filePath, "utf8");
	const parsed = matter(raw);
	const data = parsed.data as VideoFrontmatter;
	const slug = (data.slug ?? "").trim();
	if (!slug) {
		return { slug: "(no slug)", written: null, description: "" };
	}
	const title = data.title ?? slug;
	const bodyFirstParagraph = pickFirstParagraph(data.description ?? "");
	const chapters = Array.isArray(data.chapters) ? data.chapters : [];
	const resources = Array.isArray(data.resources) ? data.resources : undefined;
	const technologyIds = Array.isArray(data.technologies)
		? data.technologies
				.map(refId)
				.filter((id): id is string => Boolean(id))
		: [];
	const technologyNames = await loadTechnologyNames(technologyIds);
	const description = buildDescription({
		slug,
		title,
		bodyFirstParagraph,
		chapters,
		resources,
		technologyNames,
	});
	if (stdout) {
		console.log(description);
		return { slug, written: null, description };
	}
	await mkdir(OUTPUT_DIR, { recursive: true });
	const outPath = join(OUTPUT_DIR, `${slug}.txt`);
	await writeFile(outPath, `${description}\n`, "utf8");
	return { slug, written: outPath, description };
}

async function main() {
	const opts = parseArgs(process.argv.slice(2));
	const files = await walkMarkdown(VIDEOS_DIR);
	const targets = opts.only
		? files.filter((path) => path.endsWith(`/${opts.only}.md`))
		: files;
	if (targets.length === 0) {
		console.error(
			opts.only
				? `No video found with slug "${opts.only}".`
				: "No video markdown files found.",
		);
		process.exit(1);
	}
	if (opts.stdout && targets.length > 1) {
		console.error(
			"--stdout only works with a single video. Pass --only <slug>.",
		);
		process.exit(1);
	}
	let written = 0;
	for (const file of targets) {
		const result = await processFile(file, opts.stdout);
		if (result.written) {
			written += 1;
		}
	}
	if (!opts.stdout) {
		console.error(
			`Built ${written} description${written === 1 ? "" : "s"} → ${OUTPUT_DIR}`,
		);
	}
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
