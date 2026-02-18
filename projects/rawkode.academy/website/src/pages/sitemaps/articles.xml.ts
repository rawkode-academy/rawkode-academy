import type { APIRoute } from "astro";
import {
	getArticleSitemapEntries,
	renderUrlSet,
	xmlResponse,
} from "@/lib/sitemaps";

export const GET: APIRoute = async ({ site }) => {
	const entries = await getArticleSitemapEntries();
	return xmlResponse(renderUrlSet(site, entries));
};

export const prerender = true;
