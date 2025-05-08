import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const roomsTable = sqliteTable("rooms", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  startedAt: integer("started_at", { mode: "timestamp" }).notNull().$defaultFn(
    () => new Date(),
  ),
  participantsJoined: integer("participants_joined").default(0),
  participantsLeft: integer("participants_left").default(0),
  finishedAt: integer("finished_at", { mode: "timestamp" }),
});
