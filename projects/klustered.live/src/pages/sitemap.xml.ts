import type { APIRoute } from "astro";
import { getEpisodes } from "@/lib/content";

export const prerender = false;

const SITE = "https://klustered.live";

const staticRoutes = [
	"/",
	"/episodes",
	"/schedule",
	"/leaderboard",
	"/about",
	"/rules",
	"/apply",
	"/sponsors",
];

export const GET: APIRoute = async () => {
	const episodes = await getEpisodes();
	const urls: string[] = [];

	for (const route of staticRoutes) {
		urls.push(`<url><loc>${SITE}${route}</loc></url>`);
	}

	for (const e of episodes) {
		const slug = e.data.slug ?? e.id.split("/").pop();
		urls.push(
			`<url><loc>${SITE}/episodes/${slug}</loc><lastmod>${e.data.publishedAt.toISOString()}</lastmod></url>`,
		);
	}

	const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>`;

	return new Response(body, {
		status: 200,
		headers: {
			"content-type": "application/xml; charset=utf-8",
			"cache-control": "public, max-age=3600",
		},
	});
};
