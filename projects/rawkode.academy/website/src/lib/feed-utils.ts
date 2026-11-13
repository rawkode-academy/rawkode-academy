import type { ContentEntry } from "@/lib/live-content";
import sanitizeHtml from "sanitize-html";

interface RenderResult {
	content?: string;
	error?: string;
}

/**
 * Wrap a Response from `@astrojs/rss` so it carries the IANA-registered
 * MIME type for RSS 2.0 (`application/rss+xml`) instead of the generic
 * `application/xml` that the library ships with. Feed readers and crawlers
 * use the registered type for discovery; the generic one weakens that.
 *
 * Use a `Headers` instance for the copy - case-insensitive `.set()` then
 * actually replaces the existing header. Spreading a plain object copy
 * preserves both casings and ends up emitting the Content-Type twice.
 */
export function withRssMimeType(res: Response): Response {
	const headers = new Headers(res.headers);
	headers.set("Content-Type", "application/rss+xml; charset=utf-8");
	return new Response(res.body, {
		status: res.status,
		statusText: res.statusText,
		headers,
	});
}

/**
 * Escape a value for use inside a double-quoted XML attribute.
 */
export const escapeAttribute = (value: string) =>
	value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");

/**
 * XML namespaces the RSS 2.0 feeds use for elements RSS itself lacks:
 * `atom:link rel="self"`, `dc:creator` (RSS `<author>` must be an email
 * address) and `media:thumbnail` (an `<enclosure>` is the item's media and
 * needs a byte length).
 */
export const rssNamespaces = {
	atom: "http://www.w3.org/2005/Atom",
	dc: "http://purl.org/dc/elements/1.1/",
	media: "http://search.yahoo.com/mrss/",
} as const;

/** The channel's `<atom:link rel="self">`, pointing at the feed's own URL. */
export const rssSelfLink = (feedUrl: string) =>
	`<atom:link href="${escapeAttribute(feedUrl)}" rel="self" type="application/rss+xml"/>`;

/** An item's `<dc:creator>`, or nothing when the item has no authors. */
export const rssCreator = (names: string[]) =>
	names.length > 0
		? `<dc:creator>${escapeAttribute(names.join(", "))}</dc:creator>`
		: "";

/** A video item's thumbnail image as `<media:thumbnail>`. */
export const rssThumbnail = (url: string) =>
	`<media:thumbnail url="${escapeAttribute(url)}"/>`;

/**
 * Build the sanitized feed HTML for an article: its description plus a
 * pointer to the full, interactive article on the website. (The feeds never
 * carried the rendered body; interactive elements only work on the site.)
 *
 * The article link is absolute: feed readers render item content away from
 * the site, where a relative link resolves against the reader's own host.
 */
async function renderAndSanitizeArticle(
	article: ContentEntry<"articles">,
	site: string | URL,
): Promise<RenderResult> {
	const articleUrl = new URL(`/read/${article.id}/`, site).href;
	try {
		let htmlContent = article.data.description;
		htmlContent += `<hr/><p><em>Note: Full article content with interactive elements is available on our website.</em></p>`;
		htmlContent += `<p><a href="${articleUrl}">Read the full article with all features on our website</a></p>`;

		// Sanitize the HTML content for RSS
		const sanitizedContent = sanitizeHtml(htmlContent, {
			allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img", "hr"]),
			allowedAttributes: {
				...sanitizeHtml.defaults.allowedAttributes,
				img: ["src", "alt", "width", "height", "loading"],
				a: ["href", "target", "rel"],
			},
			transformTags: {
				a: (tagName, attribs) => {
					return {
						tagName,
						attribs: {
							...attribs,
							target: "_blank",
							rel: "noopener noreferrer",
						},
					};
				},
			},
		});

		return { content: sanitizedContent };
	} catch (error) {
		console.error(`Failed to render content for article ${article.id}:`, error);
		return {
			content: `<div>${article.data.description}</div><p><a href="${articleUrl}">Read the full article on our website</a></p>`,
		};
	}
}

/**
 * Render and sanitize multiple articles in parallel for better performance
 */
export async function renderAndSanitizeArticles(
	articles: ContentEntry<"articles">[],
	site: string | URL,
): Promise<Map<string, RenderResult>> {
	// Process all articles in parallel for better performance
	const renderPromises = articles.map(async (article) => ({
		id: article.id,
		result: await renderAndSanitizeArticle(article, site),
	}));

	const results = await Promise.all(renderPromises);

	// Convert to Map for easy lookup
	return new Map(results.map(({ id, result }) => [id, result]));
}
