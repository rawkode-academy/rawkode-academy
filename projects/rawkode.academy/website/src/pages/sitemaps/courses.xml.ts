import type { APIRoute } from "astro";
import { setContentCache } from "@/lib/live-content";
import {
	getCourseSitemapEntries,
	renderUrlSet,
	sitemapCollections,
	xmlResponse,
} from "@/lib/sitemaps";

export const prerender = false;

export const GET: APIRoute = async (context) => {
	const entries = await getCourseSitemapEntries();
	await setContentCache(context, {
		collections: sitemapCollections("/sitemaps/courses.xml"),
	});
	return xmlResponse(renderUrlSet(context.site, entries));
};
