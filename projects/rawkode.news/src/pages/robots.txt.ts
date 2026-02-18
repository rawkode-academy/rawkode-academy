import type { APIRoute } from "astro";

export const GET: APIRoute = async ({ site, url }) => {
  const baseUrl = site ?? new URL(url.origin);
  const sitemapUrl = new URL("/sitemap.xml", baseUrl).toString();

  const body = [
    "User-agent: *",
    "Allow: /",
    "",
    `Sitemap: ${sitemapUrl}`,
    "",
  ].join("\n");

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
};
