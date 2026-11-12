import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import type { StudioEnv } from "../../../env";
import { json, requestHasAllowedOrigin } from "../../../server/http";
import {
	createStreamOutputDestination,
	deleteStreamOutputDestination,
	getStreamOutputCredentials,
	getStreamOutputState,
	provisionStreamOutputInput,
	setStreamOutputDestinationEnabled,
	StreamOutputError,
} from "../../../server/stream-outputs";

function errorResponse(error: unknown): Response {
	if (error instanceof StreamOutputError) {
		return json({ code: error.code, error: error.message }, error.status);
	}
	throw error;
}

function noStore(data: unknown, status = 200): Response {
	return new Response(JSON.stringify(data), {
		status,
		headers: {
			"Cache-Control": "no-store, max-age=0",
			"Content-Type": "application/json",
			Pragma: "no-cache",
		},
	});
}

export const GET: APIRoute = async ({ locals, url }) => {
	if (!locals.user) {
		return json({ error: "Sign in with rawkode.academy identity." }, 401);
	}
	const sessionId = url.searchParams.get("sessionId") ?? "";
	if (!sessionId || sessionId.length > 200) {
		return json({ error: "sessionId is required." }, 400);
	}

	try {
		return json(await getStreamOutputState(env as StudioEnv, locals.user, sessionId));
	} catch (error) {
		return errorResponse(error);
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
		action?: "create" | "credentials" | "delete" | "provision" | "set-enabled";
		enabled?: unknown;
		outputId?: unknown;
		sessionId?: string;
		streamKey?: unknown;
		url?: unknown;
	} | null;
	if (
		typeof body?.sessionId !== "string" ||
		body.sessionId.trim().length === 0 ||
		body.sessionId.length > 200 ||
		!body.action
	) {
		return json({ error: "sessionId and action are required." }, 400);
	}

	try {
		switch (body.action) {
			case "provision":
				return noStore(await provisionStreamOutputInput(env as StudioEnv, locals.user, body.sessionId));
			case "credentials":
				return noStore({
					credentials: await getStreamOutputCredentials(env as StudioEnv, locals.user, body.sessionId),
				});
			case "create":
				return json({
					destination: await createStreamOutputDestination(env as StudioEnv, locals.user, {
						sessionId: body.sessionId,
						streamKey: body.streamKey,
						url: body.url,
					}),
				});
			case "set-enabled":
				return json({
					destination: await setStreamOutputDestinationEnabled(env as StudioEnv, locals.user, {
						enabled: body.enabled,
						outputId: body.outputId,
						sessionId: body.sessionId,
					}),
				});
			case "delete":
				await deleteStreamOutputDestination(env as StudioEnv, locals.user, {
					outputId: body.outputId,
					sessionId: body.sessionId,
				});
				return json({ deleted: true });
			default:
				return json({ error: "Unknown output action." }, 400);
		}
	} catch (error) {
		return errorResponse(error);
	}
};
