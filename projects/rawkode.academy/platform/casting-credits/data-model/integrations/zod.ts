import { castingCreditsTable } from "../schema.ts";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const AddCastingCredit = createInsertSchema(castingCreditsTable, {
	personId: z.string().min(1),
	role: z.string().min(1),
	videoId: z.string().min(1),
});
