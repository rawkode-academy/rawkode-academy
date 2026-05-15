import {
	buildLearningPathJsonLd,
	type LearningPathSource,
	type LearningPathAuthor,
} from "@/lib/learning-path-jsonld";

export interface LearningPathListEntry {
	id: string;
	source: LearningPathSource;
	authors: ReadonlyArray<LearningPathAuthor>;
}

export interface BuildLearningPathItemListJsonLdInput {
	siteUrl: string;
	listUrl: string;
	listName: string;
	paths: ReadonlyArray<LearningPathListEntry>;
	limit?: number;
}

const DEFAULT_LIMIT = 20;

function joinUrl(base: string, path: string): string {
	return new URL(path, base).href;
}

/**
 * Build a schema.org ItemList JSON-LD payload for /learning-paths.
 *
 * Each ListItem embeds the full Course payload from
 * buildLearningPathJsonLd so the index inherits all the difficulty,
 * duration, free-offer, and prerequisite metadata that powers the
 * Course rich-result carousel on list-type pages.
 */
export function buildLearningPathItemListJsonLd(
	input: BuildLearningPathItemListJsonLdInput,
): Record<string, unknown> {
	const { siteUrl, listUrl, listName, paths, limit = DEFAULT_LIMIT } = input;
	const ordered = [...paths]
		.sort(
			(a, b) => b.source.publishedAt.getTime() - a.source.publishedAt.getTime(),
		)
		.slice(0, Math.max(0, limit));

	const itemListElement = ordered.map((entry, index) => {
		const pathUrl = joinUrl(siteUrl, `/learning-paths/${entry.id}`);
		const item = buildLearningPathJsonLd({
			siteUrl,
			pathUrl,
			source: entry.source,
			authors: entry.authors,
		});
		// schema.org/ListItem.item expects the embedded payload to omit @context
		// (the @context belongs to the top-level document).
		const { "@context": _context, ...itemWithoutContext } = item;
		return {
			"@type": "ListItem",
			position: index + 1,
			url: pathUrl,
			item: itemWithoutContext,
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
