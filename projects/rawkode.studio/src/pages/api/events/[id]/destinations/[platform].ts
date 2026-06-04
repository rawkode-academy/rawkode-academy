import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { errorResponse, jsonResponse, readJsonBody } from "@/core/http";
import { configureDestination } from "@/core/live-actions";
import { liveStoreFromRequest, requireOperator, streamClientFromRequest } from "@/core/server";
import { isDestinationPlatform } from "@/core/types";

export const PUT: APIRoute = async (context) => {
	const authError = requireOperator(context);
	if (authError) return authError;

	const id = context.params.id;
	const platform = context.params.platform;
	if (!id) return errorResponse("Live event id is required");
	if (!platform || !isDestinationPlatform(platform)) return errorResponse("Unknown destination platform", 404);

	try {
		const body = await readJsonBody<{ enabled: boolean }>(context.request);
		const store = liveStoreFromRequest();
		const event = await store.get(id);
		if (!event) return errorResponse("Live event not found", 404);

		const updated = await configureDestination(
			event,
			platform,
			Boolean(body.enabled),
			env,
			streamClientFromRequest(),
		);
		await store.put(updated);
		return jsonResponse(updated);
	} catch (error) {
		return errorResponse(error instanceof Error ? error.message : "Unable to update destination");
	}
};
