import type { APIRoute } from "astro";
import { setContentCache } from "@/lib/live-content";
import {
	getPagesSitemapEntries,
	renderUrlSet,
	sitemapCollections,
	xmlResponse,
} from "@/lib/sitemaps";

export const prerender = false;

export const GET: APIRoute = async (context) => {
	const entries = await getPagesSitemapEntries();
	await setContentCache(context, {
		collections: sitemapCollections("/sitemaps/pages.xml"),
	});
	return xmlResponse(renderUrlSet(context.site, entries));
};
