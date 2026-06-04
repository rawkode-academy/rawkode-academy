import type { APIRoute } from "astro";
import { createLiveEvent } from "@/core/event-factory";
import { errorResponse, jsonResponse, readJsonBody } from "@/core/http";
import { liveStoreFromRequest, requireOperator } from "@/core/server";
import type { CreateLiveEventInput } from "@/core/types";

export const GET: APIRoute = async () => {
	const store = liveStoreFromRequest();
	const events = await store.list();
	return jsonResponse(events);
};

export const POST: APIRoute = async (context) => {
	const authError = requireOperator(context);
	if (authError) return authError;

	try {
		const body = await readJsonBody<CreateLiveEventInput>(context.request);
		const event = createLiveEvent(body);
		await liveStoreFromRequest().put(event);
		return jsonResponse(event, { status: 201 });
	} catch (error) {
		return errorResponse(error instanceof Error ? error.message : "Unable to create live event");
	}
};
