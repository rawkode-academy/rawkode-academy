import type { APIRoute } from "astro";
import { createLiveEvent } from "@/core/event-factory";
import { jsonResponse } from "@/core/http";
import { liveStoreFromRequest } from "@/core/server";

export const GET: APIRoute = async () => {
	const store = liveStoreFromRequest();
	let event = await store.getCurrent();

	if (!event) {
		event = createLiveEvent({
			title: "Rawkode Live",
			slug: "rawkode-live",
			showId: "rawkode-live",
			scheduledStart: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
		});
		await store.put(event);
	}

	return jsonResponse(event);
};
