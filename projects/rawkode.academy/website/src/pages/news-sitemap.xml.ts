import { getCollection } from "astro:content";
import type { APIRoute } from "astro";
import { selectFreshNewsItems, toAbsoluteUrl } from "@/lib/sitemaps";

const DEFAULT_SITE_URL = "https://rawkode.academy";
const PUBLICATION_NAME = "Rawkode Academy";
const PUBLICATION_LANGUAGE = "en";

function escapeXml(value: unknown): string {
	const unsafe =
		typeof value === "string" ? value : value == null ? "" : String(value);
	return unsafe.replace(/[<>&'"]/g, (c) => {
		switch (c) {
			case "<":
				return "&lt;";
			case ">":
				return "&gt;";
			case "&":
				return "&amp;";
			case "'":
				return "&apos;";
			case '"':
				return "&quot;";
			default:
				return c;
		}
	});
}

export function renderGoogleNewsSitemap(
	site: URL | string | undefined,
	items: ReadonlyArray<{
		id: string;
		data: { title: string; publishedAt: Date };
	}>,
): string {
	const siteUrl = site ?? new URL(DEFAULT_SITE_URL);
	const body = items
		.map((item) => {
			const url = toAbsoluteUrl(siteUrl, `/news/${item.id}`);
			const publishedDate = new Date(item.data.publishedAt).toISOString();
			return `  <url>
    <loc>${escapeXml(url)}</loc>
    <news:news>
      <news:publication>
        <news:name>${escapeXml(PUBLICATION_NAME)}</news:name>
        <news:language>${PUBLICATION_LANGUAGE}</news:language>
      </news:publication>
      <news:publication_date>${publishedDate}</news:publication_date>
      <news:title>${escapeXml(item.data.title)}</news:title>
    </news:news>
  </url>`;
		})
		.join("\n");

	return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${body}
</urlset>`;
}

export const GET: APIRoute = async ({ site }) => {
	const allNews = await getCollection("news");
	const fresh = selectFreshNewsItems(allNews);
	const xml = renderGoogleNewsSitemap(site, fresh);

	return new Response(xml, {
		headers: {
			"Content-Type": "application/xml; charset=utf-8",
			// News-eligible window is 48h; revalidate aggressively so newly
			// published items appear in Top Stories without waiting on the
			// default 1h sitemap TTL.
			"Cache-Control": "public, max-age=900",
		},
	});
};

export const prerender = true;
