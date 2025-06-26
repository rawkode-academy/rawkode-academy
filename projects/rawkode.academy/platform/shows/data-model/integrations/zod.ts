import { showsTable } from "../schema.ts";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const createShow = createInsertSchema(showsTable, {
  // Don't allow the user to specify the ID
  id: z.never().optional(),
  name: z.string().min(1),
});
