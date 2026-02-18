import type { APIRoute } from "astro";
import {
	getPeopleSitemapEntries,
	renderUrlSet,
	xmlResponse,
} from "@/lib/sitemaps";

export const GET: APIRoute = async ({ site }) => {
	const entries = await getPeopleSitemapEntries();
	return xmlResponse(renderUrlSet(site, entries));
};

export const prerender = true;
