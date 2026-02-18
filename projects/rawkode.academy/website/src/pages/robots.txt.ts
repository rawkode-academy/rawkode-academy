import type { APIRoute } from "astro";

const getRobotsTxt = (sitemapURL: URL, videoSitemapURL: URL) => `
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
Sitemap: ${sitemapURL.href}
Sitemap: ${videoSitemapURL.href}
`;

export const GET: APIRoute = ({ site }) => {
	const sitemapURL = new URL("sitemap-index.xml", site);
	const videoSitemapURL = new URL("video-sitemap.xml", site);

	return new Response(getRobotsTxt(sitemapURL, videoSitemapURL));
};

export const prerender = true;
