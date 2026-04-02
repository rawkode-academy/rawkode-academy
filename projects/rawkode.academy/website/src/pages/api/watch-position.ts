import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { fetchWithTimeout } from "@/utils/timeout";

export const POST: APIRoute = async ({ locals, request }) => {
	const user = locals.user;

	if (!user) {
		return new Response(JSON.stringify({ error: "Unauthorized" }), {
			status: 401,
			headers: { "Content-Type": "application/json" },
		});
	}

	try {
		const body = await request.json();
		const { videoId, positionSeconds } = body as {
			videoId?: string;
			positionSeconds?: number;
		};

		if (!videoId || positionSeconds === undefined) {
			return new Response(
				JSON.stringify({ error: "Missing videoId or positionSeconds" }),
				{
					status: 400,
					headers: { "Content-Type": "application/json" },
				},
			);
		}

		if (!env.WATCH_HISTORY) {
			return new Response(
				JSON.stringify({ error: "Watch history service not configured" }),
				{
					status: 500,
					headers: { "Content-Type": "application/json" },
				},
			);
		}

		const response = await fetchWithTimeout(
			env.WATCH_HISTORY.fetch.bind(env.WATCH_HISTORY),
			new Request("https://watch-history.internal/", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					videoId,
					positionSeconds: Math.floor(positionSeconds),
					userId: user.id,
				}),
			}),
			{},
			{
				timeoutMs: 4000,
				label: "Watch history API service",
			},
		);

		if (!response.ok) {
			const errorData = (await response.json()) as { error?: string };
			return new Response(
				JSON.stringify({ error: errorData.error || "Failed to save position" }),
				{
					status: response.status,
					headers: { "Content-Type": "application/json" },
				},
			);
		}

		return new Response(JSON.stringify({ success: true }), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		});
	} catch (error) {
		return new Response(
			JSON.stringify({
				error: error instanceof Error ? error.message : "Unknown error",
			}),
			{
				status: 500,
				headers: { "Content-Type": "application/json" },
			},
		);
	}
};
