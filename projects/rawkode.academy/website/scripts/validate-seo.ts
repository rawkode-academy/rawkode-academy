#!/usr/bin/env -S deno run --allow-read --allow-env=__MINIMATCH_TESTING_PLATFORM__
import { glob } from "glob";
import { readFile } from "node:fs/promises";
import process from "node:process";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";

type Frontmatter = Record<string, unknown>;

type ValidationError = {
	file: string;
	errors: string[];
};

type ValidationTarget = {
	pattern: string;
	validate: (filePath: string) => Promise<string[]>;
};

function textValue(data: Frontmatter, key: string): string {
	const value = data[key];
	return value === null || value === undefined ? "" : String(value);
}

function hasValue(data: Frontmatter, key: string): boolean {
	const value = data[key];
	return Array.isArray(value) ? value.length > 0 : Boolean(value);
}

function validateTextLength(
	errors: string[],
	value: string,
	label: string,
	min?: number,
	max?: number,
) {
	if (min !== undefined && value.length < min) {
		errors.push(`${label} too short (${value.length} chars, min ${min})`);
	}
	if (max !== undefined && value.length > max) {
		errors.push(`${label} too long (${value.length} chars, max ${max})`);
	}
}

async function readFrontmatter(filePath: string): Promise<Frontmatter> {
	const content = await readFile(filePath, "utf-8");
	return matter(content).data as Frontmatter;
}

function validateRequiredText(
	errors: string[],
	data: Frontmatter,
	key: string,
	missingMessage: string,
	lengthLabel: string,
	min?: number,
	max?: number,
) {
	const value = textValue(data, key);
	if (!value) {
		errors.push(missingMessage);
		return;
	}
	validateTextLength(errors, value, lengthLabel, min, max);
}

function validateArticleData(data: Frontmatter): string[] {
	const errors: string[] = [];
	validateRequiredText(errors, data, "title", "Missing title", "Title", 10, 60);
	validateRequiredText(
		errors,
		data,
		"description",
		"Missing description",
		"Description",
		50,
		160,
	);

	const openGraph = data.openGraph as Frontmatter | undefined;
	if (!openGraph) {
		errors.push("Missing OpenGraph data");
	} else {
		if (!openGraph.title) errors.push("Missing OpenGraph title");
		if (!openGraph.subtitle) errors.push("Missing OpenGraph subtitle");
	}

	if (!data.publishedAt) errors.push("Missing publishedAt date");
	if (!hasValue(data, "authors")) errors.push("Missing authors");

	const cover = data.cover as Frontmatter | undefined;
	if (cover && !cover.alt) errors.push("Cover image missing alt text");
	return errors;
}

function validateCourseData(data: Frontmatter): string[] {
	const errors: string[] = [];
	validateRequiredText(errors, data, "title", "Missing title", "Title");
	validateRequiredText(
		errors,
		data,
		"description",
		"Missing description",
		"Description",
		50,
	);

	if (!data.publishedAt) errors.push("Missing publishedAt date");
	if (
		!data.difficulty ||
		!["beginner", "intermediate", "advanced"].includes(String(data.difficulty))
	) {
		errors.push("Invalid or missing difficulty level");
	}

	return errors;
}

function validateVideoData(data: Frontmatter): string[] {
	const errors: string[] = [];
	if (textValue(data, "id").trim().length === 0) {
		errors.push("Missing video id");
	}
	if (textValue(data, "slug").trim().length === 0) {
		errors.push("Missing slug");
	}
	if (textValue(data, "title").trim().length < 5) {
		errors.push("Missing or too-short title");
	}

	const description = textValue(data, "description").trim();
	if (!description) {
		errors.push("Missing description");
	} else if (description.length < 20) {
		errors.push("Description too short (min 20 chars)");
	}

	if (!data.publishedAt) errors.push("Missing publishedAt date");
	if (typeof data.duration !== "number" || data.duration <= 0) {
		errors.push("Missing or invalid duration");
	}

	return errors;
}

async function validateFrontmatterFile(
	filePath: string,
	validate: (data: Frontmatter) => string[],
): Promise<string[]> {
	return validate(await readFrontmatter(filePath));
}

function validationTargets(contentRoot: string): ValidationTarget[] {
	return [
		{
			pattern: `${contentRoot}/articles/**/*.{md,mdx}`,
			validate: (file) => validateFrontmatterFile(file, validateArticleData),
		},
		{
			pattern: `${contentRoot}/courses/**/*.{md,mdx}`,
			validate: (file) => validateFrontmatterFile(file, validateCourseData),
		},
		{
			pattern: `${contentRoot}/videos/**/*.{md,mdx}`,
			validate: (file) => validateFrontmatterFile(file, validateVideoData),
		},
	];
}

async function collectValidationErrors(
	targets: ValidationTarget[],
): Promise<ValidationError[]> {
	const validationErrors: ValidationError[] = [];

	for (const target of targets) {
		for (const file of await glob(target.pattern)) {
			const errors = await target.validate(file);
			if (errors.length > 0) {
				validationErrors.push({ file, errors });
			}
		}
	}

	return validationErrors;
}

function reportValidationErrors(validationErrors: ValidationError[]) {
	if (validationErrors.length === 0) {
		console.log("✅ All SEO validations passed!");
		return;
	}

	console.error("❌ SEO validation errors found:\n");
	for (const { file, errors } of validationErrors) {
		console.error(`📄 ${file}:`);
		for (const error of errors) {
			console.error(`   - ${error}`);
		}
		console.error("");
	}
	console.error(`Total files with errors: ${validationErrors.length}`);
}

async function main() {
	console.log("🔍 Validating SEO requirements...\n");

	const contentRoot = fileURLToPath(
		new URL("../../../../content", import.meta.url),
	);
	const validationErrors = await collectValidationErrors(
		validationTargets(contentRoot),
	);
	reportValidationErrors(validationErrors);
	process.exit(validationErrors.length === 0 ? 0 : 1);
}

main().catch((error) => {
	console.error("Error running SEO validation:", error);
	process.exit(1);
});
