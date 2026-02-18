import type { APIRoute } from "astro";
import {
	getLearningPathSitemapEntries,
	renderUrlSet,
	xmlResponse,
} from "@/lib/sitemaps";

export const GET: APIRoute = async ({ site }) => {
	const entries = await getLearningPathSitemapEntries();
	return xmlResponse(renderUrlSet(site, entries));
};

export const prerender = true;
