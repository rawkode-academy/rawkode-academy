import { sqliteTable, text, unique } from 'drizzle-orm/sqlite-core';

export const episodesTable = sqliteTable('episodes', {
	videoId: text('videoId').notNull().primaryKey(),
	showId: text('showId').notNull(),
	code: text('code').notNull(), // RESTATE1, K8S1, etc.
}, (table) => [
	unique('showCode').on(table.showId, table.code),
]);
