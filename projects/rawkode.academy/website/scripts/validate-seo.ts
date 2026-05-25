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

function nullableValue<T>(value: T | null): value is T {
	return value !== null;
}

function textValue(data: Frontmatter, key: string): string {
	const value = data[key];
	return value === null || value === undefined ? "" : String(value);
}

function hasValue(data: Frontmatter, key: string): boolean {
	const value = data[key];
	return Array.isArray(value) ? value.length > 0 : Boolean(value);
}

function missingWhen(condition: boolean, message: string): string[] {
	return condition ? [message] : [];
}

function minLengthError(
	value: string,
	label: string,
	min?: number,
): string | null {
	return min !== undefined && value.length < min
		? `${label} too short (${value.length} chars, min ${min})`
		: null;
}

function maxLengthError(
	value: string,
	label: string,
	max?: number,
): string | null {
	return max !== undefined && value.length > max
		? `${label} too long (${value.length} chars, max ${max})`
		: null;
}

function validateTextLength(
	value: string,
	label: string,
	min?: number,
	max?: number,
): string[] {
	return [
		minLengthError(value, label, min),
		maxLengthError(value, label, max),
	].filter(nullableValue);
}

async function readFrontmatter(filePath: string): Promise<Frontmatter> {
	const content = await readFile(filePath, "utf-8");
	return matter(content).data as Frontmatter;
}

function validateRequiredText(
	data: Frontmatter,
	key: string,
	missingMessage: string,
	lengthLabel: string,
	min?: number,
	max?: number,
): string[] {
	const value = textValue(data, key);
	return value
		? validateTextLength(value, lengthLabel, min, max)
		: [missingMessage];
}

function openGraphErrors(data: Frontmatter): string[] {
	const openGraph = data.openGraph as Frontmatter | undefined;
	if (!openGraph) return ["Missing OpenGraph data"];
	return [
		!openGraph.title ? "Missing OpenGraph title" : null,
		!openGraph.subtitle ? "Missing OpenGraph subtitle" : null,
	].filter(nullableValue);
}

function coverErrors(data: Frontmatter): string[] {
	const cover = data.cover as Frontmatter | undefined;
	return missingWhen(
		Boolean(cover && !cover.alt),
		"Cover image missing alt text",
	);
}

function validateArticleData(data: Frontmatter): string[] {
	return [
		...validateRequiredText(data, "title", "Missing title", "Title", 10, 60),
		...validateRequiredText(
			data,
			"description",
			"Missing description",
			"Description",
			50,
			160,
		),
		...openGraphErrors(data),
		...missingWhen(!data.publishedAt, "Missing publishedAt date"),
		...missingWhen(!hasValue(data, "authors"), "Missing authors"),
		...coverErrors(data),
	];
}

function validateCourseData(data: Frontmatter): string[] {
	return [
		...validateRequiredText(data, "title", "Missing title", "Title"),
		...validateRequiredText(
			data,
			"description",
			"Missing description",
			"Description",
			50,
		),
		...missingWhen(!data.publishedAt, "Missing publishedAt date"),
		...missingWhen(
			!["beginner", "intermediate", "advanced"].includes(
				String(data.difficulty),
			),
			"Invalid or missing difficulty level",
		),
	];
}

function validateVideoData(data: Frontmatter): string[] {
	const description = textValue(data, "description").trim();
	return [
		...missingWhen(
			textValue(data, "id").trim().length === 0,
			"Missing video id",
		),
		...missingWhen(textValue(data, "slug").trim().length === 0, "Missing slug"),
		...missingWhen(
			textValue(data, "title").trim().length < 5,
			"Missing or too-short title",
		),
		...missingWhen(!description, "Missing description"),
		...missingWhen(
			Boolean(description) && description.length < 20,
			"Description too short (min 20 chars)",
		),
		...missingWhen(!data.publishedAt, "Missing publishedAt date"),
		...missingWhen(
			typeof data.duration !== "number" || data.duration <= 0,
			"Missing or invalid duration",
		),
	];
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
