#!/usr/bin/env bun

/**
 * Reduce the kitchen-sink `description` field on each video down to a short
 * human summary by:
 *   - dropping lines that look like chapter timestamps (already templated
 *     into the player from `chapters[]`),
 *   - dropping conservative ad-copy patterns,
 *   - taking the first remaining content paragraph, trimmed to ~280 chars.
 *
 * Run without flags to write a dry-run report. Pass `--apply` to write
 * the new descriptions to the video markdown files. The report at
 * `content/scripts/output/description-cleanup.md` is regenerated on every
 * run.
 *
 * Usage:
 *   bun run scripts/clean-video-descriptions.ts          # dry-run
 *   bun run scripts/clean-video-descriptions.ts --apply  # write changes
 *   bun run scripts/clean-video-descriptions.ts --only <slug>
 */

import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const contentRoot = join(__dirname, "..");
const repoRoot = join(contentRoot, "..");

const VIDEOS_DIR = join(contentRoot, "videos");
const OUTPUT_DIR = join(contentRoot, "scripts", "output");
const REPORT_FILE = join(OUTPUT_DIR, "description-cleanup.md");

const MAX_DESCRIPTION_CHARS = 280;
const MIN_DESCRIPTION_CHARS = 60;
const SCHEMA_MIN_CHARS = 20;

// Conservative ad-copy patterns. Each must match an entire line (or trimmed paragraph).
// Adding patterns: keep them specific enough that a human reading them agrees they are
// always promotional, never genuine description.
const AD_COPY_PATTERNS: RegExp[] = [
	/^want to (try|sign up).+/i,
	/^sign up (here|today|now)\b.*$/i,
	/^try .+ for free.*$/i,
	/^get (a )?(free|free trial)\b.*$/i,
	/^use (code|coupon) .+ for\b.*$/i,
	/^check (it )?out\s+(at|here|on)\s+https?:\/\/\S+\.?$/i,
	/^https?:\/\/\S+\s*$/, // bare URL alone on a line
];

const CHAPTER_LINE_REGEX = /^\s*\d{1,2}:\d{2}(?::\d{2})?\s+\S.*$/;

interface CliOpts {
	apply: boolean;
	only: string | null;
}

function parseArgs(argv: string[]): CliOpts {
	const out: CliOpts = { apply: false, only: null };
	for (let i = 0; i < argv.length; i++) {
		if (argv[i] === "--apply") out.apply = true;
		else if (argv[i] === "--only") out.only = argv[++i] ?? null;
	}
	return out;
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

function isAdCopy(line: string): boolean {
	const trimmed = line.trim();
	if (!trimmed) return false;
	return AD_COPY_PATTERNS.some((p) => p.test(trimmed));
}

function looksLikeChapterLine(line: string): boolean {
	return CHAPTER_LINE_REGEX.test(line);
}

function paragraphIsChapters(paragraph: string): boolean {
	const lines = paragraph.split("\n").map((l) => l.trim()).filter(Boolean);
	if (lines.length === 0) return false;
	// A paragraph is "chapter material" if every non-empty line is a chapter line.
	return lines.every(looksLikeChapterLine);
}

function paragraphIsAdCopy(paragraph: string): boolean {
	const trimmed = paragraph.trim();
	if (!trimmed) return false;
	// Either the whole paragraph matches, or every line matches.
	if (isAdCopy(trimmed)) return true;
	const lines = trimmed.split("\n");
	return lines.every((l) => isAdCopy(l));
}

function paragraphLooksLikeHeading(paragraph: string): boolean {
	const trimmed = paragraph.trim();
	if (trimmed.length === 0 || trimmed.length > 120) return false;
	// No sentence punctuation, no commas, mostly title case → heading-ish.
	if (/[.!?]$/.test(trimmed)) return false;
	const wordCount = trimmed.split(/\s+/).length;
	return wordCount <= 16;
}

function splitSentences(text: string): string[] {
	// Cheap sentence split: split on sentence-ending punctuation followed by whitespace
	// and a capital letter or quote. Good enough for our prose.
	const out: string[] = [];
	let buffer = "";
	for (let i = 0; i < text.length; i++) {
		buffer += text[i];
		if (
			/[.!?]/.test(text[i]) &&
			/\s/.test(text[i + 1] ?? "") &&
			/["“(\[A-Z]/.test(text[i + 2] ?? "")
		) {
			out.push(buffer.trim());
			buffer = "";
			i += 1;
		}
	}
	if (buffer.trim()) out.push(buffer.trim());
	return out;
}

function trimToLength(text: string, maxChars: number): string {
	const collapsed = text.replace(/\s+/g, " ").trim();
	if (collapsed.length <= maxChars) return collapsed;
	const sentences = splitSentences(collapsed);
	const out: string[] = [];
	let total = 0;
	for (const s of sentences) {
		if (total + s.length + (out.length ? 1 : 0) > maxChars) break;
		out.push(s);
		total += s.length + (out.length ? 1 : 0);
	}
	if (out.length === 0) {
		// First sentence already too long; hard truncate at maxChars boundary.
		return `${collapsed.slice(0, maxChars - 1).trim()}…`;
	}
	return out.join(" ");
}

interface CleanResult {
	description: string;
	source: "shortened" | "kept" | "todo";
	droppedParagraphs: number;
	originalLength: number;
}

function cleanDescription(original: string): CleanResult {
	const normalized = original.replace(/\\n/g, "\n").trim();
	if (!normalized) {
		return { description: original, source: "todo", droppedParagraphs: 0, originalLength: 0 };
	}
	// YAML `>-` folded scalars collapse single line breaks to spaces and emit one `\n`
	// per blank line in source. So every `\n` in the parsed string IS a paragraph
	// boundary; split on `\n+` to also catch paragraphs separated by a single blank line.
	const paragraphs = normalized
		.split(/\n+/)
		.map((p) => p.replace(/\s+$/, ""));
	let dropped = 0;
	let lead: string | null = null;
	for (const p of paragraphs) {
		if (!p.trim()) continue;
		if (paragraphIsChapters(p) || paragraphIsAdCopy(p)) {
			dropped++;
			continue;
		}
		if (paragraphLooksLikeHeading(p)) {
			dropped++;
			continue;
		}
		lead = p;
		break;
	}
	if (!lead) {
		// Could not extract a clean lead. Leave the original description in place
		// so schema validation does not break, and mark for human rewrite.
		return {
			description: original,
			source: "todo",
			droppedParagraphs: dropped,
			originalLength: normalized.length,
		};
	}
	const candidate = trimToLength(lead, MAX_DESCRIPTION_CHARS);
	if (candidate.length < Math.max(SCHEMA_MIN_CHARS, MIN_DESCRIPTION_CHARS)) {
		return {
			description: original,
			source: "todo",
			droppedParagraphs: dropped,
			originalLength: normalized.length,
		};
	}
	if (candidate === normalized) {
		return {
			description: normalized,
			source: "kept",
			droppedParagraphs: dropped,
			originalLength: normalized.length,
		};
	}
	return {
		description: candidate,
		source: "shortened",
		droppedParagraphs: dropped,
		originalLength: normalized.length,
	};
}

interface VideoSummary {
	path: string;
	slug: string;
	id: string;
	source: CleanResult["source"];
	droppedParagraphs: number;
	originalLength: number;
	newLength: number;
	preview: string;
}

async function run(opts: CliOpts) {
	const files = await walkMarkdown(VIDEOS_DIR);
	let pool = files;
	if (opts.only) {
		pool = pool.filter((f) => f.includes(opts.only!));
	}

	const summaries: VideoSummary[] = [];
	let applied = 0;
	let todo = 0;
	let unchanged = 0;

	for (const file of pool) {
		const raw = await readFile(file, "utf8");
		const parsed = matter(raw);
		const data = parsed.data as Record<string, unknown>;
		const original = (data.description as string | undefined) ?? "";
		if (!original) continue;
		const result = cleanDescription(original);
		summaries.push({
			path: relative(repoRoot, file),
			slug: (data.slug as string | undefined) ?? "",
			id: (data.id as string | undefined) ?? "",
			source: result.source,
			droppedParagraphs: result.droppedParagraphs,
			originalLength: result.originalLength,
			newLength: result.description.length,
			preview: result.description.replace(/\s+/g, " ").slice(0, 160),
		});

		if (result.source === "shortened" && opts.apply) {
			const out = matter.stringify(parsed.content, {
				...data,
				description: result.description,
			});
			await writeFile(file, out, "utf8");
			applied++;
		} else if (result.source === "shortened") {
			applied++;
		} else if (result.source === "todo") {
			todo++;
		} else {
			unchanged++;
		}
	}

	await mkdir(OUTPUT_DIR, { recursive: true });
	const report = renderReport(summaries, opts.apply);
	await writeFile(REPORT_FILE, report, "utf8");

	console.log(
		`Videos: ${summaries.length}. shortened=${summaries.filter((s) => s.source === "shortened").length} kept=${unchanged} todo=${todo}`,
	);
	if (opts.apply) {
		console.log(`Applied ${applied} change(s) to video frontmatter.`);
	} else {
		console.log("Dry run only. Re-run with --apply to write changes.");
	}
	console.log(`Report: ${relative(repoRoot, REPORT_FILE)}`);
}

function renderReport(rows: VideoSummary[], applied: boolean): string {
	const shortened = rows.filter((r) => r.source === "shortened");
	const kept = rows.filter((r) => r.source === "kept");
	const todo = rows.filter((r) => r.source === "todo");

	const header = `# Video description cleanup

_Generated by \`content/scripts/clean-video-descriptions.ts\` on ${new Date().toISOString()}._

Mode: ${applied ? "**applied**" : "dry run"}.

- **${shortened.length}** description(s) shortened.
- **${kept.length}** description(s) already short enough; left as-is.
- **${todo.length}** description(s) could not be confidently shortened — flagged for human rewrite.
`;

	const escapeCell = (s: string): string =>
		s.replace(/\\/g, "\\\\").replace(/\|/g, "\\|");
	const renderTable = (entries: VideoSummary[]): string => {
		if (entries.length === 0) return "_None._\n";
		const lines = entries.map(
			(e) =>
				`| \`${e.slug || e.id}\` | ${e.originalLength} → ${e.newLength} | ${e.droppedParagraphs} | ${escapeCell(e.preview)} | \`${e.path}\` |`,
		);
		return [
			"| Video | Length | Dropped paragraphs | Preview | Path |",
			"| --- | --- | --- | --- | --- |",
			...lines,
			"",
		].join("\n");
	};

	return `${header}

## Shortened

${renderTable(shortened)}

## Already short

${renderTable(kept)}

## Needs human rewrite

These videos have descriptions where the heuristics could not confidently extract a short summary. Open each file and write a short description by hand.

${renderTable(todo)}
`;
}

const opts = parseArgs(process.argv.slice(2));
await run(opts);
