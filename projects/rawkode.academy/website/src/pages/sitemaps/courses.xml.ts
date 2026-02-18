import type { APIRoute } from "astro";
import {
	getCourseSitemapEntries,
	renderUrlSet,
	xmlResponse,
} from "@/lib/sitemaps";

export const GET: APIRoute = async ({ site }) => {
	const entries = await getCourseSitemapEntries();
	return xmlResponse(renderUrlSet(site, entries));
};

export const prerender = true;
