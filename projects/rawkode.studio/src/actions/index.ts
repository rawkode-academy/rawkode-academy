import { roomClientService, tokenVerifier } from "@/lib/livekit";
import { ActionError, defineAction } from "astro:actions";
import { z } from "astro:schema";
import { AccessToken } from "livekit-server-sdk";
import { LIVEKIT_API_KEY, LIVEKIT_API_SECRET } from "astro:env/server";
import { database } from "@/lib/database";
import { chatMessagesTable, participantsTable, roomsTable } from "@/schema";
import { desc, eq, isNotNull } from "drizzle-orm";

export type LiveStream = {
  id: string;
  name: string;
  numParticipants: number;
};

export type PastLiveStream = {
  id: string;
  name: string;
  startedAt: Date | null;
  finishedAt: Date;
  participantsJoined: number | null;
};

// New ChatMessage type
export type ChatMessage = {
  id: number;
  roomId: string;
  participantName: string;
  message: string;
  createdAt: Date;
};

// New Participant type
export type Participant = {
  id: number;
  roomId: string;
  name: string;
  joinedAt: Date;
};

export const server = {
  addChatMessage: defineAction({
    input: z.object({
      roomId: z.string(),
      token: z.string(),
      message: z.string(),
      participantName: z.string(),
    }),

    handler: async (input) => {
      try {
        await tokenVerifier.verify(input.token);
      } catch (error) {
        throw new ActionError({ code: "UNAUTHORIZED" });
      }

      await database.insert(chatMessagesTable).values({
        roomId: input.roomId,
        message: input.message,
        participantName: input.participantName,
      });
    },
  }),

  // New action to get past room chat messages
  getPastRoomChatMessages: defineAction({
    input: z.object({
      roomId: z.string(),
    }),
    handler: async (input, context) => {
      if (!context.locals.user) {
        throw new ActionError({ code: "UNAUTHORIZED" });
      }

      try {
        const messages = await database
          .select({
            id: chatMessagesTable.id,
            roomId: chatMessagesTable.roomId,
            participantName: chatMessagesTable.participantName,
            message: chatMessagesTable.message,
            createdAt: chatMessagesTable.createdAt,
          })
          .from(chatMessagesTable)
          .where(eq(chatMessagesTable.roomId, input.roomId))
          .orderBy(chatMessagesTable.createdAt); // Order by creation time

        return messages as ChatMessage[];
      } catch (error) {
        console.error("Error fetching chat messages:", error);
        throw new ActionError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch chat messages.",
        });
      }
    },
  }),

  // New action to get room participants
  getRoomParticipants: defineAction({
    input: z.object({
      roomId: z.string(),
    }),
    handler: async (input, context) => {
      if (!context.locals.user) {
        throw new ActionError({ code: "UNAUTHORIZED" });
      }

      try {
        const participants = await database
          .select()
          .from(participantsTable)
          .where(eq(participantsTable.roomId, input.roomId))
          .orderBy(participantsTable.joinedAt);

        return participants as Participant[];
      } catch (error) {
        console.error("Error fetching room participants:", error);
        throw new ActionError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch room participants.",
        });
      }
    },
  }),

  listRooms: defineAction({
    handler: async (_input, context) => {
      if (!context.locals.user) {
        throw new ActionError({ code: "UNAUTHORIZED" });
      }

      const rooms = await roomClientService.listRooms();

      return rooms.map((room) => ({
        id: room.sid,
        name: room.name,
        numParticipants: room.numParticipants || 0,
      }));
    },
  }),

  listPastRooms: defineAction({
    handler: async (_input, context) => {
      if (!context.locals) {
        console.error(
          "Error: context.locals is undefined in listPastRooms action.",
        );
        throw new ActionError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Server configuration error.",
        });
      }
      try {
        const pastRoomsData = await database
          .select({
            id: roomsTable.id,
            name: roomsTable.name,
            startedAt: roomsTable.startedAt,
            finishedAt: roomsTable.finishedAt,
            participantsJoined: roomsTable.participantsJoined,
          })
          .from(roomsTable)
          .where(isNotNull(roomsTable.finishedAt))
          .orderBy(desc(roomsTable.finishedAt));

        return pastRoomsData
          .filter((
            room: { finishedAt: Date | null | undefined },
          ): room is { finishedAt: Date } & typeof room =>
            room.finishedAt != null
          )
          .map((room) => ({
            ...room,
            participantsJoined: room.participantsJoined ?? 0,
          })) as PastLiveStream[];
      } catch (error) {
        console.error("Error fetching past rooms:", error);
        throw new ActionError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch past livestreams.",
        });
      }
    },
  }),

  // Public action to check if a room exists
  checkRoomExists: defineAction({
    input: z.object({
      roomName: z.string(),
    }),

    handler: async (input) => {
      try {
        const rooms = await roomClientService.listRooms();
        const roomExists = rooms.some((room) => room.name === input.roomName);

        return { exists: roomExists };
      } catch (error) {
        console.error("Error checking if room exists:", error);
        throw new ActionError({
          code: "BAD_REQUEST",
          message: "Failed to check if room exists",
        });
      }
    },
  }),

  createRoom: defineAction({
    input: z.object({
      name: z.string(),
      maxParticipants: z.number(),
      emptyTimeout: z.number().optional(),
    }),

    handler: async (input, context) => {
      if (!context.locals.user) {
        throw new ActionError({ code: "UNAUTHORIZED" });
      }

      const room = await roomClientService.createRoom({
        name: input.name,
        maxParticipants: input.maxParticipants,
        emptyTimeout: input.emptyTimeout || 120, // 2 minutes in seconds
      });

      return {
        id: room.sid,
        name: room.name,
      };
    },
  }),

  deleteRoom: defineAction({
    input: z.object({
      name: z.string(),
    }),

    handler: async (input, context) => {
      if (!context.locals.user) {
        throw new ActionError({ code: "UNAUTHORIZED" });
      }

      await roomClientService.deleteRoom(input.name);
    },
  }),

  generateTokenFromInvite: defineAction({
    input: z.object({
      roomName: z.string(),
      participantName: z.string().optional(),
    }),

    handler: async (input, context) => {
      try {
        // Check if the room exists before generating a token
        let roomExists = false;
        try {
          const rooms = await roomClientService.listRooms();
          roomExists = rooms.some((room) => room.name === input.roomName);
        } catch (roomCheckError) {
          console.warn("Error checking room existence:", roomCheckError);
          // Assume room exists if we can't check due to permissions
          // This is safer than blocking token generation completely
          roomExists = true;
        }

        if (!roomExists) {
          throw new ActionError({
            code: "NOT_FOUND",
            message: "Room does not exist",
          });
        }

        // Check if there's a user session (logged in) or this is a guest
        const loggedInUser = context?.locals?.user;
        const isGuest = !loggedInUser;
        const userDisplayName = loggedInUser?.preferred_username ||
          loggedInUser?.name;

        // Generate identity using provided participant name first, then user info, then random
        // The participantName is highest priority - when client explicitly provides a name, use it
        const identity = input.participantName?.trim() ||
          userDisplayName ||
          `guest-${Math.floor(Math.random() * 10000)}`;

        console.log("Generating token for", isGuest ? "guest" : "user", {
          identity,
          fromParticipantName: !!input.participantName?.trim(),
          fromUserDisplay: !!userDisplayName,
        });

        // Create the token
        const at = new AccessToken(
          LIVEKIT_API_KEY,
          LIVEKIT_API_SECRET,
          { identity },
        );

        // Check if user has the director role
        const isDirector = loggedInUser?.roles?.includes("director") || false;

        // Add the grant - use room name, not room ID
        at.addGrant({
          roomJoin: true,
          room: input.roomName,
          // Only directors can publish audio/video
          canPublish: isDirector,
          // Allow chat for all users
          canPublishData: true,
          // Allow everyone to subscribe to everything
          canSubscribe: true,
        });

        // Convert to string JWT
        const token = at.toJwt();

        // Return only a string value for simplicity
        return token;
      } catch (error) {
        // Return a simple string error message
        console.error("Failed to generate token:", error);
        throw new ActionError({
          code: error instanceof ActionError ? error.code : "BAD_REQUEST",
          message: error instanceof ActionError
            ? error.message
            : "Token generation failed",
        });
      }
    },
  }),
};
