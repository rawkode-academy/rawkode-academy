import type { APIRoute } from "astro";
import {
	getPagesSitemapEntries,
	renderUrlSet,
	xmlResponse,
} from "@/lib/sitemaps";

export const GET: APIRoute = async ({ site }) => {
	const entries = await getPagesSitemapEntries();
	return xmlResponse(renderUrlSet(site, entries));
};

export const prerender = true;
