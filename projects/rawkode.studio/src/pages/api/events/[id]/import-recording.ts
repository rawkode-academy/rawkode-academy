import type { APIRoute } from "astro";
import { errorResponse, jsonResponse, readJsonBody } from "@/core/http";
import { importRecording } from "@/core/live-actions";
import { liveStoreFromRequest, requireOperator } from "@/core/server";
import type { ImportRecordingInput } from "@/core/types";

export const POST: APIRoute = async (context) => {
	const authError = requireOperator(context);
	if (authError) return authError;

	const id = context.params.id;
	if (!id) return errorResponse("Live event id is required");

	try {
		const body = await readJsonBody<ImportRecordingInput>(context.request);
		const store = liveStoreFromRequest();
		const event = await store.get(id);
		if (!event) return errorResponse("Live event not found", 404);

		const updated = importRecording(event, body);
		await store.put(updated);
		return jsonResponse(updated);
	} catch (error) {
		return errorResponse(error instanceof Error ? error.message : "Unable to import recording");
	}
};
