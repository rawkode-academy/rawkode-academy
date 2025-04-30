import { videosTable } from "../schema.ts";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const CreateVideo = createInsertSchema(videosTable, {
  title: z.string().nonempty(),
  subtitle: z.string().nonempty(),
  slug: z.string().nonempty(),
  description: z.string().nonempty(),
  duration: z.number().positive(),
  publishedAt: z.date(),
});
