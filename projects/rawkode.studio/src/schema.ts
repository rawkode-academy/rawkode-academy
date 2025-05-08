import { integer, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";

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

export const participantsTable = sqliteTable("participants", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  roomId: text("room_id").references(() => roomsTable.id),
  name: text("name").notNull(),
  joinedAt: integer("joined_at", { mode: "timestamp" }).notNull().$defaultFn(
    () => new Date(),
  ),
}, (table) => [
  unique().on(table.roomId, table.name),
]);

export const chatMessagesTable = sqliteTable("chat_messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  roomId: text("room_id").references(() => roomsTable.id),
  participantName: text("participant_name").notNull(),
  message: text("message").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(
    () => new Date(),
  ),
});
