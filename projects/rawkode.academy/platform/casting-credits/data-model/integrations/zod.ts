import { castingCreditsTable } from "../schema";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const addCastingCredit = createInsertSchema(castingCreditsTable, {
	personId: z.string().min(1),
	role: z.string().min(1),
	videoId: z.string().min(1),
});
