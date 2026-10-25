import type { APIRoute } from "astro";
import { setContentCache } from "@/lib/live-content";
import {
	getTechnologySitemapEntries,
	renderUrlSet,
	sitemapCollections,
	xmlResponse,
} from "@/lib/sitemaps";

export const prerender = false;

export const GET: APIRoute = async (context) => {
	const entries = await getTechnologySitemapEntries();
	await setContentCache(context, {
		collections: sitemapCollections("/sitemaps/technologies.xml"),
	});
	return xmlResponse(renderUrlSet(context.site, entries));
};
