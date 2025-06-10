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

// External links that aren't in the sitemap
const externalNavigationItems: NavigationItem[] = [
  {
    id: "github",
    title: "GitHub",
    href: "https://github.com/RawkodeAcademy/RawkodeAcademy",
    category: "External",
    description: "Visit our GitHub",
  },
  {
    id: "github-issues",
    title: "Report Issue",
    href: "https://github.com/RawkodeAcademy/RawkodeAcademy/issues",
    category: "External",
    description: "Report a bug or request a feature",
  },
];

async function generateNavigationItems(): Promise<NavigationItem[]> {
  const navigationItems: NavigationItem[] = [];

  // Add static pages
  const staticPages = [
    { href: "/", title: "Home", category: "Pages", description: "Rawkode Academy Homepage" },
    { href: "/about", title: "About", category: "About", description: "About Rawkode Academy" },
    { href: "/watch", title: "All Videos", category: "Videos", description: "Browse all videos" },
    { href: "/read", title: "All Articles", category: "Articles", description: "Browse all articles" },
    { href: "/series", title: "All Series", category: "Series", description: "Browse video series" },
    { href: "/technology", title: "All Technologies", category: "Technology", description: "Browse technologies" },
    { href: "/courses", title: "Courses", category: "Learning", description: "Browse available courses" },
    { href: "/changelog", title: "Changelog", category: "Updates", description: "Recent updates and changes" },
    { href: "/community-day", title: "Community Day", category: "Community", description: "Community events and meetups" },
    { href: "/search", title: "Search", category: "Tools", description: "Search the site" },
    { href: "/feeds", title: "RSS Feeds", category: "Tools", description: "Subscribe to RSS feeds" },
    { href: "/organizations/consulting", title: "Consulting", category: "Organizations", description: "Consulting services" },
    { href: "/organizations/training", title: "Training", category: "Organizations", description: "Training services" },
    { href: "/organizations/partnerships", title: "Partnerships", category: "Organizations", description: "Partner with us" },
    { href: "/maintainers/share-your-project", title: "Share Your Project", category: "Community", description: "Share your open source project" },
  ];

  staticPages.forEach((page) => {
    navigationItems.push({
      id: page.href,
      title: page.title,
      description: page.description,
      href: page.href,
      category: page.category,
      keywords: [page.title.toLowerCase(), page.category.toLowerCase()],
    });
  });

  try {
    // Add articles
    const articles = await getCollection("articles");
    articles.forEach((article) => {
      navigationItems.push({
        id: `/read/${article.id}`,
        title: article.data.title,
        description: article.data.description || "Read this article",
        href: `/read/${article.id}`,
        category: "Articles",
        keywords: [article.data.title.toLowerCase(), "article", "read"],
      });
    });

    // Add series
    const series = await getCollection("series");
    series.forEach((s) => {
      navigationItems.push({
        id: `/series/${s.id}`,
        title: s.data.title,
        description: "Watch this series",
        href: `/series/${s.id}`,
        category: "Series",
        keywords: [s.data.title.toLowerCase(), "series", "watch"],
      });
    });

    // Add courses
    const courses = await getCollection("courses");
    courses.forEach((course) => {
      navigationItems.push({
        id: `/courses/${course.id}`,
        title: course.data.title,
        description: course.data.description || "Learn this course",
        href: `/courses/${course.id}`,
        category: "Learning",
        keywords: [course.data.title.toLowerCase(), "course", "learn"],
      });
    });
  } catch (error) {
    console.error("Error loading collections:", error);
  }

  return navigationItems;
}

// Prerender this endpoint at build time
export const prerender = true;

export const GET: APIRoute = async () => {
  try {
    const navigationItems = await generateNavigationItems();
    
    // Add external navigation items
    const allItems = [...navigationItems, ...externalNavigationItems]
      .sort((a, b) => {
        // Sort by category first, then by title
        if (a.category !== b.category) {
          return a.category.localeCompare(b.category);
        }
        return a.title.localeCompare(b.title);
      });

    return new Response(JSON.stringify(allItems), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=3600", // Cache for 1 hour
      },
    });
  } catch (error) {
    console.error("Error generating navigation items:", error);

    return new Response(
      JSON.stringify({ error: "Failed to generate navigation items" }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  }
};
