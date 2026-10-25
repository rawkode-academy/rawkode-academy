import type { APIRoute } from "astro";
import { setContentCache } from "@/lib/live-content";
import {
	getSitemapIndexEntries,
	renderSitemapIndex,
	SITEMAP_INDEX_COLLECTIONS,
	xmlResponse,
} from "@/lib/sitemaps";

export const prerender = false;

export const GET: APIRoute = async (context) => {
	const entries = await getSitemapIndexEntries();
	await setContentCache(context, { collections: SITEMAP_INDEX_COLLECTIONS });
	return xmlResponse(renderSitemapIndex(context.site, entries));
};
