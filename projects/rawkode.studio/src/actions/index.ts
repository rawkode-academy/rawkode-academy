import { roomClientService } from "@/lib/livekit";
import { ActionError, defineAction } from "astro:actions";
import { z } from "astro:schema";

export type LiveStream = {
  id: string;
  name: string;
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
      }));
    },
  }),

  createRoom: defineAction({
    input: z.object({
      name: z.string(),
      maxParticipants: z.number(),
    }),

    handler: async (input, context) => {
      if (!context.locals.user) {
        throw new ActionError({ code: "UNAUTHORIZED" });
      }

      const room = await roomClientService.createRoom({
        name: input.name,
        maxParticipants: input.maxParticipants,
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
};
