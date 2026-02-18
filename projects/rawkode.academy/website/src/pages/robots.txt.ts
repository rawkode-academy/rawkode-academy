import type { APIRoute } from "astro";

const getRobotsTxt = (sitemapIndexURL: URL) => `
# Host directive to specify canonical domain
Host: rawkode.academy

# Allow all crawlers
User-agent: *
Allow: /

# Keep private areas out of search
Disallow: /admin/
Disallow: /private/
Disallow: /settings/
Disallow: /api/auth/
Disallow: /api/comments/
Disallow: /api/watch-position
Disallow: /api/subscriptions/
Disallow: /graphql

# Sitemap locations
Sitemap: ${sitemapIndexURL.href}
`;

export const GET: APIRoute = ({ site }) => {
	const siteUrl = site ?? new URL("https://rawkode.academy");
	const sitemapIndexURL = new URL("sitemap-index.xml", siteUrl);

	return new Response(getRobotsTxt(sitemapIndexURL));
};

export const prerender = true;
