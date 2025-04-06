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
