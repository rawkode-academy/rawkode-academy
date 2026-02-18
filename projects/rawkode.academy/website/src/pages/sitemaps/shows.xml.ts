import type { APIRoute } from "astro";
import {
	getShowSitemapEntries,
	renderUrlSet,
	xmlResponse,
} from "@/lib/sitemaps";

export const GET: APIRoute = async ({ site }) => {
	const entries = await getShowSitemapEntries();
	return xmlResponse(renderUrlSet(site, entries));
};

export const prerender = true;
