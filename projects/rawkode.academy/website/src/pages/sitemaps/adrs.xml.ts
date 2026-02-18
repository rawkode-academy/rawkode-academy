import type { APIRoute } from "astro";
import {
	getAdrSitemapEntries,
	renderUrlSet,
	xmlResponse,
} from "@/lib/sitemaps";

export const GET: APIRoute = async ({ site }) => {
	const entries = await getAdrSitemapEntries();
	return xmlResponse(renderUrlSet(site, entries));
};

export const prerender = true;
