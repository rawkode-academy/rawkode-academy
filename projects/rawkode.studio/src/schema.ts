import { integer, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";

// Main livestreams table with lifecycle status tracking
export const livestreamsTable = sqliteTable("livestreams", {
  id: text("id").primaryKey(), // Unique room ID (like Google Meet)
  livekitSid: text("livekit_sid").notNull().unique(), // LiveKit room SID
  displayName: text("display_name").notNull(), // User-friendly display name
  status: text("status", { enum: ["created", "running", "ended"] })
    .notNull()
    .default("created"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  startedAt: integer("started_at", { mode: "timestamp" }), // When room actually started (first participant joined)
  endedAt: integer("ended_at", { mode: "timestamp" }), // When room ended
});

// Participants table with upsert support
export const participantsTable = sqliteTable(
  "participants",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    roomId: text("room_id")
      .notNull()
      .references(() => livestreamsTable.id, { onDelete: "cascade" }),
    identity: text("identity").notNull(), // LiveKit participant identity
    name: text("name").notNull(), // Display name
  },
  (table) => [unique().on(table.roomId, table.identity)],
);

// Chat messages table
export const chatMessagesTable = sqliteTable("chat_messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  roomId: text("room_id")
    .notNull()
    .references(() => livestreamsTable.id, { onDelete: "cascade" }),
  participantIdentity: text("participant_identity").notNull(),
  participantName: text("participant_name").notNull(),
  message: text("message").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});
