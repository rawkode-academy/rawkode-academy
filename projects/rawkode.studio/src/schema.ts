import { integer, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";

// Main livestreams table with lifecycle status tracking
export const livestreamsTable = sqliteTable("livestreams", {
	sid: text("sid").primaryKey(), // LiveKit room SID
	name: text("name").notNull().unique(), // Room name for URL
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
		roomSid: text("room_sid")
			.notNull()
			.references(() => livestreamsTable.sid, { onDelete: "cascade" }),
		identity: text("identity").notNull(), // LiveKit participant identity
		name: text("name").notNull(), // Display name
	},
	(table) => [unique().on(table.roomSid, table.identity)],
);

// Chat messages table
export const chatMessagesTable = sqliteTable("chat_messages", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	roomSid: text("room_sid")
		.notNull()
		.references(() => livestreamsTable.sid, { onDelete: "cascade" }),
	participantIdentity: text("participant_identity").notNull(),
	participantName: text("participant_name").notNull(),
	message: text("message").notNull(),
	createdAt: integer("created_at", { mode: "timestamp" })
		.notNull()
		.$defaultFn(() => new Date()),
});
