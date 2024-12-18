import { peopleBiographies } from "../schema.ts";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const AddBiographyForPerson = createInsertSchema(peopleBiographies, {
	personId: z.string().min(1),
	biography: z.string().min(1),
});
