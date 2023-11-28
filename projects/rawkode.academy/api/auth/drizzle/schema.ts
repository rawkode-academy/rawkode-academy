import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

export const auth = sqliteTable("auth", {
	github: text("handle").notNull().primaryKey(),
	name: text("name").notNull(),
	email: text("email").notNull().unique(),
	token: text("token"),
	tokenExpires: integer("tokenExpires"),
	refreshToken: text("refreshToken"),
	refreshTokenExpires: integer("refreshTokenExpires"),
});

export const insertSchema = createInsertSchema(auth);
export const selectSchema = createSelectSchema(auth);
