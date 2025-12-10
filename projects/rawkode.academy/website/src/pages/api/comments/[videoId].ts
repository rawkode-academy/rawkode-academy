import { getCollection } from "astro:content";
import type { APIRoute } from "astro";
import { DISCORD_INVITE_URL } from "astro:env/server";
import { createLogger } from "@/lib/logger";

export const prerender = false;

const logger = createLogger("comments");

export const GET: APIRoute = async ({ params }) => {
	try {
		const { videoId } = params;

		if (!videoId) {
			return new Response(JSON.stringify({ error: "Video ID is required" }), {
				status: 400,
				headers: { "Content-Type": "application/json" },
			});
		}

		const videos = await getCollection("videos");
		const video = videos.find((v) => v.data.videoId === videoId);

		if (!video) {
			return new Response(JSON.stringify({ comments: [], discordInviteUrl: DISCORD_INVITE_URL }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			});
		}

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
