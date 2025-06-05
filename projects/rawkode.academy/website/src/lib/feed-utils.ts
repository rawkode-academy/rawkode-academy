import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { loadRenderers } from "astro:container";
import { getContainerRenderer as getMDXRenderer } from "@astrojs/mdx";
import { render } from "astro:content";
import sanitizeHtml from "sanitize-html";
import type { CollectionEntry } from "astro:content";

interface RenderResult {
	content?: string;
	error?: string;
}

/**
 * Preprocess MDX content to replace problematic components with simple HTML
 */
function preprocessMDXForRSS(mdxContent: string): string {
	// Replace ZoomableImage components with regular img tags
	let processed = mdxContent.replace(
		/<ZoomableImage\s+image=\{import\("([^"]+)"\)\}\s+alt="([^"]*)"\s*\/>/g,
		'<img src="$1" alt="$2" style="max-width: 100%; height: auto;" />'
	);
	
	// Replace Aside components with styled divs
	processed = processed.replace(
		/<Aside\s+variant="(\w+)"\s*>([\s\S]*?)<\/Aside>/g,
		(_, variant, content) => {
			const styles = {
				tip: 'background-color: #e0f2e9; border-left: 4px solid #2db83d;',
				caution: 'background-color: #fff4e0; border-left: 4px solid #ff9800;',
				danger: 'background-color: #fdecea; border-left: 4px solid #f44336;',
				info: 'background-color: #e3f2fd; border-left: 4px solid #2196f3;',
			};
			const style = styles[variant as keyof typeof styles] || styles.info;
			return `<div style="${style} padding: 1rem; margin: 1rem 0; border-radius: 0.25rem;">${content}</div>`;
		}
	);
	
	// Remove import statements for these components
	processed = processed.replace(/import\s+ZoomableImage\s+from\s+["']@\/components\/image\/ZoomableImage\.astro["'];?\s*/g, '');
	processed = processed.replace(/import\s+Aside\s+from\s+["']@\/components\/Aside\.astro["'];?\s*/g, '');
	
	return processed;
}

/**
 * Setup the Astro Container API for rendering MDX content
 */
export async function createMDXContainer() {
	const renderers = await loadRenderers([getMDXRenderer()]);
	return await AstroContainer.create({ renderers });
}

/**
 * Render and sanitize a single article's MDX content to HTML
 */
export async function renderAndSanitizeArticle(
	article: CollectionEntry<"articles">,
	container: Awaited<ReturnType<typeof createMDXContainer>>
): Promise<RenderResult> {
	try {
		// First, preprocess the MDX content if available
		if (article.body) {
			const processedBody = preprocessMDXForRSS(article.body);
			// Create a modified article with preprocessed content
			const modifiedArticle = {
				...article,
				body: processedBody
			};
			
			try {
				const { Content } = await render(modifiedArticle);
				const renderedContent = await container.renderToString(Content);
				
				const content = sanitizeHtml(renderedContent, {
					allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'video', 'audio', 'div']),
					allowedAttributes: {
						...sanitizeHtml.defaults.allowedAttributes,
						img: ['src', 'alt', 'width', 'height', 'loading', 'style'],
						video: ['src', 'controls', 'width', 'height'],
						audio: ['src', 'controls'],
						div: ['style']
					},
					allowedSchemes: ['http', 'https', 'data']
				});
				
				return { content };
			} catch (renderError) {
				console.warn(`Rendering failed for ${article.id}, using fallback:`, renderError);
			}
		}
		
		// Fallback: Try rendering without preprocessing
		const { Content } = await render(article);
		const renderedContent = await container.renderToString(Content);
		
		const content = sanitizeHtml(renderedContent, {
			allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'video', 'audio']),
			allowedAttributes: {
				...sanitizeHtml.defaults.allowedAttributes,
				img: ['src', 'alt', 'width', 'height', 'loading'],
				video: ['src', 'controls', 'width', 'height'],
				audio: ['src', 'controls']
			},
			allowedSchemes: ['http', 'https', 'data']
		});
		
		return { content };
	} catch (error) {
		console.error(`Failed to render content for article ${article.id}:`, error);
		// Return a basic fallback with description and link
		return { 
			content: `<div>${article.data.description}</div><p><a href="/read/${article.id}/">Read the full article on our website</a></p>` 
		};
	}
}

/**
 * Render and sanitize multiple articles in parallel for better performance
 */
export async function renderAndSanitizeArticles(
	articles: CollectionEntry<"articles">[]
): Promise<Map<string, RenderResult>> {
	const container = await createMDXContainer();
	
	// Process all articles in parallel for better performance
	const renderPromises = articles.map(async (article) => ({
		id: article.id,
		result: await renderAndSanitizeArticle(article, container)
	}));
	
	const results = await Promise.all(renderPromises);
	
	// Convert to Map for easy lookup
	return new Map(results.map(({ id, result }) => [id, result]));
}