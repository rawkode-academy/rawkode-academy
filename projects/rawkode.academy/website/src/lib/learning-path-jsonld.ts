export interface LearningPathAuthor {
	id: string;
	name: string;
}

export interface LearningPathSource {
	title: string;
	description: string;
	difficulty: "beginner" | "intermediate" | "advanced";
	prerequisites?: ReadonlyArray<string>;
	technologyLabels: ReadonlyArray<string>;
	publishedAt: Date;
}

export interface BuildLearningPathJsonLdInput {
	siteUrl: string;
	pathUrl: string;
	source: LearningPathSource;
	authors: ReadonlyArray<LearningPathAuthor>;
}

const PUBLISHER_NAME = "Rawkode Academy";
const PUBLISHER_LOGO_PATH = "/android-chrome-512x512.png";

const DIFFICULTY_LABEL: Record<
	"beginner" | "intermediate" | "advanced",
	string
> = {
	beginner: "Beginner",
	intermediate: "Intermediate",
	advanced: "Advanced",
};

function joinUrl(base: string, path: string): string {
	return new URL(path, base).href;
}

/**
 * Build a schema.org/Course JSON-LD payload for a learning path detail page.
 * Course is Google's tracked rich-result type for educational content; the
 * payload also carries `learningResourceType: "LearningPath"` so consumers
 * that understand the more general schema.org/LearningResource taxonomy can
 * differentiate paths from single courses.
 */
export function buildLearningPathJsonLd(
	input: BuildLearningPathJsonLdInput,
): Record<string, unknown> {
	const { siteUrl, pathUrl, source, authors } = input;

	const jsonLd: Record<string, unknown> = {
		"@context": "https://schema.org",
		"@type": "Course",
		name: source.title,
		description: source.description,
		url: pathUrl,
		datePublished: new Date(source.publishedAt).toISOString(),
		inLanguage: "en",
		educationalLevel: DIFFICULTY_LABEL[source.difficulty],
		learningResourceType: "LearningPath",
		isAccessibleForFree: true,
		provider: {
			"@type": "Organization",
			name: PUBLISHER_NAME,
			url: siteUrl,
			logo: {
				"@type": "ImageObject",
				url: joinUrl(siteUrl, PUBLISHER_LOGO_PATH),
			},
		},
		offers: {
			"@type": "Offer",
			price: "0",
			priceCurrency: "USD",
			category: "Educational",
			availability: "https://schema.org/InStock",
		},
		hasCourseInstance: [
			{
				"@type": "CourseInstance",
				name: source.title,
				courseMode: "online",
			},
		],
	};

	// Recording runtime is not a measured workload for the exercises and reading.
	// Keep the visible core-video estimate out of completion-time metadata.

	if (source.technologyLabels.length > 0) {
		jsonLd.teaches = [...source.technologyLabels];
		jsonLd.about = source.technologyLabels.map((label) => ({
			"@type": "Thing",
			name: label,
		}));
	}

	const prerequisites = source.prerequisites ?? [];
	if (prerequisites.length > 0) {
		jsonLd.coursePrerequisites = prerequisites.join("; ");
	}

	if (authors.length > 0) {
		jsonLd.author = authors.map((author) => ({
			"@type": "Person",
			name: author.name,
			url: joinUrl(siteUrl, `/people/${author.id}`),
		}));
	}

	return jsonLd;
}
