#!/usr/bin/env bun
// Validates SEO-relevant fields of the content served by the API gateway
// (content lives in D1 platform services, not in files). Point it at another
// gateway with GRAPHQL_ENDPOINT, e.g. a local composed gateway.
const GRAPHQL_ENDPOINT =
	process.env.GRAPHQL_ENDPOINT ?? "https://api.rawkode.academy/";

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

function validateArticle(data: Data): string[] {
	const errors: string[] = [];

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

function validateCourse(data: Data): string[] {
	const errors: string[] = [];

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

function validateVideo(data: Data): string[] {
	const errors: string[] = [];

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
	console.log(
		`🔍 Validating SEO requirements against ${GRAPHQL_ENDPOINT}...\n`,
	);

	const validationErrors: ValidationError[] = [];
	const [{ allArticles }, { allCourses }, { getAllVideos }] = await Promise.all(
		[
			query<{ allArticles: Data[] }>(
				"SeoArticles",
				"query SeoArticles { allArticles { id title description openGraph { title subtitle } publishedAt authors { id } cover { alt } } }",
			),
			query<{ allCourses: Data[] }>(
				"SeoCourses",
				"query SeoCourses { allCourses { id title description publishedAt difficulty modules { id title description publishedAt difficulty } } }",
			),
			query<{ getAllVideos: Data[] }>(
				"SeoVideos",
				"query SeoVideos { getAllVideos { id slug title description publishedAt duration } }",
			),
		],
	);

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

main().catch((error) => {
	console.error("Error running SEO validation:", error);
	process.exit(1);
});
