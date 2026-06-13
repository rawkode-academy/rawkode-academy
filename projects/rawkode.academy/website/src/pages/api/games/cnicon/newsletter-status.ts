import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { createLearnerId } from "@/actions/newsletter";

const AUDIENCE = "cnicon";

/**
 * GET /api/games/cnicon/newsletter-status
 * Whether the signed-in learner is subscribed to the CNIcon newsletter.
 * Checks EMAIL_PREFERENCES (where newsletter.subscribe writes), not Resend —
 * the subscription is stored under the learner id + audience "cnicon".
 */
export const GET: APIRoute = async ({ locals }) => {
	const user = locals.user;

	if (!user) {
		return new Response(JSON.stringify({ subscribed: false }), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		});
	}

	try {
		const prefs = await env.EMAIL_PREFERENCES.getPreferences(
			createLearnerId(user.id),
			"newsletter",
			AUDIENCE,
		);

		return new Response(JSON.stringify({ subscribed: prefs.length > 0 }), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		});
	} catch (error) {
		console.error("Failed to check newsletter status:", error);
		return new Response(JSON.stringify({ subscribed: false }), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		});
	}
};
