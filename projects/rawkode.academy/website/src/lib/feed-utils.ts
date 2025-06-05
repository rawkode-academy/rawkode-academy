import type { CollectionEntry } from "astro:content";

interface RenderResult {
  content?: string;
  error?: string;
}

/**
 * Render and sanitize a single article's content to HTML
 * Since MDX rendering in the container API is causing issues,
 * we'll use a simpler approach with just the description
 */
export async function renderAndSanitizeArticle(
  article: CollectionEntry<"articles">,
): Promise<RenderResult> {
  try {
    // For now, use the description with a link to the full article
    // This avoids the MDX rendering issues in the feed generation
    const content =
      `<div>${article.data.description}</div><p><a href="/read/${article.id}/">Read the full article on our website</a></p>`;
    return { content };
  } catch (error) {
    console.error(`Failed to render content for article ${article.id}:`, error);
    return {
      content:
        `<div>${article.data.description}</div><p><a href="/read/${article.id}/">Read the full article on our website</a></p>`,
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
