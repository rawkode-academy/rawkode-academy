import type { APIRoute } from "astro";
import { getPublishedVideos } from "@/lib/content";
import {
	type CollectionName,
	getCollection,
	setContentCache,
} from "@/lib/live-content";
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

const TECHNOLOGY_LIMIT = 100;
const VIDEO_LIMIT = 50;

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
): Promise<{ items: NavigationItem[]; complete: boolean }> {
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
			title: "For teams building developer products",
			category: "Organizations",
			description:
				"Find out where developers give up on your product. Start with a $5,000 product review, then choose a $12,000 90-day partnership or a $40,000 annual partnership only if it's useful.",
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
			description: "Apply for a Rawkode Academy product review or partnership",
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
				"Find out where developers give up on your product. Start with a $5,000 product review, then choose a $12,000 90-day partnership or a $40,000 annual partnership only if it's useful.",
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
		const publishedArticles = await getCollection("articles");

		// Add articles only if requested
		if (includeArticles) {
			publishedArticles.forEach((article) => {
				navigationItems.push({
					id: `/read/${article.id}`,
					title: article.data.title,
					description: article.data.description || "Read this article",
					href: `/read/${article.id}`,
					category: "Articles",
					keywords: [article.data.title.toLowerCase(), "article", "read"],
				});
			});
		}

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

		const [shows, technologies, videos] = await Promise.all([
			getCollection("shows"),
			getCollection("technologies"),
			getPublishedVideos(),
		]);

		// Add shows (every show, ordered by id, as the API's allShows was)
		shows
			.sort((a, b) => a.data.id.localeCompare(b.data.id))
			.forEach((show) => {
				if (!show.data.id || !show.data.name) {
					return;
				}

				navigationItems.push({
					id: `/shows/${show.data.id}`,
					title: show.data.name,
					description: "Browse episodes from this show",
					href: `/shows/${show.data.id}`,
					category: "Shows",
					keywords: [show.data.name.toLowerCase(), "show", "shows"],
				});
			});

		// Add technologies (up to 100 for the command palette, ordered by id)
		technologies
			.sort((a, b) => a.id.localeCompare(b.id))
			.slice(0, TECHNOLOGY_LIMIT)
			.forEach((tech) => {
				navigationItems.push({
					id: `/technology/${tech.id}`,
					title: tech.data.name,
					description: "Explore this technology",
					href: `/technology/${tech.id}`,
					category: "Technology",
					keywords: [tech.data.name.toLowerCase(), "technology", "tech"],
				});
			});

		// Add videos (the 50 most recently published)
		videos.slice(0, VIDEO_LIMIT).forEach((video) => {
			navigationItems.push({
				id: `/watch/${video.data.slug}`,
				title: video.data.title,
				description: video.data.description || "Watch this video",
				href: `/watch/${video.data.slug}`,
				category: "Videos",
				keywords: [video.data.title.toLowerCase(), "video", "watch"],
			});
		});
	} catch (error) {
		logger.error("Error loading collections or technologies", error);
		return { items: navigationItems, complete: false };
	}

	return { items: navigationItems, complete: true };
}

export const GET: APIRoute = async (context) => {
	const { url } = context;
	try {
		// Check if we should include articles (for dynamic fetching)
		const includeArticles = url.searchParams.get("includeArticles") === "true";
		const { items: navigationItems, complete } =
			await generateNavigationItems(includeArticles);

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

		const collections: CollectionName[] = [
			"courses",
			"shows",
			"technologies",
			"videos",
			...(includeArticles ? (["articles"] as const) : []),
		];
		// A partial list (content unavailable) is only cached briefly.
		await setContentCache(context, {
			collections,
			...(complete ? {} : { maxAge: 60, swr: 0 }),
		});

		return new Response(JSON.stringify(allItems), {
			status: 200,
			headers: {
				"Content-Type": "application/json",
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
