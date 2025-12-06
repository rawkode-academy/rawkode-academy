import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const badgeCredentialsTable = sqliteTable("badge_credentials", {
	id: text("id").primaryKey(),
	userId: text("user_id").notNull(),
	achievementType: text("achievement_type").notNull(),
	credentialJson: text("credential_json").notNull(),
	issuedAt: integer("issued_at", { mode: "timestamp" }).notNull(),
	expiresAt: integer("expires_at", { mode: "timestamp" }),
});
