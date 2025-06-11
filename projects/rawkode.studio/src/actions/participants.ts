import { ActionError, defineAction } from "astro:actions";
import { z } from "astro:schema";
import { database } from "@/lib/database";
import { participantsTable } from "@/schema";
import { eq } from "drizzle-orm";

export type Participant = {
  id: number;
  roomId: string;
  identity: string;
  name: string;
};

export const participants = {
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
          .where(eq(participantsTable.roomId, input.roomId));

        return participants as Participant[];
      } catch (error) {
        throw new ActionError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch room participants.",
        });
      }
    },
  }),
};
