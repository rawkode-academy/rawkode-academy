#!/usr/bin/env bun
/**
 * Bulk categorize videos as live/tutorial, then output candidates for review.
 * Run with: bun run scripts/bulk-categorize-videos.ts
 */

import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const VIDEOS_DIR = "../../../../content/videos";

// Keywords that suggest different categories
const EDITORIAL_KEYWORDS = [
	"fuck", "rant", "opinion", "thoughts on", "why i", "hot take", "unpopular",
	"we won't miss", "good riddance", "problem with", "what's wrong",
];
const INTERVIEW_KEYWORDS = [
	"interview", "chat with", "conversation with", "talking to", "guest:",
	"with guest", "fireside", "q&a with",
];
const REVIEW_KEYWORDS = [
	"review", "first look", "hands on", "vs", "versus", "compared",
	"comparison", "benchmark",
];
const ANNOUNCEMENT_KEYWORDS = [
	"announcement", "announcing", "introducing", "new release", "launch",
	"breaking:", "news:",
];

// Keywords suggesting recorded (not live)
const RECORDED_KEYWORDS = [
	"tutorial:", "how to", "guide:", "walkthrough", "explainer",
	"in 5 minutes", "in 10 minutes", "quick", "short",
];

interface VideoCandidate {
	file: string;
	title: string;
	suggestedCategory: string;
	suggestedType: string;
	reason: string;
}

async function findVideoFiles(dir: string): Promise<string[]> {
	const files: string[] = [];
	const entries = await readdir(dir, { withFileTypes: true });

	for (const entry of entries) {
		const fullPath = join(dir, entry.name);
		if (entry.isDirectory()) {
			files.push(...(await findVideoFiles(fullPath)));
		} else if (entry.name.endsWith(".md") || entry.name.endsWith(".mdx")) {
			files.push(fullPath);
		}
	}

	return files;
}

function parseFrontmatter(content: string): Record<string, unknown> {
	const match = content.match(/^---\n([\s\S]*?)\n---/);
	if (!match) return {};

	const frontmatter: Record<string, unknown> = {};
	const lines = match[1].split("\n");

	for (const line of lines) {
		const colonIndex = line.indexOf(":");
		if (colonIndex > 0 && !line.startsWith(" ") && !line.startsWith("\t")) {
			const key = line.slice(0, colonIndex).trim();
			const value = line.slice(colonIndex + 1).trim();
			if (value && !value.startsWith(">") && !value.startsWith("|")) {
				frontmatter[key] = value.replace(/^['"]|['"]$/g, "");
			}
		}
	}

	return frontmatter;
}

function updateFrontmatter(content: string, type: string, category: string): string {
	const match = content.match(/^(---\n)([\s\S]*?)(\n---\n?)([\s\S]*)$/);
	if (!match) return content;

	let frontmatter = match[2];
	const rest = match[4];

	// Remove existing type/category if present
	frontmatter = frontmatter
		.split("\n")
		.filter((line) => !line.match(/^(type|category):/))
		.join("\n");

	// Add new values after publishedAt
	const lines = frontmatter.split("\n");
	const publishedAtIndex = lines.findIndex((l) => l.startsWith("publishedAt:"));
	const insertIndex = publishedAtIndex >= 0 ? publishedAtIndex + 1 : lines.length;

	lines.splice(insertIndex, 0, `type: ${type}`, `category: ${category}`);

	return `---\n${lines.join("\n")}\n---\n${rest}`;
}

function detectCategory(title: string, description: string): { category: string; reason: string } | null {
	const text = `${title} ${description}`.toLowerCase();

	for (const kw of EDITORIAL_KEYWORDS) {
		if (text.includes(kw)) {
			return { category: "editorial", reason: `Contains "${kw}"` };
		}
	}
	for (const kw of INTERVIEW_KEYWORDS) {
		if (text.includes(kw)) {
			return { category: "interview", reason: `Contains "${kw}"` };
		}
	}
	for (const kw of REVIEW_KEYWORDS) {
		if (text.includes(kw)) {
			return { category: "review", reason: `Contains "${kw}"` };
		}
	}
	for (const kw of ANNOUNCEMENT_KEYWORDS) {
		if (text.includes(kw)) {
			return { category: "announcement", reason: `Contains "${kw}"` };
		}
	}

	return null;
}

function detectType(title: string, duration: number | undefined): { type: string; reason: string } | null {
	const text = title.toLowerCase();

	// Short videos are likely recorded
	if (duration && duration < 600) {
		return { type: "recorded", reason: `Short duration (${Math.round(duration / 60)} min)` };
	}

	for (const kw of RECORDED_KEYWORDS) {
		if (text.includes(kw)) {
			return { type: "recorded", reason: `Contains "${kw}"` };
		}
	}

	return null;
}

async function main() {
	const scriptsDir = import.meta.dir;
	const videosDir = join(scriptsDir, VIDEOS_DIR);

	console.log("\n🎬 Bulk Video Categorization\n");

	const videoFiles = await findVideoFiles(videosDir);
	console.log(`Found ${videoFiles.length} video files\n`);

	const candidates: VideoCandidate[] = [];
	let updated = 0;
	let alreadySet = 0;

	for (const filePath of videoFiles) {
		const content = await readFile(filePath, "utf-8");
		const frontmatter = parseFrontmatter(content);

		const title = (frontmatter.title as string) || "";
		const description = (frontmatter.description as string) || "";
		const duration = frontmatter.duration as number | undefined;
		const currentType = frontmatter.type as string | undefined;
		const currentCategory = frontmatter.category as string | undefined;

		// Skip if already has both
		if (currentType && currentCategory) {
			alreadySet++;
			continue;
		}

		// Detect potential overrides
		const categoryOverride = detectCategory(title, description);
		const typeOverride = detectType(title, duration);

		const finalType = currentType || "live";
		const finalCategory = currentCategory || "tutorial";

		// Update the file with defaults
		const updatedContent = updateFrontmatter(content, finalType, finalCategory);
		await writeFile(filePath, updatedContent);
		updated++;

		// Track candidates that might need manual review
		const relPath = filePath.split("/content/videos/")[1] || filePath;

		if (categoryOverride && categoryOverride.category !== finalCategory) {
			candidates.push({
				file: relPath,
				title,
				suggestedCategory: categoryOverride.category,
				suggestedType: typeOverride?.type || finalType,
				reason: categoryOverride.reason,
			});
		} else if (typeOverride && typeOverride.type !== finalType) {
			candidates.push({
				file: relPath,
				title,
				suggestedCategory: finalCategory,
				suggestedType: typeOverride.type,
				reason: typeOverride.reason,
			});
		}
	}

	console.log(`✅ Updated ${updated} videos to type=live, category=tutorial`);
	console.log(`⏭️  Skipped ${alreadySet} already categorized\n`);

	if (candidates.length > 0) {
		console.log("─".repeat(70));
		console.log(`\n⚠️  ${candidates.length} VIDEOS TO REVIEW:\n`);
		console.log("These videos were set to live/tutorial but might need different values:\n");

		for (const c of candidates) {
			console.log(`📹 ${c.title}`);
			console.log(`   File: ${c.file}`);
			console.log(`   Suggested: type=${c.suggestedType}, category=${c.suggestedCategory}`);
			console.log(`   Reason: ${c.reason}`);
			console.log("");
		}

		// Also write to a file for easier review
		const reviewPath = join(scriptsDir, "videos-to-review.txt");
		const reviewContent = candidates
			.map((c) => `${c.file}\n  Title: ${c.title}\n  Suggested: type=${c.suggestedType}, category=${c.suggestedCategory}\n  Reason: ${c.reason}\n`)
			.join("\n");
		await writeFile(reviewPath, reviewContent);
		console.log(`\n📝 Review list saved to: scripts/videos-to-review.txt\n`);
	}
}

main().catch(console.error);
