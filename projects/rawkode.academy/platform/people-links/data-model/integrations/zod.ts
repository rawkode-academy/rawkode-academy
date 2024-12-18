import { peopleLinks } from "../schema.ts";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const AddBiographyForPerson = createInsertSchema(peopleLinks, {
	personId: z.string().min(1),
	url: z.string().url().nonempty(),
	name: z.string().nonempty(),
});
