import { roomClientService } from "@/lib/livekit";
import { ActionError, defineAction } from "astro:actions";
import { z } from "astro:schema";
import { AccessToken } from "livekit-server-sdk";
import { LIVEKIT_API_KEY, LIVEKIT_API_SECRET } from "astro:env/server";

export type LiveStream = {
  id: string;
  name: string;
  numParticipants: number;
};

export const server = {
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
        // This works for both authenticated and unauthenticated users
        const rooms = await roomClientService.listRooms();
        const roomExists = rooms.some((room) => room.name === input.roomName);

        if (!roomExists) {
          throw new ActionError({
            code: "NOT_FOUND",
            message: "Room does not exist",
          });
        }

        // Generate a random identity if none is provided
        const identity = input.participantName?.trim() ||
          `guest-${Math.floor(Math.random() * 10000)}`;

        // Create the token
        const at = new AccessToken(
          LIVEKIT_API_KEY,
          LIVEKIT_API_SECRET,
          { identity },
        );

        // Check if user has the director role
        const isDirector = context?.locals?.user?.roles?.includes("director") ||
          false;

        // Add the grant - use room name, not room ID
        at.addGrant({
          roomJoin: true,
          room: input.roomName,
          // Only directors can publish audio/video
          canPublish: isDirector,
          // Allow chat for non-directors
          canPublishData: !isDirector,
          // Directors can subscribe to everything
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
