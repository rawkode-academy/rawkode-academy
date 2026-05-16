export interface ArticleListEntry {
	id: string;
	data: {
		title: string;
		description: string;
		publishedAt: Date;
		updatedAt?: Date | undefined;
	};
}

export interface BuildArticleItemListJsonLdInput {
	siteUrl: string;
	listUrl: string;
	listName: string;
	articles: ReadonlyArray<ArticleListEntry>;
	limit?: number;
}

const DEFAULT_LIMIT = 20;
const PUBLISHER_NAME = "Rawkode Academy";

function joinUrl(base: string, path: string): string {
	return new URL(path, base).href;
}

/**
 * Build a schema.org ItemList JSON-LD payload for the articles index page.
 *
 * Each ListItem embeds an Article item - Google's preferred shape for the
 * Article rich result carousel on list-type pages.
 * See https://developers.google.com/search/docs/appearance/structured-data/carousel.
 */
export function buildArticleItemListJsonLd(
	input: BuildArticleItemListJsonLdInput,
): Record<string, unknown> {
	const { siteUrl, listUrl, listName, articles, limit = DEFAULT_LIMIT } = input;

	const ordered = [...articles]
		.sort((a, b) => b.data.publishedAt.getTime() - a.data.publishedAt.getTime())
		.slice(0, Math.max(0, limit));

	const itemListElement = ordered.map((article, index) => {
		const articleUrl = joinUrl(siteUrl, `/read/${article.id}`);
		const datePublished = new Date(article.data.publishedAt).toISOString();
		const dateModified = new Date(
			article.data.updatedAt ?? article.data.publishedAt,
		).toISOString();
		return {
			"@type": "ListItem",
			position: index + 1,
			url: articleUrl,
			item: {
				"@type": "Article",
				headline: article.data.title,
				description: article.data.description,
				url: articleUrl,
				datePublished,
				dateModified,
				mainEntityOfPage: { "@type": "WebPage", "@id": articleUrl },
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
		name: listName,
		url: listUrl,
		numberOfItems: itemListElement.length,
		itemListOrder: "https://schema.org/ItemListOrderDescending",
		itemListElement,
	};
}
