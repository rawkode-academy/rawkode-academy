import { getCollection } from "astro:content";
import { getSecret, ZULIP_URL, ZULIP_EMAIL } from "astro:env/server";
import type { APIRoute } from "astro";

interface ZulipMessage {
	id: number;
	sender_full_name: string;
	sender_email: string;
	timestamp: number;
	content: string;
	avatar_url?: string;
}

interface Comment {
	id: number;
	author: string;
	email: string;
	content: string;
	timestamp: string;
	avatar_url?: string | undefined;
}

export const GET: APIRoute = async ({ params }) => {
	try {
		const { videoId } = params;

		if (!videoId) {
			return new Response(JSON.stringify({ error: "Video ID is required" }), {
				status: 400,
				headers: { "Content-Type": "application/json" },
			});
		}

		const zulipStreamId = 14;
		const zulipApiKey = getSecret("ZULIP_API_KEY");

		const videos = await getCollection("videos");
		const video = videos.find((v) => v.data.id === videoId);

		// This really should never happen, but let's keep the
		// compiler happy.
		if (!video) {
			return new Response(JSON.stringify({ comments: [] }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			});
		}

		const topicName = video.data.title;

		const messagesUrl = new URL(`${ZULIP_URL}/api/v1/messages`);
		messagesUrl.searchParams.set("anchor", "newest");
		messagesUrl.searchParams.set("num_before", "100");
		messagesUrl.searchParams.set("num_after", "0");
		messagesUrl.searchParams.set(
			"narrow",
			JSON.stringify([
				{ operator: "stream", operand: zulipStreamId },
				{ operator: "topic", operand: topicName },
			]),
		);

		const auth = Buffer.from(`${ZULIP_EMAIL}:${zulipApiKey}`).toString(
			"base64",
		);
		const response = await fetch(messagesUrl.toString(), {
			headers: {
				Authorization: `Basic ${auth}`,
				"Content-Type": "application/json",
			},
		});

		if (!response.ok) {
			console.error(
				"Failed to fetch from Zulip:",
				response.status,
				response.statusText,
			);
			return new Response(JSON.stringify({ comments: [] }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			});
		}

		const data = await response.json();
		const messages: ZulipMessage[] = data.messages || [];

		// Transform Zulip messages to comments format
		const comments: Comment[] = messages.map((message) => ({
			id: message.id,
			author: message.sender_full_name,
			email: message.sender_email,
			content: message.content,
			timestamp: new Date(message.timestamp * 1000).toISOString(),
			avatar_url: message.avatar_url,
		}));

		// Sort comments by timestamp (oldest first)
		comments.sort(
			(a, b) =>
				new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
		);

		const zulipTopicUrl = `${ZULIP_URL}/#narrow/stream/${zulipStreamId}/topic/${encodeURIComponent(topicName)}`;

		return new Response(
			JSON.stringify({
				comments,
				zulipTopicUrl,
			}),
			{
				status: 200,
				headers: { "Content-Type": "application/json" },
			},
		);
	} catch (error) {
		console.error("Failed to fetch comments:", error);
		return new Response(
			JSON.stringify({
				error: "Failed to fetch comments",
				message: error instanceof Error ? error.message : "Unknown error",
			}),
			{
				status: 500,
				headers: { "Content-Type": "application/json" },
			},
		);
	}
};
