import type { APIRoute } from "astro";
import { setContentCache } from "@/lib/live-content";
import {
	getLearningPathSitemapEntries,
	renderUrlSet,
	sitemapCollections,
	xmlResponse,
} from "@/lib/sitemaps";

export const prerender = false;

export const GET: APIRoute = async (context) => {
	const entries = await getLearningPathSitemapEntries();
	await setContentCache(context, {
		collections: sitemapCollections("/sitemaps/learning-paths.xml"),
	});
	return xmlResponse(renderUrlSet(context.site, entries));
};
