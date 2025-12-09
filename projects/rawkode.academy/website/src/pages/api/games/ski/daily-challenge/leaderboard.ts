import type { APIRoute } from "astro";

/**
 * GET /api/games/ski/daily-challenge/leaderboard
 * Get the daily challenge leaderboard
 */
export const GET: APIRoute = async ({ url, locals }) => {
	const env = locals.runtime.env;

	const date = url.searchParams.get("date") ?? undefined;
	const limitParam = url.searchParams.get("limit");
	const limit = limitParam ? Number.parseInt(limitParam, 10) : 50;

	try {
		const response = await env.SKI_DAILY_CHALLENGE_READ.fetch(
			new Request("http://internal/graphql", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					query: `
						query DailyChallengeLeaderboard($date: String, $limit: Int) {
							dailyChallengeLeaderboard(date: $date, limit: $limit) {
								personId
								moveCount
								timeSeconds
								completedAt
							}
						}
					`,
					variables: { date, limit },
				}),
			}),
		);

		const data = (await response.json()) as {
			data?: {
				dailyChallengeLeaderboard: Array<{
					personId: string;
					moveCount: number;
					timeSeconds: number;
					completedAt: string;
				}>;
			};
			errors?: Array<{ message: string }>;
		};

		if (data.errors) {
			console.error("GraphQL errors:", data.errors);
			return new Response(
				JSON.stringify({ error: "Failed to fetch daily leaderboard" }),
				{
					status: 500,
					headers: { "Content-Type": "application/json" },
				},
			);
		}

		return new Response(
			JSON.stringify(data.data?.dailyChallengeLeaderboard ?? []),
			{
				status: 200,
				headers: { "Content-Type": "application/json" },
			},
		);
	} catch (error) {
		console.error("Failed to fetch daily leaderboard:", error);
		return new Response(
			JSON.stringify({ error: "Failed to fetch daily leaderboard" }),
			{
				status: 500,
				headers: { "Content-Type": "application/json" },
			},
		);
	}
};
