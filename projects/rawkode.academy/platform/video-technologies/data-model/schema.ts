import { primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const videoTechnologiesTable = sqliteTable(
  "video_technologies",
  {
    videoId: text("video_id").notNull(),
    technologyId: text("technology_id").notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.videoId, table.technologyId],
    }),
  ],
);
