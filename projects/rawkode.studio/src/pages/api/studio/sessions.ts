import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import type { StudioEnv } from "../../../env";
import {
	json,
	operationErrorResponse,
	requestHasAllowedOrigin,
} from "../../../server/http";
import {
	createStudioSession,
} from "../../../server/operations";

export const POST: APIRoute = async ({ locals, request }) => {
	if (!locals.user) {
		return json({ error: "Sign in with rawkode.academy identity." }, 401);
	}
	if (!requestHasAllowedOrigin(request)) {
		return json({ error: "Cross-origin Studio mutations are not allowed." }, 403);
	}

	const body = (await request.json().catch(() => null)) as {
		prodConfirmation?: string;
		show?: string;
		showId?: string;
		startsAt?: string;
		streamEnvironment?: string;
		title?: string;
		videoId?: string;
	} | null;
	if (!body?.videoId && (!body?.show || !body.title)) {
		return json({ error: "videoId or show and title are required." }, 400);
	}

	try {
		const result = await createStudioSession(env as StudioEnv, locals.user, {
			prodConfirmation: body.prodConfirmation,
			show: body.show,
			showId: body.showId,
			startsAt: body.startsAt,
			streamEnvironment: body.streamEnvironment === "prod" ? "prod" : "test",
			title: body.title,
			videoId: body.videoId,
		});
		return json({
			meeting: result.meeting,
			provider: result.provider,
			session: result.session,
			status: result.status,
		});
	} catch (error) {
		const response = operationErrorResponse(error);
		if (response) return response;
		throw error;
	}
};
