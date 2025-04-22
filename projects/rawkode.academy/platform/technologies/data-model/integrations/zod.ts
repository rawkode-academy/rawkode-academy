import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { technologiesTable } from "../schema.ts";

export const createTechnology = createInsertSchema(technologiesTable, {
  id: z.string().min(1).max(255),
  name: z.string().min(1).max(255),
  description: z.string().min(1),

  website: z.string().url(),
  documentation: z.string().url(),
});
