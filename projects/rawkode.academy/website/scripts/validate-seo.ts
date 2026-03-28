#!/usr/bin/env bun
import { glob } from "glob";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import matter from "gray-matter";

interface ValidationError {
	file: string;
	errors: string[];
}

async function validateArticle(filePath: string): Promise<string[]> {
	const errors: string[] = [];
	const content = await readFile(filePath, "utf-8");
	const { data } = matter(content);

	// Title validation
	if (!data.title) {
		errors.push("Missing title");
	} else {
		if (data.title.length < 10) {
			errors.push(`Title too short (${data.title.length} chars, min 10)`);
		}
		if (data.title.length > 60) {
			errors.push(`Title too long (${data.title.length} chars, max 60)`);
		}
	}

	// Description validation
	if (!data.description) {
		errors.push("Missing description");
	} else {
		if (data.description.length < 50) {
			errors.push(
				`Description too short (${data.description.length} chars, min 50)`,
			);
		}
		if (data.description.length > 160) {
			errors.push(
				`Description too long (${data.description.length} chars, max 160)`,
			);
		}
	}

	// OpenGraph validation
	if (!data.openGraph) {
		errors.push("Missing OpenGraph data");
	} else {
		if (!data.openGraph.title) {
			errors.push("Missing OpenGraph title");
		}
		if (!data.openGraph.subtitle) {
			errors.push("Missing OpenGraph subtitle");
		}
	}

	// Date validation
	if (!data.publishedAt) {
		errors.push("Missing publishedAt date");
	}

	// Author validation
	if (!data.authors || data.authors.length === 0) {
		errors.push("Missing authors");
	}

	// Cover image validation
	if (data.cover && !data.cover.alt) {
		errors.push("Cover image missing alt text");
	}

	return errors;
}

async function validateCourse(filePath: string): Promise<string[]> {
	const errors: string[] = [];
	const content = await readFile(filePath, "utf-8");
	const { data } = matter(content);

	// Title validation
	if (!data.title) {
		errors.push("Missing title");
	}

	// Description validation
	if (!data.description) {
		errors.push("Missing description");
	} else if (data.description.length < 50) {
		errors.push(
			`Description too short (${data.description.length} chars, min 50)`,
		);
	}

	// Date validation
	if (!data.publishedAt) {
		errors.push("Missing publishedAt date");
	}

	// Difficulty validation
	if (
		!data.difficulty ||
		!["beginner", "intermediate", "advanced"].includes(data.difficulty)
	) {
		errors.push("Invalid or missing difficulty level");
	}

	return errors;
}

async function validateVideo(filePath: string): Promise<string[]> {
	const errors: string[] = [];
	const content = await readFile(filePath, "utf-8");
	const { data } = matter(content);

	if (!data.id || String(data.id).trim().length === 0) {
		errors.push("Missing video id");
	}

	if (!data.slug || String(data.slug).trim().length === 0) {
		errors.push("Missing slug");
	}

	if (!data.title || String(data.title).trim().length < 5) {
		errors.push("Missing or too-short title");
	}

	if (!data.description) {
		errors.push("Missing description");
	} else if (String(data.description).trim().length < 20) {
		errors.push("Description too short (min 20 chars)");
	}

	if (!data.publishedAt) {
		errors.push("Missing publishedAt date");
	}

	if (typeof data.duration !== "number" || data.duration <= 0) {
		errors.push("Missing or invalid duration");
	}

	return errors;
}

async function main() {
	console.log("🔍 Validating SEO requirements...\n");

	const validationErrors: ValidationError[] = [];
	const contentRoot = resolve(import.meta.dir, "../../../../content");

	// Validate articles
	const articleFiles = await glob(`${contentRoot}/articles/**/*.{md,mdx}`);
	for (const file of articleFiles) {
		const errors = await validateArticle(file);
		if (errors.length > 0) {
			validationErrors.push({ file, errors });
		}
	}

	// Validate courses
	const courseFiles = await glob(`${contentRoot}/courses/**/*.{md,mdx}`);
	for (const file of courseFiles) {
		const errors = await validateCourse(file);
		if (errors.length > 0) {
			validationErrors.push({ file, errors });
		}
	}

	// Validate videos
	const videoFiles = await glob(`${contentRoot}/videos/**/*.{md,mdx}`);
	for (const file of videoFiles) {
		const errors = await validateVideo(file);
		if (errors.length > 0) {
			validationErrors.push({ file, errors });
		}
	}

	// Report results
	if (validationErrors.length === 0) {
		console.log("✅ All SEO validations passed!");
		process.exit(0);
	} else {
		console.error("❌ SEO validation errors found:\n");

		for (const { file, errors } of validationErrors) {
			console.error(`📄 ${file}:`);
			for (const error of errors) {
				console.error(`   - ${error}`);
			}
			console.error("");
		}

		console.error(`Total files with errors: ${validationErrors.length}`);
		process.exit(1);
	}
}

main().catch((error) => {
	console.error("Error running SEO validation:", error);
	process.exit(1);
});
