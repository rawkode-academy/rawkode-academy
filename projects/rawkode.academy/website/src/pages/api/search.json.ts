import type { APIRoute } from "astro";
import { createLogger } from "@/lib/logger";
import { getSearchIndex, parseSearchTypes, searchEntries } from "@/lib/search";

const logger = createLogger("search-api");

const MAX_RESULTS = 50;

// Content only changes at deploy time, so responses are safely cacheable.
const RESPONSE_HEADERS = {
	"Content-Type": "application/json",
	"Cache-Control": "public, max-age=300, s-maxage=3600",
};

export const GET: APIRoute = async ({ url }) => {
	try {
		const query = (url.searchParams.get("q") ?? "").trim();
		const types = parseSearchTypes(url.searchParams.get("types"));

		if (query.length < 2) {
			return new Response("[]", { status: 200, headers: RESPONSE_HEADERS });
		}

		const index = await getSearchIndex();
		const results = searchEntries(index, query, types).slice(0, MAX_RESULTS);

		return new Response(JSON.stringify(results), {
			status: 200,
			headers: RESPONSE_HEADERS,
		});
	} catch (error) {
		logger.error("Error performing unified search", error);

		return new Response(JSON.stringify({ error: "Failed to search" }), {
			status: 500,
			headers: { "Content-Type": "application/json" },
		});
	}
};
