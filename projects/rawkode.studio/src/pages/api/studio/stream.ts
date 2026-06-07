import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import type { StudioEnv } from "../../../env";
import {
	json,
	operationErrorResponse,
	requestHasAllowedOrigin,
} from "../../../server/http";
import {
	confirmStudioStream,
	startStudioStream,
	stopStudioStream,
} from "../../../server/operations";

export const POST: APIRoute = async ({ locals, request }) => {
	if (!locals.user) {
		return json({ error: "Sign in with rawkode.academy identity." }, 401);
	}
	if (!requestHasAllowedOrigin(request)) {
		return json({ error: "Cross-origin Studio mutations are not allowed." }, 403);
	}

	const body = (await request.json().catch(() => null)) as {
		action?: string;
		sessionId?: string;
		streamToken?: string;
	} | null;
	if (!body?.sessionId) {
		return json({ error: "sessionId is required." }, 400);
	}

	try {
		if (body.action === "start") {
			return json(await startStudioStream(env as StudioEnv, locals.user, {
				sessionId: body.sessionId,
				streamToken: body.streamToken,
			}));
		}
		if (body.action === "confirm") {
			return json(await confirmStudioStream(env as StudioEnv, locals.user, {
				sessionId: body.sessionId,
				streamToken: body.streamToken,
			}));
		}
		if (body.action === "stop") {
			return json(await stopStudioStream(env as StudioEnv, locals.user, {
				sessionId: body.sessionId,
				streamToken: body.streamToken,
			}));
		}
		return json({ error: "action must be start, confirm, or stop." }, 400);
	} catch (error) {
		const response = operationErrorResponse(error);
		if (response) return response;
		throw error;
	}
};
