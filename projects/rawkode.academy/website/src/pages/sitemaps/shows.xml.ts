import type { APIRoute } from "astro";
import { setContentCache } from "@/lib/live-content";
import {
	getShowSitemapEntries,
	renderUrlSet,
	sitemapCollections,
	xmlResponse,
} from "@/lib/sitemaps";

export const prerender = false;

export const GET: APIRoute = async (context) => {
	const entries = await getShowSitemapEntries();
	await setContentCache(context, {
		collections: sitemapCollections("/sitemaps/shows.xml"),
	});
	return xmlResponse(renderUrlSet(context.site, entries));
};
