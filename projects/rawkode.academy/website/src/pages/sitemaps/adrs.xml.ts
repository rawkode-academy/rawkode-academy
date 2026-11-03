import type { APIRoute } from "astro";
import { setContentCache } from "@/lib/live-content";
import {
	getAdrSitemapEntries,
	renderUrlSet,
	sitemapCollections,
	xmlResponse,
} from "@/lib/sitemaps";

export const prerender = false;

export const GET: APIRoute = async (context) => {
	const entries = await getAdrSitemapEntries();
	await setContentCache(context, {
		collections: sitemapCollections("/sitemaps/adrs.xml"),
	});
	return xmlResponse(renderUrlSet(context.site, entries));
};
