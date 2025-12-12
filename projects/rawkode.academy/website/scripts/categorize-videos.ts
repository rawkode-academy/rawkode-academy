#!/usr/bin/env bun
/**
 * Interactive script to categorize videos with type and category fields.
 * Run with: bun run scripts/categorize-videos.ts
 */

import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import * as readline from "node:readline";

const VIDEOS_DIR = "../../../../content/videos";

const CATEGORIES = [
	{ key: "1", value: "announcement", label: "Announcement - News, updates" },
	{ key: "2", value: "editorial", label: "Editorial - Opinion, commentary" },
	{ key: "3", value: "tutorial", label: "Tutorial - Step-by-step guides" },
	{ key: "4", value: "interview", label: "Interview - Conversations" },
	{ key: "5", value: "review", label: "Review - Tool/platform reviews" },
	{ key: "s", value: "skip", label: "Skip this video" },
	{ key: "q", value: "quit", label: "Quit" },
];

const TYPES = [
	{ key: "1", value: "live", label: "Live - Livestream recording" },
	{ key: "2", value: "recorded", label: "Recorded - Pre-recorded content" },
	{ key: "s", value: "skip", label: "Skip this video" },
	{ key: "q", value: "quit", label: "Quit" },
];

const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout,
});

function prompt(question: string): Promise<string> {
	return new Promise((resolve) => {
		rl.question(question, (answer) => {
			resolve(answer.trim().toLowerCase());
		});
	});
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

function parseFrontmatter(content: string): {
	frontmatter: Record<string, unknown>;
	body: string;
	raw: string;
} {
	const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
	if (!match) {
		return { frontmatter: {}, body: content, raw: "" };
	}

	const raw = match[1];
	const body = match[2];

	// Simple YAML parsing for our needs
	const frontmatter: Record<string, unknown> = {};
	const lines = raw.split("\n");

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

	return { frontmatter, body, raw };
}

function updateFrontmatter(
	content: string,
	updates: { type?: string; category?: string }
): string {
	const match = content.match(/^(---\n)([\s\S]*?)(\n---\n?)([\s\S]*)$/);
	if (!match) return content;

	let frontmatter = match[2];
	const rest = match[4];

	// Remove existing type/category if present
	frontmatter = frontmatter
		.split("\n")
		.filter((line) => !line.match(/^(type|category):/))
		.join("\n");

	// Add new values after publishedAt or at the end
	const lines = frontmatter.split("\n");
	const publishedAtIndex = lines.findIndex((l) => l.startsWith("publishedAt:"));
	const insertIndex = publishedAtIndex >= 0 ? publishedAtIndex + 1 : lines.length;

	const newLines: string[] = [];
	if (updates.type) newLines.push(`type: ${updates.type}`);
	if (updates.category) newLines.push(`category: ${updates.category}`);

	lines.splice(insertIndex, 0, ...newLines);

	return `---\n${lines.join("\n")}\n---\n${rest}`;
}

async function main() {
	const scriptsDir = import.meta.dir;
	const videosDir = join(scriptsDir, VIDEOS_DIR);

	console.log("\n🎬 Video Categorization Script\n");
	console.log(`Scanning: ${videosDir}\n`);

	const videoFiles = await findVideoFiles(videosDir);
	console.log(`Found ${videoFiles.length} video files\n`);

	let updated = 0;
	let skipped = 0;

	for (let i = 0; i < videoFiles.length; i++) {
		const filePath = videoFiles[i];
		const content = await readFile(filePath, "utf-8");
		const { frontmatter } = parseFrontmatter(content);

		const title = frontmatter.title as string || "Unknown";
		const currentType = frontmatter.type as string | undefined;
		const currentCategory = frontmatter.category as string | undefined;

		// Skip if already categorized
		if (currentType && currentCategory) {
			console.log(`✓ [${i + 1}/${videoFiles.length}] Already categorized: ${title}`);
			console.log(`  Type: ${currentType}, Category: ${currentCategory}\n`);
			skipped++;
			continue;
		}

		console.log("─".repeat(60));
		console.log(`\n📹 [${i + 1}/${videoFiles.length}] ${title}\n`);
		console.log(`   File: ${filePath.split("/content/videos/")[1]}`);
		if (currentType) console.log(`   Current type: ${currentType}`);
		if (currentCategory) console.log(`   Current category: ${currentCategory}`);
		console.log("");

		let selectedType = currentType;
		let selectedCategory = currentCategory;

		// Prompt for type if not set
		if (!currentType) {
			console.log("Select TYPE:");
			for (const t of TYPES) {
				console.log(`  [${t.key}] ${t.label}`);
			}
			const typeChoice = await prompt("\nType choice: ");

			const typeOption = TYPES.find((t) => t.key === typeChoice);
			if (typeOption?.value === "quit") {
				console.log("\n👋 Quitting...\n");
				break;
			}
			if (typeOption?.value === "skip") {
				console.log("Skipping...\n");
				skipped++;
				continue;
			}
			if (typeOption && typeOption.value !== "skip") {
				selectedType = typeOption.value;
			}
		}

		// Prompt for category if not set
		if (!currentCategory) {
			console.log("\nSelect CATEGORY:");
			for (const c of CATEGORIES) {
				console.log(`  [${c.key}] ${c.label}`);
			}
			const categoryChoice = await prompt("\nCategory choice: ");

			const categoryOption = CATEGORIES.find((c) => c.key === categoryChoice);
			if (categoryOption?.value === "quit") {
				console.log("\n👋 Quitting...\n");
				break;
			}
			if (categoryOption?.value === "skip") {
				console.log("Skipping...\n");
				skipped++;
				continue;
			}
			if (categoryOption && categoryOption.value !== "skip") {
				selectedCategory = categoryOption.value;
			}
		}

		// Update file if we have new values
		if (
			(selectedType && selectedType !== currentType) ||
			(selectedCategory && selectedCategory !== currentCategory)
		) {
			const updatedContent = updateFrontmatter(content, {
				type: selectedType,
				category: selectedCategory,
			});
			await writeFile(filePath, updatedContent);
			console.log(`\n✅ Updated: type=${selectedType}, category=${selectedCategory}\n`);
			updated++;
		}
	}

	console.log("─".repeat(60));
	console.log(`\n📊 Summary: ${updated} updated, ${skipped} skipped\n`);

	rl.close();
}

main().catch(console.error);
