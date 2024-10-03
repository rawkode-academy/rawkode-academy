import { showHostsTable } from "../schema.ts";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const AddHostToShow = createInsertSchema(showHostsTable, {
	showId: z.string().min(1),
	hostId: z.string().min(1),
});
