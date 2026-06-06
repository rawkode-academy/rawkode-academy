import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import type { StudioEnv } from "../../../env";
import {
	json,
	operationErrorResponse,
	requestHasAllowedOrigin,
} from "../../../server/http";
import { createStudioInvite } from "../../../server/operations";

export const POST: APIRoute = async ({ locals, request, url }) => {
	if (!locals.user) {
		return json({ error: "Sign in with rawkode.academy identity." }, 401);
	}
	if (!requestHasAllowedOrigin(request)) {
		return json({ error: "Cross-origin Studio mutations are not allowed." }, 403);
	}

	const body = (await request.json().catch(() => null)) as {
		expiresInHours?: number;
		maxUses?: number;
		sessionId?: string;
	} | null;
	if (!body?.sessionId) {
		return json({ error: "sessionId is required." }, 400);
	}

	try {
		const result = await createStudioInvite(env as StudioEnv, locals.user, {
			expiresInHours: body.expiresInHours,
			maxUses: body.maxUses,
			sessionId: body.sessionId,
		});
		return json({
			expiresAt: result.invite.expiresAt,
			inviteToken: result.inviteToken,
			inviteUrl: new URL(result.inviteUrl, url.origin).toString(),
			role: result.invite.role,
			sessionId: result.session.id,
		});
	} catch (error) {
		const response = operationErrorResponse(error);
		if (response) return response;
		throw error;
	}
};
