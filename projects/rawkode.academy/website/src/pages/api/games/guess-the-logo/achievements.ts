import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

const NAMESPACE = "guess-the-logo";

/**
 * POST /api/games/guess-the-logo/achievements
 * Unlock achievements for the current user.
 * Body: { achievementIds: string[] }
 *
 * GET /api/games/guess-the-logo/achievements
 * Returns all achievements unlocked by the current user (across all days).
 */

export const POST: APIRoute = async ({ request, locals }) => {
	const user = locals.user;

	if (!user) {
		return new Response(JSON.stringify({ error: "Authentication required" }), {
			status: 401,
			headers: { "Content-Type": "application/json" },
		});
	}

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
			status: 400,
			headers: { "Content-Type": "application/json" },
		});
	}

	const { achievementIds } = body as { achievementIds: unknown };

	if (
		!Array.isArray(achievementIds) ||
		!achievementIds.every((id) => typeof id === "string")
	) {
		return new Response(
			JSON.stringify({
				error: "Invalid payload: achievementIds must be an array of strings",
			}),
			{
				status: 400,
				headers: { "Content-Type": "application/json" },
			},
		);
	}

	try {
		const result = await env.ACHIEVEMENTS.unlockAchievements({
			namespace: NAMESPACE,
			personId: user.id,
			achievementIds,
		});

		return new Response(JSON.stringify(result), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		});
	} catch (error) {
		console.error("Failed to unlock achievements:", error);
		return new Response(
			JSON.stringify({ error: "Failed to unlock achievements" }),
			{
				status: 500,
				headers: { "Content-Type": "application/json" },
			},
		);
	}
};

export const GET: APIRoute = async ({ locals }) => {
	const user = locals.user;

	if (!user) {
		return new Response(JSON.stringify({ error: "Authentication required" }), {
			status: 401,
			headers: { "Content-Type": "application/json" },
		});
	}

	try {
		const achievements = await env.ACHIEVEMENTS.getPlayerAchievements({
			namespace: NAMESPACE,
			personId: user.id,
		});

		return new Response(JSON.stringify(achievements), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		});
	} catch (error) {
		console.error("Failed to fetch achievements:", error);
		return new Response(
			JSON.stringify({ error: "Failed to fetch achievements" }),
			{
				status: 500,
				headers: { "Content-Type": "application/json" },
			},
		);
	}
};
