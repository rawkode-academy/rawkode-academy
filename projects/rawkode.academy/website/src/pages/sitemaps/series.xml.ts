import type { APIRoute } from "astro";
import {
	getSeriesSitemapEntries,
	renderUrlSet,
	xmlResponse,
} from "@/lib/sitemaps";

export const GET: APIRoute = async ({ site }) => {
	const entries = await getSeriesSitemapEntries();
	return xmlResponse(renderUrlSet(site, entries));
};

export const prerender = true;
