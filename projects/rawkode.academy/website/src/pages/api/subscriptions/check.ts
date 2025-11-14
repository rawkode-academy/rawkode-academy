import type { APIRoute } from "astro";
import { isSubscribedToAudience } from "@/server/subscriptions";

/**
 * API endpoint to check if a user is subscribed to an audience
 * GET /api/subscriptions/check?audienceId=xxx
 *
 * Returns: { isSubscribed: boolean }
 */
export const GET: APIRoute = async ({ url, locals, session }) => {
	const audienceId = url.searchParams.get("audienceId");

	if (!audienceId) {
		return new Response(
			JSON.stringify({
				error: "audienceId parameter is required",
			}),
			{
				status: 400,
				headers: {
					"Content-Type": "application/json",
				},
			},
		);
	}

	try {
		const user = locals.user;
		const isSubscribed = await isSubscribedToAudience(
			audienceId,
			user?.email,
			session,
		);

		return new Response(
			JSON.stringify({
				isSubscribed,
			}),
			{
				status: 200,
				headers: {
					"Content-Type": "application/json",
					// Cache for 5 minutes per user+audience
					"Cache-Control": "private, max-age=300",
				},
			},
		);
	} catch (error) {
		console.error("Error checking subscription:", error);
		return new Response(
			JSON.stringify({
				error: "Failed to check subscription status",
				isSubscribed: false,
			}),
			{
				status: 500,
				headers: {
					"Content-Type": "application/json",
				},
			},
		);
	}
};
