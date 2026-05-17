#!/usr/bin/env bun

/**
 * Transcript-driven resource extraction for videos.
 *
 * For each video, fetch the public VTT, ask Gemini to extract concrete
 * linkable resources (docs, code, slides, demos, papers/books/posts), dedupe
 * against the URLs already attached to the video's technologies and guests,
 * and emit a JSON file per video for human review.
 *
 * Apply mode merges accepted JSON files into each video's frontmatter
 * `resources:` array, additive and idempotent.
 *
 * Usage:
 *   bun run scripts/extract-video-resources.ts [options]
 *
 * Options:
 *   --apply            Merge per-video JSON into the video markdown frontmatter.
 *   --force            Re-extract even if a JSON file already exists.
 *   --max-parallel <n> Parallelism for extraction (default 5).
 *   --limit <n>        Only process the first N videos (debug).
 *   --only <slug>      Only process the video with this slug.
 *   --model <name>     Gemini model to pass to `gemini -m <name>`. Optional.
 */

import { readdir, readFile, writeFile, mkdir, access } from "node:fs/promises";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import matter from "gray-matter";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const contentRoot = join(__dirname, "..");
const repoRoot = join(contentRoot, "..");

const VIDEOS_DIR = join(contentRoot, "videos");
const PEOPLE_DIR = join(contentRoot, "people");
const TECHNOLOGIES_DIR = join(contentRoot, "technologies");
const OUTPUT_DIR = join(contentRoot, "scripts", "output", "resources");
const VTT_BASE = "https://content.rawkode.academy/videos";

const CATEGORIES = ["documentation", "code", "slides", "demos", "other"] as const;
type Category = (typeof CATEGORIES)[number];
type Confidence = "high" | "medium" | "low";

interface Resource {
	title: string;
	url?: string;
	category: Category;
	evidence_quote: string;
	confidence: Confidence;
}

interface VideoFrontmatter {
	id: string;
	slug: string;
	title: string;
	technologies?: unknown[];
	guests?: unknown[];
	resources?: Resource[];
	[key: string]: unknown;
}

interface CliOpts {
	apply: boolean;
	force: boolean;
	maxParallel: number;
	limit: number | null;
	only: string | null;
	model: string | null;
}

function parseArgs(argv: string[]): CliOpts {
	const out: CliOpts = {
		apply: false,
		force: false,
		maxParallel: 5,
		limit: null,
		only: null,
		model: null,
	};
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (a === "--apply") out.apply = true;
		else if (a === "--force") out.force = true;
		else if (a === "--max-parallel") out.maxParallel = Number(argv[++i]);
		else if (a === "--limit") out.limit = Number(argv[++i]);
		else if (a === "--only") out.only = argv[++i] ?? null;
		else if (a === "--model") out.model = argv[++i] ?? null;
	}
	if (!Number.isFinite(out.maxParallel) || out.maxParallel < 1) out.maxParallel = 1;
	return out;
}

async function exists(path: string): Promise<boolean> {
	try {
		await access(path);
		return true;
	} catch {
		return false;
	}
}

async function walkMarkdown(dir: string): Promise<string[]> {
	const out: string[] = [];
	const entries = await readdir(dir, { withFileTypes: true });
	for (const entry of entries) {
		const full = join(dir, entry.name);
		if (entry.isDirectory()) {
			out.push(...(await walkMarkdown(full)));
		} else if (entry.isFile() && /\.(md|mdx)$/.test(entry.name)) {
			out.push(full);
		}
	}
	return out;
}

function normalizeReference(ref: unknown): string | null {
	if (typeof ref === "string") return ref.trim() || null;
	if (ref && typeof ref === "object") {
		const id = (ref as { id?: unknown }).id;
		if (typeof id === "string") return id.trim() || null;
	}
	return null;
}

function stripIndexSuffix(id: string): string {
	return id.replace(/\/index$/, "");
}

async function readPersonLinks(id: string): Promise<{
	name?: string;
	urls: string[];
}> {
	const candidates = [join(PEOPLE_DIR, `${id}.mdx`), join(PEOPLE_DIR, `${id}.md`)];
	for (const path of candidates) {
		if (!(await exists(path))) continue;
		const data = matter(await readFile(path, "utf8")).data as Record<
			string,
			unknown
		>;
		const urls: string[] = [];
		const fields = [
			"website",
			"youtube",
			"mastodon",
		];
		for (const f of fields) {
			const v = data[f];
			if (typeof v === "string" && v.trim()) urls.push(v.trim());
		}
		if (typeof data.github === "string" && data.github)
			urls.push(`https://github.com/${data.github}`);
		if (typeof data.twitter === "string" && data.twitter)
			urls.push(`https://x.com/${data.twitter}`);
		if (typeof data.bluesky === "string" && data.bluesky)
			urls.push(`https://bsky.app/profile/${data.bluesky}`);
		if (typeof data.linkedin === "string" && data.linkedin)
			urls.push(`https://www.linkedin.com/in/${data.linkedin}`);
		return { name: data.name as string | undefined, urls };
	}
	return { urls: [] };
}

async function readTechnologyLinks(id: string): Promise<{
	name?: string;
	urls: string[];
}> {
	const path = join(TECHNOLOGIES_DIR, stripIndexSuffix(id), "index.mdx");
	if (!(await exists(path))) return { urls: [] };
	const data = matter(await readFile(path, "utf8")).data as Record<
		string,
		unknown
	>;
	const urls: string[] = [];
	for (const f of ["website", "documentation"] as const) {
		const v = data[f];
		if (typeof v === "string" && v.trim()) urls.push(v.trim());
	}
	return { name: data.name as string | undefined, urls };
}

function urlHost(u: string): string | null {
	try {
		return new URL(u).host.replace(/^www\./, "").toLowerCase();
	} catch {
		return null;
	}
}

function stripVttToText(vtt: string): string {
	const lines = vtt.split(/\r?\n/);
	const out: string[] = [];
	for (const line of lines) {
		if (!line.trim()) continue;
		if (line.startsWith("WEBVTT")) continue;
		if (/^\d{2}:\d{2}:\d{2}\.\d{3}\s+-->/.test(line)) continue;
		if (/^\d+$/.test(line.trim())) continue;
		if (line.startsWith("NOTE")) continue;
		out.push(line);
	}
	return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

async function fetchTranscript(videoId: string): Promise<string | null> {
	const url = `${VTT_BASE}/${videoId}/captions/en.vtt`;
	try {
		const res = await fetch(url);
		if (!res.ok) return null;
		const vtt = await res.text();
		return stripVttToText(vtt);
	} catch {
		return null;
	}
}

function buildPrompt(params: {
	title: string;
	knownTechnologyNames: string[];
	knownGuestNames: string[];
	knownHosts: string[];
	transcript: string;
}): string {
	const {
		title,
		knownTechnologyNames,
		knownGuestNames,
		knownHosts,
		transcript,
	} = params;
	return [
		"You extract concrete linkable resources from a video transcript. Be strict.",
		"",
		"OUTPUT: a single JSON object, no prose before or after.",
		"SHAPE: {\"resources\": [{\"title\": string, \"url\": string|null, \"category\": \"documentation\"|\"code\"|\"slides\"|\"demos\"|\"other\", \"evidence_quote\": string, \"confidence\": \"high\"|\"medium\"|\"low\"}]}",
		"",
		"WHAT COUNTS AS A RESOURCE",
		"A resource is one of:",
		"- A specific repository or project the speaker names (e.g. 'kubernetes/kubernetes', 'rawkode-academy/courses').",
		"- A specific documentation page, guide, or API reference (e.g. 'the Kubernetes Pod Security Standards docs page').",
		"- A specific paper, RFC, book, blog post, talk, or video.",
		"- A specific demo or example artifact (e.g. 'the OpenTelemetry demo application').",
		"- A specific tool or product that is itself the LINK TARGET of the discussion — i.e. the speaker explicitly recommends going to look at it.",
		"",
		"WHAT DOES NOT COUNT (DROP THESE)",
		"- Passing technology mentions. 'I'm using Postgres' / 'we run on AWS Lambda' / 'we deploy with Helm' — these are not resources, they are context. Drop them.",
		"- The headlining technology of the video (already in KNOWN_TECHNOLOGIES).",
		"- People mentioned only by name without a specific artifact (talk, post, repo) attached.",
		"- Anything whose evidence quote is just 'we are using X' or 'X supports Y' — that is a mention, not a resource.",
		"- Anything you cannot confidently name with a specific artifact identifier (a repo path, doc page title, post title, paper title).",
		"",
		"GUARDRAILS",
		"- Each entry MUST include an evidence_quote taken verbatim from the transcript.",
		"- Skip anything covered by KNOWN_TECHNOLOGIES or KNOWN_GUESTS (already linked elsewhere). A specific deep page inside a known technology IS still a resource (e.g. a particular API reference page).",
		"- Only emit `url` when the host AND path are named with enough specificity to identify exactly (e.g. https://github.com/foo/bar, https://kubernetes.io/docs/concepts/...). If you would have to guess, return url=null.",
		"- Every emitted url MUST start with `https://`. No bare hosts, no `http://`.",
		"- Single-word generic titles ('Postgres', 'Helm', 'Jira') with url=null are forbidden — these are mentions, not resources. DROP them.",
		"- Use confidence=low when in doubt; low entries are dropped automatically. Prefer omitting an entry over including a weak one.",
		"- Hard cap: 5 resources per video. Quality over quantity. If only 0–2 real resources exist, return only those (or an empty array).",
		"",
		`TITLE: ${title}`,
		`KNOWN_TECHNOLOGIES: ${knownTechnologyNames.join(", ") || "(none)"}`,
		`KNOWN_GUESTS: ${knownGuestNames.join(", ") || "(none)"}`,
		`KNOWN_HOSTS: ${knownHosts.join(", ") || "(none)"}`,
		"",
		"TRANSCRIPT:",
		transcript,
	].join("\n");
}

function extractJson(text: string): unknown | null {
	const trimmed = text.trim();
	const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
	const candidate = fenceMatch ? fenceMatch[1] : trimmed;
	try {
		return JSON.parse(candidate);
	} catch {
		const firstBrace = candidate.indexOf("{");
		const lastBrace = candidate.lastIndexOf("}");
		if (firstBrace >= 0 && lastBrace > firstBrace) {
			try {
				return JSON.parse(candidate.slice(firstBrace, lastBrace + 1));
			} catch {
				return null;
			}
		}
		return null;
	}
}

function callGemini(prompt: string, model: string | null): Promise<string> {
	return new Promise((resolve, reject) => {
		const args: string[] = [];
		if (model) {
			args.push("-m", model);
		}
		args.push("-p", prompt);
		const proc = spawn("gemini", args, { stdio: ["ignore", "pipe", "pipe"] });
		let stdout = "";
		let stderr = "";
		proc.stdout.on("data", (chunk) => {
			stdout += chunk.toString();
		});
		proc.stderr.on("data", (chunk) => {
			stderr += chunk.toString();
		});
		proc.on("error", reject);
		proc.on("close", (code) => {
			if (code === 0) resolve(stdout);
			else reject(new Error(`gemini exited ${code}: ${stderr.trim()}`));
		});
	});
}

function isValidResource(value: unknown): value is Resource {
	if (!value || typeof value !== "object") return false;
	const v = value as Record<string, unknown>;
	if (typeof v.title !== "string" || !v.title.trim()) return false;
	if (typeof v.evidence_quote !== "string" || !v.evidence_quote.trim())
		return false;
	if (!CATEGORIES.includes(v.category as Category)) return false;
	if (v.confidence !== "high" && v.confidence !== "medium" && v.confidence !== "low")
		return false;
	if (v.url != null && typeof v.url !== "string") return false;
	return true;
}

function normalizeUrl(url: string | undefined | null): string | null {
	if (!url) return null;
	const trimmed = url.trim();
	if (!trimmed) return null;
	if (/^https:\/\//i.test(trimmed)) return trimmed;
	if (/^http:\/\//i.test(trimmed)) return `https://${trimmed.slice(7)}`;
	if (trimmed.startsWith("/")) return trimmed;
	// Bare host or host+path: prepend https://. Skip if it doesn't look like a host.
	if (/^[a-z0-9.-]+\.[a-z]{2,}/i.test(trimmed)) return `https://${trimmed}`;
	return null;
}

function filterAndDedupe(
	candidates: Resource[],
	knownHosts: Set<string>,
): Resource[] {
	const out: Resource[] = [];
	const seenTitles = new Set<string>();
	const seenUrls = new Set<string>();
	for (const raw of candidates) {
		if (raw.confidence === "low") continue;
		const url = normalizeUrl(raw.url ?? null);
		const c: Resource = { ...raw, url: url ?? undefined };
		// Safety net: a single-word title with no URL is almost always a passing
		// technology mention ("Postgres", "Helm"), not a real resource. Drop these.
		const wordCount = c.title.trim().split(/\s+/).length;
		if (wordCount <= 1 && !c.url) continue;
		if (c.url) {
			const host = urlHost(c.url);
			if (host && knownHosts.has(host)) continue;
			const key = c.url.toLowerCase();
			if (seenUrls.has(key)) continue;
			seenUrls.add(key);
		}
		const titleKey = c.title.trim().toLowerCase();
		if (seenTitles.has(titleKey)) continue;
		seenTitles.add(titleKey);
		out.push(c);
	}
	return out;
}

async function loadVideos(): Promise<{ path: string; data: VideoFrontmatter }[]> {
	const files = await walkMarkdown(VIDEOS_DIR);
	const out: { path: string; data: VideoFrontmatter }[] = [];
	for (const file of files) {
		const raw = await readFile(file, "utf8");
		const parsed = matter(raw);
		out.push({ path: file, data: parsed.data as VideoFrontmatter });
	}
	return out;
}

async function processVideo(
	video: { path: string; data: VideoFrontmatter },
	opts: CliOpts,
): Promise<{ status: "ok" | "skipped" | "no-transcript" | "error"; message?: string }> {
	const { id, slug, title } = video.data;
	if (!id || !slug || !title) {
		return { status: "error", message: `missing required frontmatter in ${video.path}` };
	}

	const outFile = join(OUTPUT_DIR, `${id}.json`);
	if (!opts.force && (await exists(outFile))) {
		return { status: "skipped", message: "JSON already exists" };
	}

	// Collect known URLs from technologies and guests.
	const knownUrls: string[] = [];
	const knownTechNames: string[] = [];
	const knownGuestNames: string[] = [];
	for (const ref of video.data.technologies ?? []) {
		const id = normalizeReference(ref);
		if (!id) continue;
		const { name, urls } = await readTechnologyLinks(id);
		if (name) knownTechNames.push(name);
		knownUrls.push(...urls);
	}
	for (const ref of video.data.guests ?? []) {
		const id = normalizeReference(ref);
		if (!id) continue;
		const { name, urls } = await readPersonLinks(id);
		if (name) knownGuestNames.push(name);
		knownUrls.push(...urls);
	}
	// Host names: derive from show, if any. (Hosts aren't in video frontmatter.)
	const knownHostNames: string[] = [];
	// Note: we could read the show file to get host names. Skipped for now;
	// hosts are typically named in transcripts but their profiles are linked
	// from the show page, not from the video's resources.

	const knownHosts = new Set<string>();
	for (const u of knownUrls) {
		const h = urlHost(u);
		if (h) knownHosts.add(h);
	}

	const transcript = await fetchTranscript(id);
	if (!transcript || transcript.length < 200) {
		return { status: "no-transcript", message: `no transcript for ${id}` };
	}

	const prompt = buildPrompt({
		title,
		knownTechnologyNames: knownTechNames,
		knownGuestNames,
		knownHosts: knownHostNames,
		transcript,
	});

	let raw: string;
	try {
		raw = await callGemini(prompt, opts.model);
	} catch (error) {
		return {
			status: "error",
			message: `gemini failed for ${id}: ${(error as Error).message}`,
		};
	}

	const parsed = extractJson(raw);
	if (!parsed || typeof parsed !== "object") {
		return { status: "error", message: `could not parse JSON from gemini for ${id}` };
	}
	const arr = (parsed as { resources?: unknown }).resources;
	if (!Array.isArray(arr)) {
		return { status: "error", message: `gemini output missing resources[] for ${id}` };
	}
	const candidates = arr.filter(isValidResource);
	const accepted = filterAndDedupe(candidates, knownHosts);

	await mkdir(OUTPUT_DIR, { recursive: true });
	await writeFile(
		outFile,
		`${JSON.stringify(
			{
				video_id: id,
				slug,
				title,
				generated_at: new Date().toISOString(),
				known_technology_names: knownTechNames,
				known_guest_names: knownGuestNames,
				resources: accepted,
			},
			null,
			"\t",
		)}\n`,
		"utf8",
	);

	return { status: "ok", message: `${accepted.length} resources → ${relative(repoRoot, outFile)}` };
}

async function applyCandidate(candidatePath: string): Promise<string> {
	const candidate = JSON.parse(await readFile(candidatePath, "utf8")) as {
		video_id: string;
		resources: Resource[];
	};
	// Find the video markdown file by id.
	const files = await walkMarkdown(VIDEOS_DIR);
	let target: string | null = null;
	for (const file of files) {
		const fm = matter(await readFile(file, "utf8")).data as VideoFrontmatter;
		if (fm.id === candidate.video_id) {
			target = file;
			break;
		}
	}
	if (!target) throw new Error(`no video file with id ${candidate.video_id}`);

	const raw = await readFile(target, "utf8");
	const parsed = matter(raw);
	const data = { ...(parsed.data as VideoFrontmatter) };
	const existing = Array.isArray(data.resources) ? data.resources : [];
	const merged = mergeResources(existing, candidate.resources);
	data.resources = merged;
	const out = matter.stringify(parsed.content, data);
	await writeFile(target, out, "utf8");
	return `${candidate.video_id} → ${relative(repoRoot, target)} (${merged.length} total)`;
}

function mergeResources(
	existing: Resource[],
	additions: Resource[],
): Resource[] {
	const keys = new Set<string>();
	const out: Resource[] = [];
	const key = (r: Resource): string =>
		(r.url ?? "").toLowerCase().trim() || `title:${r.title.toLowerCase().trim()}`;
	for (const r of existing) {
		keys.add(key(r));
		out.push(r);
	}
	for (const r of additions) {
		const k = key(r);
		if (keys.has(k)) continue;
		keys.add(k);
		out.push(r);
	}
	return out;
}

async function runExtract(opts: CliOpts) {
	const videos = await loadVideos();
	let pool = videos;
	if (opts.only) pool = pool.filter((v) => v.data.slug === opts.only);
	if (opts.limit != null) pool = pool.slice(0, opts.limit);

	console.log(`Processing ${pool.length} video(s) with parallelism ${opts.maxParallel}…`);
	let idx = 0;
	const summary = { ok: 0, skipped: 0, noTranscript: 0, errors: 0 };

	async function worker(): Promise<void> {
		while (true) {
			const i = idx++;
			if (i >= pool.length) return;
			const video = pool[i];
			const id = video.data.id ?? video.path;
			try {
				const res = await processVideo(video, opts);
				if (res.status === "ok") summary.ok++;
				else if (res.status === "skipped") summary.skipped++;
				else if (res.status === "no-transcript") summary.noTranscript++;
				else summary.errors++;
				console.log(`[${i + 1}/${pool.length}] ${id}: ${res.status}${res.message ? ` — ${res.message}` : ""}`);
			} catch (error) {
				summary.errors++;
				console.error(`[${i + 1}/${pool.length}] ${id}: error — ${(error as Error).message}`);
			}
		}
	}

	const workers = Array.from({ length: Math.min(opts.maxParallel, pool.length) }, () => worker());
	await Promise.all(workers);

	console.log("");
	console.log(`Done. ok=${summary.ok} skipped=${summary.skipped} no-transcript=${summary.noTranscript} errors=${summary.errors}`);
}

async function runApply() {
	if (!(await exists(OUTPUT_DIR))) {
		console.log(`No candidate directory at ${relative(repoRoot, OUTPUT_DIR)}; nothing to apply.`);
		return;
	}
	const entries = (await readdir(OUTPUT_DIR)).filter((f) => f.endsWith(".json"));
	if (entries.length === 0) {
		console.log("No candidate JSON files; nothing to apply.");
		return;
	}
	let ok = 0;
	let errors = 0;
	for (const entry of entries) {
		try {
			const msg = await applyCandidate(join(OUTPUT_DIR, entry));
			ok++;
			console.log(`applied: ${msg}`);
		} catch (error) {
			errors++;
			console.error(`error: ${entry} — ${(error as Error).message}`);
		}
	}
	console.log(`\nDone. applied=${ok} errors=${errors}`);
}

async function main() {
	const opts = parseArgs(process.argv.slice(2));
	if (opts.apply) {
		await runApply();
	} else {
		await runExtract(opts);
	}
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
