import { primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const videoGuestsTable = sqliteTable(
  "video_guests",
  {
    videoId: text("video_id").notNull(),
    guestId: text("guest_id").notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.videoId, table.guestId],
    }),
  ],
);
