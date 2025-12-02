#!/usr/bin/env bun
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { input, select } from "@inquirer/prompts";
import matter from "gray-matter";
import {
	MATRIX_CONFIDENCE_VALUES,
	MATRIX_GROUPING_VALUES,
	MATRIX_TRAJECTORY_VALUES,
} from "../src/dimensions.js";

const TECHNOLOGIES_DIR = join(import.meta.dir, "../technologies");

interface MatrixData {
	status: string;
	grouping?: string;
	confidence?: string;
	trajectory?: string;
	firstUsed?: string;
	lastUsed?: string;
	makesMeFeel?: string;
	why?: string;
	spicyTake?: string;
}

interface TechnologyFrontmatter {
	name: string;
	matrix?: MatrixData;
	[key: string]: unknown;
}

const CARD_FIELDS = [
	"grouping",
	"confidence",
	"trajectory",
	"firstUsed",
	"lastUsed",
	"makesMeFeel",
	"why",
	"spicyTake",
] as const;

function getMissingFields(matrix: MatrixData): string[] {
	return CARD_FIELDS.filter((field) => !matrix[field]);
}

async function promptForGrouping(): Promise<string> {
	return select({
		message: "Which grouping does this technology belong to?",
		choices: MATRIX_GROUPING_VALUES.map((value) => ({
			name: value,
			value,
			description: {
				plumbing: "The invisible infrastructure",
				platform: "Building blocks for developers",
				observability: "Understanding what's happening",
				security: "Keeping things safe",
			}[value],
		})),
	});
}

async function promptForConfidence(): Promise<string> {
	return select({
		message: "How confident are you in this placement?",
		choices: MATRIX_CONFIDENCE_VALUES.map((value) => ({
			name: value,
			value,
			description: {
				gut: "Intuition-based",
				"some-experience": "Tried it out",
				"deep-experience": "Production usage",
			}[value],
		})),
	});
}

async function promptForTrajectory(): Promise<string> {
	return select({
		message: "What's the trajectory of this technology?",
		choices: MATRIX_TRAJECTORY_VALUES.map((value) => ({
			name: value,
			value,
			description: {
				rising: "Gaining momentum",
				stable: "Consistent position",
				falling: "Losing momentum",
			}[value],
		})),
	});
}

async function promptForFirstUsed(): Promise<string> {
	return input({
		message: "When did you first use this? (YYYY-MM format, e.g., 2020-03)",
		validate: (value) => {
			if (!/^\d{4}-\d{2}$/.test(value)) {
				return "Please enter a valid YYYY-MM format";
			}
			return true;
		},
	});
}

async function promptForLastUsed(): Promise<string> {
	return input({
		message:
			'When did you last use this? (YYYY-MM format or "Present" if still using)',
		validate: (value) => {
			if (value.toLowerCase() === "present" || /^\d{4}-\d{2}$/.test(value)) {
				return true;
			}
			return 'Please enter a valid YYYY-MM format or "Present"';
		},
		transformer: (value) =>
			value.toLowerCase() === "present" ? "Present" : value,
	});
}

async function promptForMakesMeFeel(): Promise<string> {
	return input({
		message: "What emoji represents how this tech makes you feel?",
		validate: (value) => {
			if (!value.trim()) {
				return "Please enter an emoji";
			}
			return true;
		},
	});
}

async function promptForWhy(): Promise<string> {
	return input({
		message: "Why do you advocate for this technology?",
	});
}

async function promptForSpicyTake(): Promise<string> {
	return input({
		message: "What's your spicy/hot take on this technology?",
	});
}

async function main() {
	console.log("\n🌶️  Advocate Technology Card Data Enrichment\n");
	console.log("This script will help you fill in missing card data for");
	console.log('technologies marked as "advocate" in the matrix.\n');

	const entries = await readdir(TECHNOLOGIES_DIR, { withFileTypes: true });
	const dirs = entries
		.filter((e) => e.isDirectory())
		.map((e) => e.name)
		.sort();

	const advocateTechs: Array<{
		dir: string;
		name: string;
		data: TechnologyFrontmatter;
		body: string;
		missingFields: string[];
	}> = [];

	// First pass: find all advocate technologies with missing fields
	for (const dir of dirs) {
		const mdxPath = join(TECHNOLOGIES_DIR, dir, "index.mdx");

		let content: string;
		try {
			content = await readFile(mdxPath, "utf-8");
		} catch {
			continue;
		}

		const { data, content: body } = matter(content);
		const frontmatter = data as TechnologyFrontmatter;

		// Only process advocate technologies
		if (frontmatter.matrix?.status !== "advocate") {
			continue;
		}

		const missingFields = getMissingFields(frontmatter.matrix);

		if (missingFields.length > 0) {
			advocateTechs.push({
				dir,
				name: frontmatter.name || dir,
				data: frontmatter,
				body,
				missingFields,
			});
		}
	}

	if (advocateTechs.length === 0) {
		console.log("All advocate technologies have complete card data!");
		return;
	}

	console.log(`Found ${advocateTechs.length} advocate technologies with missing card data:\n`);

	for (const tech of advocateTechs) {
		console.log(`  - ${tech.name}: missing ${tech.missingFields.join(", ")}`);
	}

	console.log("");

	// Process each technology
	for (const tech of advocateTechs) {
		console.log(`\n${"=".repeat(60)}`);
		console.log(`\n📦 ${tech.name}\n`);
		console.log(`Missing fields: ${tech.missingFields.join(", ")}\n`);
		console.log(`${"=".repeat(60)}\n`);

		const matrix = tech.data.matrix!;

		for (const field of tech.missingFields) {
			switch (field) {
				case "grouping":
					matrix.grouping = await promptForGrouping();
					break;
				case "confidence":
					matrix.confidence = await promptForConfidence();
					break;
				case "trajectory":
					matrix.trajectory = await promptForTrajectory();
					break;
				case "firstUsed":
					matrix.firstUsed = await promptForFirstUsed();
					break;
				case "lastUsed":
					matrix.lastUsed = await promptForLastUsed();
					break;
				case "makesMeFeel":
					matrix.makesMeFeel = await promptForMakesMeFeel();
					break;
				case "why":
					matrix.why = await promptForWhy();
					break;
				case "spicyTake":
					matrix.spicyTake = await promptForSpicyTake();
					break;
			}
		}

		// Update the frontmatter
		tech.data.matrix = matrix;

		const mdxPath = join(TECHNOLOGIES_DIR, tech.dir, "index.mdx");
		const updated = matter.stringify(tech.body, tech.data);
		await writeFile(mdxPath, updated);

		console.log(`\n✓ Saved ${tech.name}\n`);
	}

	console.log("\n🎉 Done!\n");
}

main().catch(console.error);
