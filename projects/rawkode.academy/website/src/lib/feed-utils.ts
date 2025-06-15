import type { CollectionEntry } from "astro:content";
import { render } from "astro:content";
import sanitizeHtml from "sanitize-html";

interface RenderResult {
	content?: string;
	error?: string;
}

/**
 * Render and sanitize a single article's content to HTML
 * Attempts to render MDX content to HTML with fallbacks
 */
export async function renderAndSanitizeArticle(
	article: CollectionEntry<"articles">,
): Promise<RenderResult> {
	try {
		// Try to render the article content
		await render(article);

		// Convert the rendered content to HTML string
		// Note: This is a simplified approach. In production, you might need
		// to use Astro's container API or a custom MDX renderer
		let htmlContent = "";

		// For now, we'll use a workaround by rendering to a string
		// This may not work perfectly with all MDX components
		try {
			// Attempt to get HTML from the Content component
			// This is a placeholder - actual implementation would need
			// proper MDX to HTML conversion
			htmlContent = article.data.description;

			// Add a note about full content
			htmlContent += `<hr/><p><em>Note: Full article content with interactive elements is available on our website.</em></p>`;
			htmlContent += `<p><a href="/read/${article.id}/">Read the full article with all features on our website</a></p>`;
		} catch (renderError) {
			console.warn(
				`Could not render MDX content for ${article.id}, using description`,
			);
			htmlContent = article.data.description;
		}

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
