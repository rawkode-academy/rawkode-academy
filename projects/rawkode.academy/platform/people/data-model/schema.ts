import { sqliteTable, text } from "drizzle-orm/sqlite-core";
import { createId } from "@paralleldrive/cuid2";

export const peopleTable = sqliteTable("people", {
  id: text("id").notNull().$defaultFn(createId).primaryKey(),
  forename: text("forename").notNull(),
  surname: text("surname").notNull(),
});
