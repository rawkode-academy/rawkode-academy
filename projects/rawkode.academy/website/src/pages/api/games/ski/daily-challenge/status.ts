import type { APIRoute } from "astro";

/**
 * GET /api/games/ski/daily-challenge/status
 * Check if the authenticated player has completed today's daily challenge
 */
export const GET: APIRoute = async ({ locals }) => {
	const user = locals.user;

	if (!user) {
		return new Response(JSON.stringify({ error: "Authentication required" }), {
			status: 401,
			headers: { "Content-Type": "application/json" },
		});
	}

	const env = locals.runtime.env;
	const personId = user.id;

	try {
		const response = await env.SKI_DAILY_CHALLENGE_READ.fetch(
			new Request("http://internal/graphql", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					query: `
						query HasCompletedToday($personId: String!) {
							hasCompletedToday(personId: $personId)
						}
					`,
					variables: { personId },
				}),
			}),
		);

		const data = (await response.json()) as {
			data?: {
				hasCompletedToday: boolean;
			};
			errors?: Array<{ message: string }>;
		};

		if (data.errors) {
			console.error("GraphQL errors:", data.errors);
			return new Response(
				JSON.stringify({ error: "Failed to check challenge status" }),
				{
					status: 500,
					headers: { "Content-Type": "application/json" },
				},
			);
		}

		return new Response(
			JSON.stringify({ completed: data.data?.hasCompletedToday ?? false }),
			{
				status: 200,
				headers: { "Content-Type": "application/json" },
			},
		);
	} catch (error) {
		console.error("Failed to check challenge status:", error);
		return new Response(
			JSON.stringify({ error: "Failed to check challenge status" }),
			{
				status: 500,
				headers: { "Content-Type": "application/json" },
			},
		);
	}
};
