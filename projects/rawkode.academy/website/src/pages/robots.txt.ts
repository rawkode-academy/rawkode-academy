import type { APIRoute } from "astro";

const getRobotsTxt = (sitemapURL: URL, videoSitemapURL: URL) => `
# Host directive to specify canonical domain
Host: rawkode.academy

# Allow all crawlers
User-agent: *
Allow: /

# Except for
Disallow: /api/
Disallow: /admin/
Disallow: /private/
Disallow: /_server-islands/

# Sitemap locations
Sitemap: ${sitemapURL.href}
Sitemap: ${videoSitemapURL.href}
`;

export const GET: APIRoute = ({ site }) => {
	const sitemapURL = new URL("sitemap-index.xml", site);
	const videoSitemapURL = new URL("video-sitemap.xml", site);

	return new Response(getRobotsTxt(sitemapURL, videoSitemapURL));
};
