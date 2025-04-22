import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { videoGuestsTable } from "../schema.ts";

export const AddGuestToVideo = createInsertSchema(videoGuestsTable, {
  videoId: z.string().min(1),
  guestId: z.string().min(1),
});
