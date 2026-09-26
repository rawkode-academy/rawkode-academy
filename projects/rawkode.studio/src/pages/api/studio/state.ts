import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import type { StudioEnv } from "../../../env";
import {
	getStudioControlState,
	removeOwnedStudioControlSources,
	requireStudioControlAccess,
	saveStudioControlState,
	StudioControlStateError,
} from "../../../server/control-state";
import { json, requestHasAllowedOrigin } from "../../../server/http";

export const GET: APIRoute = async ({ locals, url }) => {
	if (!locals.user) {
		return json({ error: "Sign in with rawkode.academy identity." }, 401);
	}

	const sessionId = url.searchParams.get("sessionId") ?? "";
	if (!sessionId) {
		return json({ error: "sessionId is required." }, 400);
	}

	try {
		await requireStudioControlAccess(env as StudioEnv, locals.user, sessionId);
		return json(await getStudioControlState(env as StudioEnv, sessionId));
	} catch (error) {
		return controlStateErrorResponse(error);
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
		action?: "remove-owned-sources";
		expectedRevision?: number;
		ownerId?: string;
		sessionId?: string;
		sourceIds?: string[];
		state?: unknown;
	} | null;
	if (!body?.sessionId) {
		return json({ error: "sessionId is required." }, 400);
	}

	if (body.action === "remove-owned-sources") {
		if (!body.ownerId || !Array.isArray(body.sourceIds)) {
			return json({ error: "ownerId and sourceIds are required." }, 400);
		}
		try {
			await requireStudioControlAccess(env as StudioEnv, locals.user, body.sessionId);
			return json(await removeOwnedStudioControlSources(env as StudioEnv, locals.user, {
				ownerId: body.ownerId,
				sessionId: body.sessionId,
				sourceIds: body.sourceIds,
			}));
		} catch (error) {
			return controlStateErrorResponse(error);
		}
	}

	if (body.expectedRevision === undefined || body.state === undefined) {
		return json({ error: "sessionId, expectedRevision, and state are required." }, 400);
	}

	try {
		await requireStudioControlAccess(env as StudioEnv, locals.user, body.sessionId);
		const result = await saveStudioControlState(env as StudioEnv, locals.user, {
			expectedRevision: body.expectedRevision,
			sessionId: body.sessionId,
			state: body.state,
		});
		if (!result.saved) {
			return json(
				{
					error: "Studio control state changed in another producer.",
					...result.snapshot,
				},
				409,
			);
		}
		return json(result.snapshot);
	} catch (error) {
		return controlStateErrorResponse(error);
	}
};

function controlStateErrorResponse(error: unknown): Response {
	if (error instanceof StudioControlStateError) {
		return json({ error: error.message }, error.status);
	}
	throw error;
}
