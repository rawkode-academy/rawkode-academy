#!/usr/bin/env bun
// Validates SEO-relevant fields of local Markdown/MDX articles and the courses
// and videos served by the API gateway. Point it at another gateway with
// GRAPHQL_ENDPOINT, e.g. a local composed gateway.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { load as parseYaml } from "js-yaml";

const GRAPHQL_ENDPOINT =
	process.env.GRAPHQL_ENDPOINT ?? "https://api.rawkode.academy/";
const ARTICLE_FILE = /\.mdx?$/;
const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;

function defaultArticlesDir(): string {
	if (import.meta.url.startsWith("file:")) {
		return fileURLToPath(
			new URL("../../../../content/articles", import.meta.url),
		);
	}
	return resolve(process.cwd(), "../../../content/articles");
}

// biome-ignore lint/suspicious/noExplicitAny: untyped gateway JSON
type Data = Record<string, any>;

interface ValidationError {
	file: string;
	errors: string[];
}

async function query<T>(operationName: string, query: string): Promise<T> {
	const response = await fetch(GRAPHQL_ENDPOINT, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ operationName, query }),
	});
	const payload = (await response.json()) as {
		data?: T;
		errors?: { message: string }[];
	};
	if (!response.ok || payload.errors?.length || !payload.data) {
		throw new Error(
			`${operationName} failed: HTTP ${response.status} ${payload.errors?.map((e) => e.message).join("; ") ?? ""}`,
		);
	}
	return payload.data;
}

const GENERIC_ALT_PATTERN = /^(image|photo|picture|screenshot)$/i;

function parseDateValue(value: unknown): Date | undefined {
	if (value instanceof Date) {
		return Number.isNaN(value.getTime()) ? undefined : value;
	}
	if (typeof value === "string" || typeof value === "number") {
		const parsed = new Date(value);
		return Number.isNaN(parsed.getTime()) ? undefined : parsed;
	}
	return undefined;
}

export function validateArticle(data: Data): string[] {
	const errors: string[] = [];

	// Title validation (editorial titles up to 70 chars; ogTitle can be shorter)
	const title = typeof data?.title === "string" ? data.title.trim() : "";
	if (!title) {
		errors.push("Missing title");
	} else {
		if (title.length < 10) {
			errors.push(`Title too short (${title.length} chars, min 10)`);
		}
		if (title.length > 70) {
			errors.push(`Title too long (${title.length} chars, max 70)`);
		}
	}

	// Description validation (matches M1 <= 160 char clamping)
	const description =
		typeof data?.description === "string" ? data.description.trim() : "";
	if (!description) {
		errors.push("Missing description");
	} else {
		if (description.length < 50) {
			errors.push(`Description too short (${description.length} chars, min 50)`);
		}
		if (description.length > 160) {
			errors.push(`Description too long (${description.length} chars, max 160)`);
		}
	}

	// OpenGraph validation (optional; ogTitle falls back to title per F04)
	if (data?.openGraph && data.openGraph.title !== undefined) {
		if (
			typeof data.openGraph.title !== "string" ||
			data.openGraph.title.trim().length === 0
		) {
			errors.push("OpenGraph title must be a non-empty string when provided");
		}
	}

	// Date validation
	if (!parseDateValue(data?.publishedAt)) {
		errors.push("Missing or invalid publishedAt date");
	}

	// Author validation
	if (!Array.isArray(data?.authors) || data.authors.length === 0) {
		errors.push("Missing authors");
	}

	// Cover image validation
	if (data?.cover) {
		const alt =
			typeof data.cover.alt === "string" ? data.cover.alt.trim() : "";
		if (!alt) {
			errors.push("Cover image missing alt text");
		} else if (GENERIC_ALT_PATTERN.test(alt)) {
			errors.push(`Cover image alt text is too generic ("${alt}")`);
		}
	}

	return errors;
}

export function validateCourse(data: Data): string[] {
	const errors: string[] = [];

	// Title validation
	const title = typeof data?.title === "string" ? data.title.trim() : "";
	if (!title) {
		errors.push("Missing title");
	}

	// Description validation
	const description =
		typeof data?.description === "string" ? data.description.trim() : "";
	if (!description) {
		errors.push("Missing description");
	} else if (description.length < 50) {
		errors.push(`Description too short (${description.length} chars, min 50)`);
	}

	// Date validation
	if (!parseDateValue(data?.publishedAt)) {
		errors.push("Missing or invalid publishedAt date");
	}

	// Difficulty validation
	if (
		typeof data?.difficulty !== "string" ||
		!["beginner", "intermediate", "advanced"].includes(data.difficulty)
	) {
		errors.push("Invalid or missing difficulty level");
	}

	return errors;
}

export function validateVideo(data: Data, now: Date = new Date()): string[] {
	const errors: string[] = [];

	if (!data?.id || String(data.id).trim().length === 0) {
		errors.push("Missing video id");
	}

	const slug = typeof data?.slug === "string" ? data.slug.trim() : "";
	if (!slug) {
		errors.push("Missing slug");
	} else if (slug.startsWith("/") || slug.endsWith("/")) {
		errors.push("Slug must not have leading or trailing slashes");
	}

	const title = typeof data?.title === "string" ? data.title.trim() : "";
	if (!title || title.length < 5) {
		errors.push("Missing or too-short title");
	}

	const description =
		typeof data?.description === "string" ? data.description.trim() : "";
	if (!description) {
		errors.push("Missing description");
	} else if (description.length < 20) {
		errors.push("Description too short (min 20 chars)");
	}

	const publishedDate = parseDateValue(data?.publishedAt);
	if (!publishedDate) {
		errors.push("Missing or invalid publishedAt date");
	}

	const isUpcomingLive =
		data?.type === "live" &&
		publishedDate !== undefined &&
		publishedDate.getTime() > now.getTime();
	if (!isUpcomingLive) {
		if (
			typeof data?.duration !== "number" ||
			!Number.isFinite(data.duration) ||
			data.duration <= 0
		) {
			errors.push("Missing or invalid duration");
		}
	}

	return errors;
}

function walkArticleFiles(dir: string): string[] {
	if (!existsSync(dir)) return [];
	const files: string[] = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) files.push(...walkArticleFiles(path));
		else if (ARTICLE_FILE.test(entry.name)) files.push(path);
	}
	return files.sort();
}

export function loadLocalArticles(root: string = defaultArticlesDir()): Data[] {
	const articles: Data[] = [];
	for (const path of walkArticleFiles(root)) {
		const id = relative(root, path)
			.split(sep)
			.join("/")
			.replace(ARTICLE_FILE, "")
			.replace(/\/index$/, "");
		const raw = readFileSync(path, "utf8");
		const match = raw.match(FRONTMATTER);
		const parsed = match?.[1] ? (parseYaml(match[1]) as Data | null) : null;
		if (!parsed || typeof parsed !== "object" || parsed.draft === true) {
			continue;
		}
		articles.push({ id, ...parsed });
	}
	return articles;
}

export async function main() {
	console.log(
		`🔍 Validating SEO requirements against local articles and ${GRAPHQL_ENDPOINT}...\n`,
	);

	const validationErrors: ValidationError[] = [];
	const allArticles = loadLocalArticles();
	const [{ allCourses }, { getAllVideos }] = await Promise.all([
		query<{ allCourses: Data[] }>(
			"SeoCourses",
			"query SeoCourses { allCourses { id title description publishedAt difficulty modules { id title description publishedAt difficulty } } }",
		),
		query<{ getAllVideos: Data[] }>(
			"SeoVideos",
			"query SeoVideos { getAllVideos { id slug title description publishedAt duration type } }",
		),
	]);

	const check = (file: string, errors: string[]) => {
		if (errors.length > 0) validationErrors.push({ file, errors });
	};
	for (const article of allArticles) {
		check(`articles/${article.id}`, validateArticle(article));
	}
	for (const course of allCourses) {
		check(`courses/${course.id}`, validateCourse(course));
		for (const module of course.modules ?? []) {
			// Modules inherit the course difficulty when they have none.
			check(
				`courseModules/${module.id}`,
				validateCourse({
					...module,
					difficulty: module.difficulty ?? course.difficulty,
				}),
			);
		}
	}
	for (const video of getAllVideos) {
		check(`videos/${video.id}`, validateVideo(video));
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

		console.error(`Total entries with errors: ${validationErrors.length}`);
		process.exit(1);
	}
}

const isMainModule = process.argv[1]?.endsWith("validate-seo.ts");

if (isMainModule) {
	main().catch((error) => {
		console.error("Error running SEO validation:", error);
		process.exit(1);
	});
}
