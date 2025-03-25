import type { APIRoute } from "astro";

const getRobotsTxt = (sitemapURL: URL) => `
# Allow all crawlers
User-agent: *
Allow: /
Disallow: /api/
Disallow: /admin/
Disallow: /private/

# Crawl delay for all bots
Crawl-delay: 10

# Sitemap location
Sitemap: ${sitemapURL.href}

# Host directive to specify canonical domain
Host: rawkode.academy
`;

export const GET: APIRoute = ({ site }) => {
  const sitemapURL = new URL("sitemap-index.xml", site);
  return new Response(getRobotsTxt(sitemapURL));
};
