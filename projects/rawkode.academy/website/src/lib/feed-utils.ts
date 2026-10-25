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
 * Build the sanitized feed HTML for an article: its description plus a
 * pointer to the full, interactive article on the website. (The feeds never
 * carried the rendered body; interactive elements only work on the site.)
 */
export async function renderAndSanitizeArticle(
	article: ContentEntry<"articles">,
): Promise<RenderResult> {
	try {
		let htmlContent = article.data.description;
		htmlContent += `<hr/><p><em>Note: Full article content with interactive elements is available on our website.</em></p>`;
		htmlContent += `<p><a href="/read/${article.id}/">Read the full article with all features on our website</a></p>`;

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
			content: `<div>${article.data.description}</div><p><a href="/read/${article.id}/">Read the full article on our website</a></p>`,
		};
	}
}

/**
 * Render and sanitize multiple articles in parallel for better performance
 */
export async function renderAndSanitizeArticles(
	articles: ContentEntry<"articles">[],
): Promise<Map<string, RenderResult>> {
	// Process all articles in parallel for better performance
	const renderPromises = articles.map(async (article) => ({
		id: article.id,
		result: await renderAndSanitizeArticle(article),
	}));

	const results = await Promise.all(renderPromises);

	// Convert to Map for easy lookup
	return new Map(results.map(({ id, result }) => [id, result]));
}
