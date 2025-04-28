import { primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const transcriptionTerms = sqliteTable(
  "transcription_terms",
  {
    foreignId: text("foreignId").notNull(),
    term: text("term").notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.foreignId, table.term],
    }),
  ],
);
