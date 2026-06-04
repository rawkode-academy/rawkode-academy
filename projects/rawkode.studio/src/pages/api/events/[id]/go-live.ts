import type { APIRoute } from "astro";
import { errorResponse, jsonResponse } from "@/core/http";
import { goLive } from "@/core/live-actions";
import { liveStoreFromRequest, requireOperator } from "@/core/server";

export const POST: APIRoute = async (context) => {
	const authError = requireOperator(context);
	if (authError) return authError;

	const id = context.params.id;
	if (!id) return errorResponse("Live event id is required");

	try {
		const store = liveStoreFromRequest();
		const event = await store.get(id);
		if (!event) return errorResponse("Live event not found", 404);

		const updated = goLive(event);
		await store.put(updated);
		return jsonResponse(updated);
	} catch (error) {
		return errorResponse(error instanceof Error ? error.message : "Unable to go live");
	}
};
