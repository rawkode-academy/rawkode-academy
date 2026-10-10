import {
	getAllCollection,
	listPayloadContent,
} from "@/lib/payload-content";
import type { APIRoute } from "astro";
import { createLogger } from "@/lib/logger";

const logger = createLogger("sitemap");

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
		href: "https://github.com/rawkode-academy/rawkode-academy",
		category: "External",
		description: "Visit our GitHub",
	},
	{
		id: "github-issues",
		title: "Report Issue",
		href: "https://github.com/rawkode-academy/rawkode-academy/issues",
		category: "External",
		description: "Report a bug or request a feature",
	},
];

async function generateNavigationItems(
	includeArticles = false,
): Promise<NavigationItem[]> {
	const navigationItems: NavigationItem[] = [];

	// Add static pages
	const staticPages = [
		{
			href: "/",
			title: "Home",
			category: "Pages",
			description: "Rawkode Academy Homepage",
		},
		{
			href: "/about",
			title: "About",
			category: "About",
			description: "About Rawkode Academy",
		},
		{
			href: "/watch",
			title: "All Videos",
			category: "Videos",
			description: "Browse all videos",
		},
		{
			href: "/shows",
			title: "All Shows",
			category: "Shows",
			description: "Discover Rawkode Academy shows",
		},
		{
			href: "/read",
			title: "All Articles",
			category: "Articles",
			description: "Browse all articles",
		},
		{
			href: "/series",
			title: "All Series",
			category: "Series",
			description: "Browse article series",
		},
		{
			href: "/technology",
			title: "All Technologies",
			category: "Technology",
			description: "Browse technologies",
		},
		{
			href: "/courses",
			title: "Courses",
			category: "Learning",
			description: "Browse available courses",
		},
		{
			href: "/changelog",
			title: "Changelog",
			category: "Updates",
			description: "Recent updates and changes",
		},
		{
			href: "/search",
			title: "Search",
			category: "Tools",
			description: "Search the site",
		},
		{
			href: "/feeds",
			title: "RSS Feeds",
			category: "Tools",
			description: "Subscribe to RSS feeds",
		},
		{
			href: "/organizations",
			title: "For Organizations",
			category: "Organizations",
			description:
				"Partnerships for cloud-native and DevTool teams reviewing technical buyer proof, docs, demos, launches, and sales enablement",
			keywords: [
				"partnerships",
				"fit check",
				"practitioner proof",
				"platform engineering",
				"SRE",
				"marketing",
				"product",
				"DevRel",
				"docs",
				"demo",
				"launch",
			],
		},
		{
			href: "/organizations/lets-chat",
			title: "Partner application",
			category: "Organizations",
			description:
				"Apply for the Rawkode Academy partner programme or a Fit & Proof Review",
			keywords: [
				"fit check",
				"adoption",
				"technical evaluator",
				"platform engineering",
				"marketing",
				"product",
				"DevRel",
				"docs",
				"demo",
				"launch",
			],
		},
		{
			href: "/organizations/branding",
			title: "Branding",
			category: "Organizations",
			description: "Branding and logo usage guidelines",
		},
		{
			href: "/organizations/partnerships",
			title: "Partnerships",
			category: "Organizations",
			description:
				"Partnerships for cloud-native and DevTool teams with evaluation risk in docs, demos, launches, technical proof, and sales enablement",
			keywords: [
				"partnerships",
				"practitioner proof",
				"technical evaluator",
				"platform engineering",
				"SRE",
				"Kubernetes",
				"AI infrastructure",
				"marketing",
				"product",
				"DevRel",
				"docs",
				"demo",
				"launch",
			],
		},
		{
			href: "/maintainers/share-your-project",
			title: "Share Your Project",
			category: "Community",
			description: "Share your open source project",
		},
	];

	staticPages.forEach((page) => {
		navigationItems.push({
			id: page.href,
			title: page.title,
			description: page.description,
			href: page.href,
			category: page.category,
			keywords: page.keywords ?? [
				page.title.toLowerCase(),
				page.category.toLowerCase(),
			],
		});
	});

	try {
		const [publishedArticles, series, courses, shows, technologies, videos] =
			await Promise.all([
				getAllCollection("articles"),
				getAllCollection("series"),
				getAllCollection("courses"),
				getAllCollection("shows"),
				getAllCollection("technologies"),
				listPayloadContent("videos", { limit: 50 }),
			]);

		// Add articles only if requested
		if (includeArticles) {
			publishedArticles.forEach((article) => {
				navigationItems.push({
					id: `/read/${article.slug}`,
					title: article.data.title,
					description: article.data.description || "Read this article",
					href: `/read/${article.slug}`,
					category: "Articles",
					keywords: [article.data.title.toLowerCase(), "article", "read"],
				});
			});
		}

		// Add series
		const publishedSeriesIds = new Set(
			publishedArticles
				.map((article) => article.data.series?.id)
				.filter((id): id is string => Boolean(id)),
		);
		series.filter((s) => publishedSeriesIds.has(s.id)).forEach((s) => {
			navigationItems.push({
				id: `/series/${s.slug}`,
				title: s.data.title,
				description: "Read this series",
				href: `/series/${s.slug}`,
				category: "Series",
				keywords: [s.data.title.toLowerCase(), "series", "read", "articles"],
			});
		});

		// Add courses
		courses.forEach((course) => {
			navigationItems.push({
				id: `/courses/${course.slug}`,
				title: course.data.title,
				description: course.data.description || "Learn this course",
				href: `/courses/${course.slug}`,
				category: "Learning",
				keywords: [course.data.title.toLowerCase(), "course", "learn"],
			});
		});

		// Add shows
		shows.forEach((show) => {
			navigationItems.push({
				id: `/shows/${show.slug}`,
				title: show.data.name,
				description: "Browse episodes from this show",
				href: `/shows/${show.slug}`,
				category: "Shows",
				keywords: [show.data.name.toLowerCase(), "show", "shows"],
			});
		});

		// Add technologies
		technologies.forEach((tech) => {
			navigationItems.push({
				id: `/technology/${tech.slug}`,
				title: tech.data.name,
				description: "Explore this technology",
				href: `/technology/${tech.slug}`,
				category: "Technology",
				keywords: [tech.data.name.toLowerCase(), "technology", "tech"],
			});
		});

		// Add videos
		videos.forEach((video) => {
			navigationItems.push({
				id: `/watch/${video.slug}`,
				title: video.data.title,
				description: video.data.description || "Watch this video",
				href: `/watch/${video.slug}`,
				category: "Videos",
				keywords: [video.data.title.toLowerCase(), "video", "watch"],
			});
		});
	} catch (error) {
		logger.error("Error loading collections or technologies", error);
	}

	return navigationItems;
}

// Prerender this endpoint at build time
export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
	try {
		// Check if we should include articles (for dynamic fetching)
		const includeArticles = url.searchParams.get("includeArticles") === "true";
		const navigationItems = await generateNavigationItems(includeArticles);

		// Add external navigation items
		const allItems = [...navigationItems, ...externalNavigationItems].sort(
			(a, b) => {
				// Sort by category first, then by title
				if (a.category !== b.category) {
					return a.category.localeCompare(b.category);
				}
				return a.title.localeCompare(b.title);
			},
		);

		return new Response(JSON.stringify(allItems), {
			status: 200,
			headers: {
				"Content-Type": "application/json",
				"Cache-Control": "public, max-age=3600", // Cache for 1 hour
			},
		});
	} catch (error) {
		logger.error("Error generating navigation items", error);

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
