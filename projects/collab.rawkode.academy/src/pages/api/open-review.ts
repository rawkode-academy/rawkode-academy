import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { GatewayError, gql } from "../../lib/gateway.ts";
import { OPEN_REVIEW } from "../../lib/queries.ts";
import { scopeFor } from "../../lib/scope.ts";

/** Staff open a draft review, or deliver a new cut, from the dashboard. */
export const POST: APIRoute = async ({ request, locals, redirect }) => {
	const session = locals.session!;
	if (!scopeFor(session).canTriage) return Response.json({ error: "Forbidden" }, { status: 403 });
	const form = await request.formData();
	const field = (name: string) => String(form.get(name) ?? "").trim();
	const videoId = field("videoId");
	try {
		const { openReview } = await gql<{ openReview: { id: string } }>(env, session.accessToken, OPEN_REVIEW, {
			input: {
				collaboratorId: field("collaboratorId"),
				organizationId: field("organizationId"),
				videoId,
				title: field("title"),
				videoUrl: field("videoUrl") || `https://content.rawkode.academy/videos/${videoId}/stream.m3u8`,
			},
		});
		return redirect(`/reviews/${openReview.id}`, 303);
	} catch (error) {
		return Response.json({ error: error instanceof GatewayError ? error.message : "Something went wrong" }, { status: 400 });
	}
};
