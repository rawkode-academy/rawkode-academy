import type { APIRoute } from "astro";
import {
	getTechnologySitemapEntries,
	renderUrlSet,
	xmlResponse,
} from "@/lib/sitemaps";

export const GET: APIRoute = async ({ site }) => {
	const entries = await getTechnologySitemapEntries();
	return xmlResponse(renderUrlSet(site, entries));
};

export const prerender = true;
