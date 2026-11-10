import type { APIRoute } from "astro";

const DEFAULT_SITE_URL = "https://rawkode.academy";

export const ROBOTS_SITEMAP_PATH = "/sitemap-index.xml";

// /search is deliberately not listed: the page sends noindex, and Google
// only sees a noindex on URLs it is allowed to crawl.
export const ROBOTS_DISALLOWS = [
	"/admin/",
	"/private/",
	"/settings/",
	"/confirm-subscription",
	"/unsubscribe",
	"/_server-islands/",
	"/api/",
	"/internal/",
	"/graphql",
	"/home",
	"/sign-in",
	"/_partytown/",
] as const;

// Public RSS/Atom/JSON feeds live under /api/. Crawlers pick the longest
// matching rule, so these win over the /api/ disallow.
export const ROBOTS_ALLOWS = ["/api/feeds/"] as const;

export const getRobotsTxt = (sitemapIndexURL: URL) => `
# Host directive to specify canonical domain
Host: rawkode.academy

# Allow all crawlers
User-agent: *
Allow: /

# Keep private areas out of search
${ROBOTS_DISALLOWS.map((path) => `Disallow: ${path}`).join("\n")}

# Public feeds
${ROBOTS_ALLOWS.map((path) => `Allow: ${path}`).join("\n")}

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
