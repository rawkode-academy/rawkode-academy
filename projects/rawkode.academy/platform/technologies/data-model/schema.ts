import { sqliteTable, text } from "drizzle-orm/sqlite-core";

export const technologiesTable = sqliteTable("technologies", {
  id: text("id").notNull().primaryKey(),
  name: text("name").notNull().unique(),
  logoUrl: text("logoUrl").unique(),
  description: text("description").notNull(),
  website: text("website"),
  documentation: text("documentation"),
});
