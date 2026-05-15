export interface NewsArticleAuthor {
	name: string;
	url?: string | undefined;
}

export interface NewsArticleSource {
	title: string;
	description: string;
	publishedAt: Date;
	updatedAt?: Date;
	technologies?: ReadonlyArray<string>;
	wordCount?: number;
	readingMinutes?: number;
}

export interface BuildNewsArticleJsonLdInput {
	article: NewsArticleSource;
	authors: ReadonlyArray<NewsArticleAuthor>;
	url: string;
	imageUrl: string;
	siteUrl: string;
}

const PUBLISHER_NAME = "Rawkode Academy";
const PUBLISHER_LOGO_PATH = "/android-chrome-512x512.png";

function joinUrl(base: string, path: string): string {
	return new URL(path, base).href;
}

function formatTechnologyKeyword(technology: string): string {
	return technology
		.split(/[-/]/g)
		.filter(Boolean)
		.map((segment) =>
			segment.length <= 3
				? segment.toUpperCase()
				: `${segment.charAt(0).toUpperCase()}${segment.slice(1)}`,
		)
		.join(" ");
}

export function buildNewsArticleJsonLd(
	input: BuildNewsArticleJsonLdInput,
): Record<string, unknown> {
	const { article, authors, url, imageUrl, siteUrl } = input;
	const datePublished = new Date(article.publishedAt).toISOString();
	const dateModified = new Date(
		article.updatedAt ?? article.publishedAt,
	).toISOString();

	const keywords = (article.technologies ?? [])
		.map(formatTechnologyKeyword)
		.filter((keyword) => keyword.length > 0);

	const jsonLd: Record<string, unknown> = {
		"@context": "https://schema.org",
		"@type": "NewsArticle",
		headline: article.title,
		description: article.description,
		datePublished,
		dateModified,
		mainEntityOfPage: { "@type": "WebPage", "@id": url },
		image: [imageUrl],
		author: authors.map((author) => ({
			"@type": "Person",
			name: author.name,
			...(author.url ? { url: author.url } : {}),
		})),
		publisher: {
			"@type": "Organization",
			name: PUBLISHER_NAME,
			url: siteUrl,
			logo: {
				"@type": "ImageObject",
				url: joinUrl(siteUrl, PUBLISHER_LOGO_PATH),
			},
		},
		articleSection: "News",
	};

	if (keywords.length > 0) {
		jsonLd.keywords = keywords.join(", ");
	}

	if (
		typeof article.wordCount === "number" &&
		Number.isFinite(article.wordCount) &&
		article.wordCount > 0
	) {
		jsonLd.wordCount = Math.floor(article.wordCount);
	}

	if (
		typeof article.readingMinutes === "number" &&
		Number.isFinite(article.readingMinutes) &&
		article.readingMinutes > 0
	) {
		jsonLd.timeRequired = `PT${Math.ceil(article.readingMinutes)}M`;
	}

	return jsonLd;
}
