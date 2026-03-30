import type { APIRoute } from "astro";

const DEFAULT_SITE_URL = "https://rawkode.academy";

export const ROBOTS_SITEMAP_PATH = "/sitemap-index.xml";

export const ROBOTS_DISALLOWS = [
	"/admin/",
	"/private/",
	"/settings/",
	"/confirm-subscription",
	"/unsubscribe",
	"/_server-islands/",
	"/api/",
	"/graphql",
] as const;

export const getRobotsTxt = (sitemapIndexURL: URL) => `
# Host directive to specify canonical domain
Host: rawkode.academy

# Allow all crawlers
User-agent: *
Allow: /

# Keep private areas out of search
${ROBOTS_DISALLOWS.map((path) => `Disallow: ${path}`).join("\n")}

# Sitemap locations
Sitemap: ${sitemapIndexURL.href}
`;

export const GET: APIRoute = ({ site }) => {
	const siteUrl = site ?? new URL(DEFAULT_SITE_URL);
	const sitemapIndexURL = new URL(ROBOTS_SITEMAP_PATH, siteUrl);

	return new Response(getRobotsTxt(sitemapIndexURL), {
		headers: {
			"Content-Type": "text/plain; charset=utf-8",
			"Cache-Control": "public, max-age=3600",
		},
	});
};

export const prerender = true;
