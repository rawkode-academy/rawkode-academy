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
	getStudioTakeoverRecovery,
	heartbeatStudioStream,
	startStudioStream,
	stopStudioStream,
	takeOverStudioStream,
} from "../../../server/operations";

export const GET: APIRoute = async ({ locals, url }) => {
	const noStore = (response: Response) => {
		response.headers.set("Cache-Control", "no-store");
		return response;
	};
	if (!locals.user) return noStore(json({ error: "Sign in with rawkode.academy identity." }, 401));
	const sessionId = url.searchParams.get("sessionId") ?? "";
	const expectedTakeoverLease = url.searchParams.get("expectedTakeoverLease") ?? undefined;
	if (!sessionId || url.searchParams.get("action") !== "takeover-status") {
		return noStore(json({ error: "sessionId and takeover-status action are required." }, 400));
	}
	try {
		return noStore(json(await getStudioTakeoverRecovery(env as StudioEnv, locals.user, { sessionId, expectedTakeoverLease })));
	} catch (error) {
		const response = operationErrorResponse(error);
		if (response) return noStore(response);
		throw error;
	}
};

export const POST: APIRoute = async ({ locals, request }) => {
	if (!locals.user) {
		return json({ error: "Sign in with rawkode.academy identity." }, 401);
	}
	if (!requestHasAllowedOrigin(request)) {
		return json({ error: "Cross-origin Studio mutations are not allowed." }, 403);
	}

	const body = (await request.json().catch(() => null)) as {
		action?: string;
		expectedTakeoverLease?: string;
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
		if (body.action === "heartbeat") {
			return json(await heartbeatStudioStream(env as StudioEnv, locals.user, {
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
		if (body.action === "takeover") {
			return json(await takeOverStudioStream(env as StudioEnv, locals.user, {
				expectedTakeoverLease: body.expectedTakeoverLease,
				sessionId: body.sessionId,
			}));
		}
		return json({ error: "action must be start, confirm, heartbeat, stop, or takeover." }, 400);
	} catch (error) {
		const response = operationErrorResponse(error);
		if (response) return response;
		throw error;
	}
};
