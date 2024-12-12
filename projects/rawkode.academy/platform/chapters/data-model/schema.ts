import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const chaptersTable = sqliteTable(
	'chapters',
	{
		videoId: text('video_id').primaryKey(),
		startTime: integer('seconds').notNull(),
		title: text('title').notNull(),
	},
);
