import { DISCORD_INVITE_URL } from "astro:env/server";
import type { APIRoute } from "astro";
import { getEntry, setContentCache } from "@/lib/live-content";
import { createLogger } from "@/lib/logger";

export const prerender = false;

const logger = createLogger("comments");

export const GET: APIRoute = async (context) => {
	try {
		const { videoId } = context.params;

		if (!videoId) {
			return new Response(JSON.stringify({ error: "Video ID is required" }), {
				status: 400,
				headers: { "Content-Type": "application/json" },
			});
		}

		// Video entry ids are the video (asset) ids.
		const video = await getEntry("videos", videoId);

		if (!video) {
			return new Response(
				JSON.stringify({ comments: [], discordInviteUrl: DISCORD_INVITE_URL }),
				{
					status: 200,
					headers: { "Content-Type": "application/json" },
				},
			);
		}

		await setContentCache(context, { entries: [video] });

		return new Response(
			JSON.stringify({
				comments: [],
				discordInviteUrl: DISCORD_INVITE_URL,
				topic: video.data.title,
			}),
			{
				status: 200,
				headers: { "Content-Type": "application/json" },
			},
		);
	} catch (error) {
		logger.error("Failed to fetch comments", error);
		return new Response(
			JSON.stringify({
				error: "Failed to fetch comments",
				message: error instanceof Error ? error.message : "Unknown error",
				discordInviteUrl: DISCORD_INVITE_URL,
			}),
			{
				status: 500,
				headers: { "Content-Type": "application/json" },
			},
		);
	}
};
