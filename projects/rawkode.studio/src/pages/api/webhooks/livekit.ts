import { database } from "@/lib/database";
import { webhookReceiver } from "@/lib/livekit";
import { participantsTable, roomsTable } from "@/schema";
import type { APIRoute } from "astro";
import { eq, sql } from "drizzle-orm";

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
      await database.insert(roomsTable).values({
        id: room.sid,
        name: room.name,
      });
      break;
    case "room_finished":
      await database.update(roomsTable).set({
        finishedAt: new Date(),
      }).where(eq(roomsTable.id, room.sid));
      break;
    case "participant_joined":
      await database.update(roomsTable).set({
        participantsJoined: sql`${roomsTable.participantsJoined} + 1`,
      }).where(eq(roomsTable.id, room.sid));

      const participant = event.participant;

      if (!participant) {
        return new Response("Participant not found", { status: 404 });
      }

      await database.insert(participantsTable).values({
        roomId: room.sid,
        name: participant.identity,
      }).onConflictDoNothing();
      break;
    default:
      break;
  }

  return new Response("OK", { status: 200 });
};
