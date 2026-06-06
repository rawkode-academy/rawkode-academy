import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import {
	thumbnailKey,
	type ThumbnailTechnology,
	type ThumbnailWorkflowParams,
} from "../src/contracts";

export interface ParsedFrontmatter {
	[key: string]: string | string[] | undefined;
}

export interface DiscoverThumbnailJobsOptions {
	commitSha: string;
	force?: boolean;
}

export interface SkippedContentItem {
	path: string;
	reason: string;
}

export interface DiscoverThumbnailJobsResult {
	jobs: ThumbnailWorkflowParams[];
	skipped: SkippedContentItem[];
}

const VIDEO_EXTENSIONS = new Set([".md", ".mdx"]);

function stripQuotes(value: string): string {
	const trimmed = value.trim();
	if (
		(trimmed.startsWith('"') && trimmed.endsWith('"')) ||
		(trimmed.startsWith("'") && trimmed.endsWith("'"))
	) {
		return trimmed.slice(1, -1);
	}
	return trimmed;
}

function lineIndent(line: string): number {
	const match = line.match(/^ */);
	return match ? match[0].length : 0;
}

export function parseFrontmatter(source: string): ParsedFrontmatter {
	const normalized = source.replaceAll("\r\n", "\n");
	if (!normalized.startsWith("---\n")) {
		throw new Error("Content file does not start with frontmatter");
	}

	const end = normalized.indexOf("\n---", 4);
	if (end === -1) throw new Error("Content file frontmatter is not closed");

	const lines = normalized.slice(4, end).split("\n");
	const data: ParsedFrontmatter = {};

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (!line.trim()) continue;
		if (lineIndent(line) > 0) continue;

		const match = line.match(/^([A-Za-z0-9_-]+):(?:\s*(.*))?$/);
		if (!match) continue;

		const key = match[1];
		const rawValue = match[2] ?? "";

		if (rawValue === "" && lines[i + 1]?.match(/^\s+-\s+/)) {
			const values: string[] = [];
			while (lines[i + 1]?.match(/^\s+-\s+/)) {
				i++;
				values.push(stripQuotes(lines[i].replace(/^\s+-\s+/, "")));
			}
			data[key] = values;
			continue;
		}

		if (/^[>|][+-]?$/.test(rawValue)) {
			const blockLines: string[] = [];
			while (lines[i + 1] !== undefined && lineIndent(lines[i + 1]) > 0) {
				i++;
				blockLines.push(lines[i].replace(/^ {2}/, ""));
			}
			data[key] = rawValue.startsWith(">")
				? blockLines.map((blockLine) => blockLine.trim()).join(" ").trim()
				: blockLines.join("\n").trim();
			continue;
		}

		data[key] = stripQuotes(rawValue);
	}

	return data;
}

async function* walkFiles(root: string): AsyncGenerator<string> {
	for (const entry of await readdir(root, { withFileTypes: true })) {
		const fullPath = join(root, entry.name);
		if (entry.isDirectory()) {
			yield* walkFiles(fullPath);
			continue;
		}
		yield fullPath;
	}
}

function hasVideoExtension(path: string): boolean {
	const dot = path.lastIndexOf(".");
	return dot !== -1 && VIDEO_EXTENSIONS.has(path.slice(dot));
}

function readString(data: ParsedFrontmatter, key: string): string | null {
	const value = data[key];
	return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readStringArray(data: ParsedFrontmatter, key: string): string[] {
	const value = data[key];
	return Array.isArray(value)
		? value.map((item) => item.trim()).filter(Boolean)
		: [];
}

async function readFrontmatter(path: string): Promise<ParsedFrontmatter> {
	return parseFrontmatter(await readFile(path, "utf8"));
}

async function readTechnology(
	repoRoot: string,
	id: string,
): Promise<ThumbnailTechnology | null> {
	const technologyRoot = join(repoRoot, "content", "technologies", id);

	try {
		const [frontmatter, iconSvg] = await Promise.all([
			readFrontmatter(join(technologyRoot, "index.mdx")),
			readFile(join(technologyRoot, "icon.svg"), "utf8"),
		]);

		return {
			id,
			name: readString(frontmatter, "name") ?? id,
			iconSvg,
			terms: readStringArray(frontmatter, "terms"),
		};
	} catch {
		return null;
	}
}

export async function discoverThumbnailJobs(
	repoRoot: string,
	options: DiscoverThumbnailJobsOptions,
): Promise<DiscoverThumbnailJobsResult> {
	const videosRoot = join(repoRoot, "content", "videos");
	const jobs: ThumbnailWorkflowParams[] = [];
	const skipped: SkippedContentItem[] = [];

	for await (const path of walkFiles(videosRoot)) {
		if (!hasVideoExtension(path)) continue;

		let frontmatter: ParsedFrontmatter;
		try {
			frontmatter = await readFrontmatter(path);
		} catch (error) {
			skipped.push({
				path: relative(repoRoot, path),
				reason: error instanceof Error ? error.message : String(error),
			});
			continue;
		}

		const id = readString(frontmatter, "id");
		const contentPath = relative(repoRoot, path);
		if (!id) {
			skipped.push({
				path: contentPath,
				reason: "missing video id",
			});
			continue;
		}

		const primaryTechnologyId = readStringArray(frontmatter, "technologies")[0];
		if (!primaryTechnologyId) {
			skipped.push({
				path: contentPath,
				reason: "missing primary technology",
			});
			continue;
		}

		const technology = await readTechnology(repoRoot, primaryTechnologyId);
		if (!technology) {
			skipped.push({
				path: contentPath,
				reason: `missing technology icon for ${primaryTechnologyId}`,
			});
			continue;
		}

		jobs.push({
			videoId: id,
			technology,
			source: {
				commitSha: options.commitSha,
				trigger: "github-actions",
				contentPath,
			},
			force: options.force || undefined,
		});
	}

	return { jobs, skipped };
}

export function thumbnailUrl(videoId: string): string {
	return `https://content.rawkode.academy/${thumbnailKey(videoId)}`;
}
