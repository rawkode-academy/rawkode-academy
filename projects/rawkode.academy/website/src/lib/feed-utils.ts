import type { CollectionEntry } from "@/lib/payload-content";
import { Marked } from "marked";
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
 * Render and sanitize a single article's content to HTML
 * Attempts to render MDX content to HTML with fallbacks
 */
export async function renderAndSanitizeArticle(
	article: CollectionEntry<"articles">,
): Promise<RenderResult> {
	try {
		// Collection feeds use summary projections, so render their CMS-owned
		// description as Markdown instead of evaluating MDX imports.
		const marked = new Marked({ breaks: true, gfm: true });
		const htmlContent =
			(await marked.parse(article.data.description ?? "")) +
			'<hr/><p><em>Interactive components are available on the website.</em></p>' +
			'<p><a href="/read/' + article.slug + '/">Read the full article on Rawkode Academy</a></p>';

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
			content: '<p>' + sanitizeHtml(article.data.description ?? "") + '</p><p><a href="/read/' + article.slug + '/">Read the full article on Rawkode Academy</a></p>',
		};
	}
}

/**
 * Render and sanitize multiple articles in parallel for better performance
 */
export async function renderAndSanitizeArticles(
	articles: CollectionEntry<"articles">[],
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
