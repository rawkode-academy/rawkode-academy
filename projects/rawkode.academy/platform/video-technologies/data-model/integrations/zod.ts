import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { videoTechnologiesTable } from "../schema.ts";

export const AddTechnologyToVideo = createInsertSchema(videoTechnologiesTable, {
  videoId: z.string().min(1),
  technologyId: z.string().min(1),
});
