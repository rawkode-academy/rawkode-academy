import type { APIRoute } from "astro";
import { eq } from "drizzle-orm";
import type { Room } from "livekit-server-sdk";
import { database } from "@/lib/database";
import { webhookReceiver } from "@/lib/livekit";
import { livestreamsTable, participantsTable } from "@/schema";

export const POST: APIRoute = async ({ request }) => {
  const body = await request.text();
  const authorization = request.headers.get("Authorization");

  if (!authorization) {
    return new Response("Unauthorized", { status: 401 });
  }

  const event = await webhookReceiver.receive(body, authorization);

  const room: Room | undefined = event.room;

  if (!room) {
    return new Response("Room not found", { status: 404 });
  }

  switch (event.event) {
    case "room_started":
      // Update room status to running (room should already exist from creation)
      await database
        .update(livestreamsTable)
        .set({
          status: "running",
          startedAt: new Date(),
        })
        .where(eq(livestreamsTable.id, room.name)); // room.name is our custom ID
      break;

    case "room_finished":
      // Update status to 'ended' when room finishes
      await database
        .update(livestreamsTable)
        .set({
          status: "ended",
          endedAt: new Date(),
        })
        .where(eq(livestreamsTable.id, room.name)); // room.name is our custom ID
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
          roomId: room.name, // room.name is our custom ID
          identity: participant.identity,
          name: participant.attributes?.displayName || participant.identity,
        })
        .onConflictDoNothing();
      break;
    }

    default:
      break;
  }

  return new Response("OK", { status: 200 });
};
