import type { APIRoute } from "astro";
import { getCollection } from "astro:content";

interface NavigationItem {
  id: string;
  title: string;
  description?: string;
  href: string;
  category: string;
  keywords?: string[];
}

export const GET: APIRoute = async ({ url }) => {
  try {
    const query = url.searchParams.get('q')?.toLowerCase() || '';
    
    // Only return articles if there's a search query
    if (!query || query.length < 2) {
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      });
    }

    const articles = await getCollection("articles");
    const navigationItems: NavigationItem[] = [];
    
    // Filter articles that match the search query
    articles.forEach((article) => {
      const titleMatch = article.data.title.toLowerCase().includes(query);
      const descriptionMatch = article.data.description?.toLowerCase().includes(query) || false;
      
      if (titleMatch || descriptionMatch) {
        navigationItems.push({
          id: `/read/${article.id}`,
          title: article.data.title,
          description: article.data.description || "Read this article",
          href: `/read/${article.id}`,
          category: "Articles",
          keywords: [article.data.title.toLowerCase(), "article", "read"],
        });
      }
    });

    return new Response(JSON.stringify(navigationItems), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("Error searching articles:", error);

    return new Response(
      JSON.stringify({ error: "Failed to search articles" }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  }
};