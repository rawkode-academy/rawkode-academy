import { peopleTable } from "../schema.ts";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const CreatePerson = createInsertSchema(peopleTable, {
  id: z.string().min(1).max(255),
	forename: z.string().min(1).max(255),
	surname: z.string().min(1).max(255),
	email: z.string().email(),
});
