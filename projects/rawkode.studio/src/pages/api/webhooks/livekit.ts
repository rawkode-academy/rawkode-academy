import { database } from "@/lib/database";
import { webhookReceiver } from "@/lib/livekit";
import { livestreamsTable, participantsTable } from "@/schema";
import type { APIRoute } from "astro";
import { eq } from "drizzle-orm";

export const POST: APIRoute = async ({ request }) => {
	const body = await request.text();
	const authorization = request.headers.get("Authorization");

	if (!authorization) {
		return new Response("Unauthorized", { status: 401 });
	}

	const event = await webhookReceiver.receive(body, authorization);

	const room = event.room;

	if (!room) {
		return new Response("Room not found", { status: 404 });
	}

	switch (event.event) {
		case "room_started":
			// Upsert room to handle race condition with backend room creation
			await database
				.insert(livestreamsTable)
				.values({
					sid: room.sid,
					name: room.name,
					status: "running",
					startedAt: new Date(),
				})
				.onConflictDoUpdate({
					target: livestreamsTable.sid,
					set: {
						status: "running",
						startedAt: new Date(),
					},
					where: eq(livestreamsTable.status, "created"),
				});
			break;

		case "room_finished":
			// Update status to 'ended' when room finishes
			await database
				.update(livestreamsTable)
				.set({
					status: "ended",
					endedAt: new Date(),
				})
				.where(eq(livestreamsTable.sid, room.sid));
			break;

		case "participant_joined": {
			const participant = event.participant;

			if (!participant) {
				return new Response("Participant not found", { status: 404 });
			}

			// Upsert participant
			await database
				.insert(participantsTable)
				.values({
					roomSid: room.sid,
					identity: participant.identity,
					name: participant.name || participant.identity,
				})
				.onConflictDoNothing();
			break;
		}

		default:
			break;
	}

	return new Response("OK", { status: 200 });
};
