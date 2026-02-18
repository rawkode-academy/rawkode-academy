import type { APIRoute } from "astro";
import {
	getSitemapIndexEntries,
	renderSitemapIndex,
	xmlResponse,
} from "@/lib/sitemaps";

export const GET: APIRoute = async ({ site }) => {
	const entries = await getSitemapIndexEntries();
	return xmlResponse(renderSitemapIndex(site, entries));
};

export const prerender = true;
