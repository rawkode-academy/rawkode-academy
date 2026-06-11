import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { badgeCredentialsTable } from "../schema.js";

export const insertBadgeCredentialSchema = createInsertSchema(
	badgeCredentialsTable,
);
export const selectBadgeCredentialSchema = createSelectSchema(
	badgeCredentialsTable,
);
