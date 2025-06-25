import { castingCreditsTable, RoleTypes } from "../schema";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const addCastingCredit = createInsertSchema(castingCreditsTable, {
	personId: z.string().min(1),
	role: z.enum(RoleTypes),
	videoId: z.string().min(1),
});
