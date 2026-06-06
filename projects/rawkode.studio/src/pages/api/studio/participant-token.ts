import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import type { StudioEnv } from "../../../env";
import {
	json,
	operationErrorResponse,
	requestHasAllowedOrigin,
} from "../../../server/http";
import {
	issueStudioParticipantToken,
} from "../../../server/operations";
import type { StudioRole } from "../../../server/studio";

const roles = new Set<StudioRole>(["guest", "host", "producer", "program"]);

export const POST: APIRoute = async ({ locals, request }) => {
	if (!locals.user) {
		return json({ error: "Sign in with rawkode.academy identity." }, 401);
	}
	if (!requestHasAllowedOrigin(request)) {
		return json({ error: "Cross-origin Studio mutations are not allowed." }, 403);
	}

	const body = (await request.json().catch(() => null)) as {
		inviteToken?: string;
		role?: string;
		sessionId?: string;
	} | null;
	if (!body?.sessionId || !body.role || !roles.has(body.role as StudioRole)) {
		return json({ error: "sessionId and a valid role are required." }, 400);
	}

	try {
		const token = await issueStudioParticipantToken(
			env as StudioEnv,
				locals.user,
				{
					inviteToken: body.inviteToken,
					role: body.role as StudioRole,
					sessionId: body.sessionId,
				},
			);
		return json(token);
	} catch (error) {
		const response = operationErrorResponse(error);
		if (response) return response;
		throw error;
	}
};
