export interface CourseListEntry {
	id: string;
	data: {
		title: string;
		description: string;
		publishedAt: Date;
		updatedAt?: Date | undefined;
		difficulty: "beginner" | "intermediate" | "advanced";
	};
}

export interface BuildCourseItemListJsonLdInput {
	siteUrl: string;
	listUrl: string;
	listName: string;
	courses: ReadonlyArray<CourseListEntry>;
	limit?: number;
}

const DEFAULT_LIMIT = 20;
const PUBLISHER_NAME = "Rawkode Academy";

function joinUrl(base: string, path: string): string {
	return new URL(path, base).href;
}

const difficultyEducationalLevel: Record<
	CourseListEntry["data"]["difficulty"],
	string
> = {
	beginner: "Beginner",
	intermediate: "Intermediate",
	advanced: "Advanced",
};

/**
 * Build a schema.org ItemList JSON-LD payload for the courses index page.
 *
 * Each ListItem embeds a Course item - Google's documented shape for the
 * Course rich result on list-type pages.
 * See https://developers.google.com/search/docs/appearance/structured-data/course
 */
export function buildCourseItemListJsonLd(
	input: BuildCourseItemListJsonLdInput,
): Record<string, unknown> {
	const { siteUrl, listUrl, listName, courses, limit = DEFAULT_LIMIT } = input;

	const ordered = [...courses]
		.sort((a, b) => b.data.publishedAt.getTime() - a.data.publishedAt.getTime())
		.slice(0, Math.max(0, limit));

	const provider = {
		"@type": "Organization",
		name: PUBLISHER_NAME,
		url: siteUrl,
		sameAs: siteUrl,
	};

	const itemListElement = ordered.map((course, index) => {
		const courseUrl = joinUrl(siteUrl, `/courses/${course.id}`);
		return {
			"@type": "ListItem",
			position: index + 1,
			url: courseUrl,
			item: {
				"@type": "Course",
				name: course.data.title,
				description: course.data.description,
				url: courseUrl,
				provider,
				educationalLevel:
					difficultyEducationalLevel[course.data.difficulty] ?? undefined,
			},
		};
	});

	return {
		"@context": "https://schema.org",
		"@type": "ItemList",
		name: listName,
		url: listUrl,
		numberOfItems: itemListElement.length,
		itemListOrder: "https://schema.org/ItemListOrderDescending",
		itemListElement,
	};
}
