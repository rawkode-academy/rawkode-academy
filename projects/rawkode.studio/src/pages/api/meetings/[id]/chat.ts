import type { APIRoute } from "astro";
import { requireDirectorRole } from "@/lib/auth/auth-utils";
import { RealtimeKitClient } from "@/lib/realtime-kit/client";

interface ChatMessage {
	timestamp: string;
	participantName: string;
	message: string;
	sessionId: string;
	sessionStarted: string;
}

export const GET: APIRoute = async ({ locals, params }) => {
	// Check if user has director role
	const authError = requireDirectorRole(locals);
	if (authError) {
		return authError;
	}

	const { id } = params;

	if (!id) {
		return new Response(JSON.stringify({ error: "Meeting ID is required" }), {
			status: 400,
			headers: { "Content-Type": "application/json" },
		});
	}

	try {
		const client = new RealtimeKitClient();

		// Get meeting and check if chat persistence is enabled
		const meeting = await client.getMeeting(id);

		if (!meeting) {
			return new Response(JSON.stringify({ error: "Meeting not found" }), {
				status: 404,
				headers: { "Content-Type": "application/json" },
			});
		}

		if (!meeting.persist_chat) {
			return new Response(
				JSON.stringify({
					messages: [],
					sessionsCount: 0,
				}),
				{
					status: 200,
					headers: { "Content-Type": "application/json" },
				},
			);
		}

		// Get sessions for the meeting
		const sessionsResponse = await client.getSessions({ associated_id: id });
		const sessions = sessionsResponse.data || [];

		if (sessions.length === 0) {
			return new Response(
				JSON.stringify({
					messages: [],
					sessionsCount: 0,
				}),
				{
					status: 200,
					headers: { "Content-Type": "application/json" },
				},
			);
		}

		// Collect chat messages from all sessions
		const allMessages: ChatMessage[] = [];

		for (const session of sessions) {
			try {
				const chatData = await client.getSessionChat(session.id);

				if (chatData?.chatDownloadUrl) {
					const messages = await client.downloadChatMessages(
						chatData.chatDownloadUrl,
					);
					allMessages.push(
						...messages.map((msg) => ({
							timestamp: msg.timestamp,
							participantName: msg.participantName,
							message: msg.message,
							sessionId: session.id,
							sessionStarted: session.started_at,
						})),
					);
				}
			} catch (_error) {}
		}

		// Sort messages by timestamp
		allMessages.sort(
			(a, b) =>
				new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
		);

		return new Response(
			JSON.stringify({
				messages: allMessages,
				sessionsCount: sessions.length,
			}),
			{
				status: 200,
				headers: { "Content-Type": "application/json" },
			},
		);
	} catch (_error) {
		return new Response(
			JSON.stringify({
				messages: [],
				sessionsCount: 0,
				error: "Failed to fetch chat messages",
			}),
			{
				status: 500,
				headers: { "Content-Type": "application/json" },
			},
		);
	}
};
