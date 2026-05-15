export interface NewsListEntry {
	id: string;
	data: {
		title: string;
		description: string;
		publishedAt: Date;
	};
}

export interface BuildNewsItemListJsonLdInput {
	siteUrl: string;
	listUrl: string;
	stories: ReadonlyArray<NewsListEntry>;
	limit?: number;
}

const DEFAULT_LIMIT = 20;
const PUBLISHER_NAME = "Rawkode Academy";

function joinUrl(base: string, path: string): string {
	return new URL(path, base).href;
}

/**
 * Build a schema.org ItemList JSON-LD payload for the news index page.
 *
 * Each ListItem embeds a NewsArticle item, which is what Google requires for
 * the Carousel rich result (see https://developers.google.com/search/docs/appearance/structured-data/carousel).
 */
export function buildNewsItemListJsonLd(
	input: BuildNewsItemListJsonLdInput,
): Record<string, unknown> {
	const { siteUrl, listUrl, stories, limit = DEFAULT_LIMIT } = input;
	const ordered = [...stories]
		.sort((a, b) => b.data.publishedAt.getTime() - a.data.publishedAt.getTime())
		.slice(0, Math.max(0, limit));

	const itemListElement = ordered.map((story, index) => {
		const storyUrl = joinUrl(siteUrl, `/news/${story.id}`);
		return {
			"@type": "ListItem",
			position: index + 1,
			url: storyUrl,
			item: {
				"@type": "NewsArticle",
				headline: story.data.title,
				description: story.data.description,
				url: storyUrl,
				datePublished: new Date(story.data.publishedAt).toISOString(),
				mainEntityOfPage: { "@type": "WebPage", "@id": storyUrl },
				publisher: {
					"@type": "Organization",
					name: PUBLISHER_NAME,
					url: siteUrl,
				},
			},
		};
	});

	return {
		"@context": "https://schema.org",
		"@type": "ItemList",
		name: "Cloud Native News",
		url: listUrl,
		numberOfItems: itemListElement.length,
		itemListOrder: "https://schema.org/ItemListOrderDescending",
		itemListElement,
	};
}
