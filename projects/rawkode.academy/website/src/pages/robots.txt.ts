import type { APIRoute } from "astro";

const getRobotsTxt = (sitemapIndexURL: URL) => `
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
Sitemap: ${sitemapIndexURL.href}
`;

export const GET: APIRoute = ({ site }) => {
	const siteUrl = site ?? new URL("https://rawkode.academy");
	const sitemapIndexURL = new URL("sitemap-index.xml", siteUrl);

	return new Response(getRobotsTxt(sitemapIndexURL));
};

export const prerender = true;
