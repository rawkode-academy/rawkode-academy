import type { APIRoute } from "astro";

interface CompleteChallengePayload {
	moveCount: number;
	timeSeconds: number;
}

/**
 * GET /api/games/ski/daily-challenge
 * Get today's daily challenge
 */
export const GET: APIRoute = async ({ locals }) => {
	const env = locals.runtime.env;

	try {
		const response = await env.SKI_DAILY_CHALLENGE_READ.fetch(
			new Request("http://internal/graphql", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					query: `
						query TodaysChallenge {
							todaysChallenge {
								id
								date
								enemyId
								allowedComebacks
							}
						}
					`,
				}),
			}),
		);

		const data = (await response.json()) as {
			data?: {
				todaysChallenge: {
					id: string;
					date: string;
					enemyId: string;
					allowedComebacks: string[];
				};
			};
			errors?: Array<{ message: string }>;
		};

		if (data.errors) {
			console.error("GraphQL errors:", data.errors);
			return new Response(
				JSON.stringify({ error: "Failed to fetch daily challenge" }),
				{
					status: 500,
					headers: { "Content-Type": "application/json" },
				},
			);
		}

		return new Response(JSON.stringify(data.data?.todaysChallenge), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		});
	} catch (error) {
		console.error("Failed to fetch daily challenge:", error);
		return new Response(
			JSON.stringify({ error: "Failed to fetch daily challenge" }),
			{
				status: 500,
				headers: { "Content-Type": "application/json" },
			},
		);
	}
};

/**
 * POST /api/games/ski/daily-challenge
 * Complete today's daily challenge
 */
export const POST: APIRoute = async ({ request, locals }) => {
	const user = locals.user;

	if (!user) {
		return new Response(JSON.stringify({ error: "Authentication required" }), {
			status: 401,
			headers: { "Content-Type": "application/json" },
		});
	}

	const env = locals.runtime.env;
	const personId = user.id;

	let payload: CompleteChallengePayload;
	try {
		payload = await request.json();
	} catch {
		return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
			status: 400,
			headers: { "Content-Type": "application/json" },
		});
	}

	const { moveCount, timeSeconds } = payload;

	if (typeof moveCount !== "number" || typeof timeSeconds !== "number") {
		return new Response(
			JSON.stringify({
				error: "Invalid payload: moveCount and timeSeconds required",
			}),
			{
				status: 400,
				headers: { "Content-Type": "application/json" },
			},
		);
	}

	try {
		const result = await env.SKI_DAILY_CHALLENGE_RPC.completeDailyChallenge(
			personId,
			moveCount,
			timeSeconds,
		);

		if (!result) {
			return new Response(
				JSON.stringify({ error: "Failed to complete challenge" }),
				{
					status: 500,
					headers: { "Content-Type": "application/json" },
				},
			);
		}

		return new Response(
			JSON.stringify({
				personId: result.personId,
				moveCount: result.moveCount,
				timeSeconds: result.timeSeconds,
				completedAt: result.completedAt.toISOString(),
			}),
			{
				status: 200,
				headers: { "Content-Type": "application/json" },
			},
		);
	} catch (error) {
		console.error("Failed to complete daily challenge:", error);
		return new Response(
			JSON.stringify({ error: "Failed to complete daily challenge" }),
			{
				status: 500,
				headers: { "Content-Type": "application/json" },
			},
		);
	}
};
