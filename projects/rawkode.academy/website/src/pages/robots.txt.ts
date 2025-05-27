import type { APIRoute } from "astro";

const getRobotsTxt = (sitemapURL: URL) => `
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

# Crawl delay for all bots
Crawl-delay: 10

# Sitemap location
Sitemap: ${sitemapURL.href}
`;

export const GET: APIRoute = ({ site }) => {
	const sitemapURL = new URL("sitemap-index.xml", site);

	return new Response(getRobotsTxt(sitemapURL));
};
