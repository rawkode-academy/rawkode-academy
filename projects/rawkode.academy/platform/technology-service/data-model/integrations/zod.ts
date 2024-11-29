import { technologiesTable } from "../schema/index.ts";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const CreateTechnology = createInsertSchema(technologiesTable, {
	// Don't allow the user to specify the ID
	id: z.never().optional(),
	name: z.string().min(1),
	description: z.string().min(1),
	website: z.string().url().optional(),
	documentation: z.string().url().optional(),
	license: z.string().min(1).optional().default("Proprietary"),
	sourceRepository: z.string().url().optional(),
});