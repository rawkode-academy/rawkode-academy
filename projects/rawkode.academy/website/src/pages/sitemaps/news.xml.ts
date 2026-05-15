import type { APIRoute } from "astro";
import {
	getNewsSitemapEntries,
	renderUrlSet,
	xmlResponse,
} from "@/lib/sitemaps";

export const GET: APIRoute = async ({ site }) => {
	const entries = await getNewsSitemapEntries();
	return xmlResponse(renderUrlSet(site, entries));
};

export const prerender = true;
