import type { APIRoute } from "astro";
import { errorResponse, jsonResponse } from "@/core/http";
import { liveStoreFromRequest } from "@/core/server";

export const GET: APIRoute = async (context) => {
	const id = context.params.id;
	if (!id) return errorResponse("Live event id is required");

	const event = await liveStoreFromRequest().get(id);
	if (!event) return errorResponse("Live event not found", 404);

	return jsonResponse(event);
};
