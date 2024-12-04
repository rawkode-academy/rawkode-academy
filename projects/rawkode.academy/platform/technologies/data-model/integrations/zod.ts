import { technologiesTable } from "../schema.ts";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const CreateTechnology = createInsertSchema(technologiesTable, {
  id: z.string().min(1).max(255),
  name: z.string().min(1).max(255),
  description: z.string().min(1),
  logoUrl: z.string().url(),
  website: z.string().url(),
  documentation: z.string().url(),
});
