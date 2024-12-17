import {
	integer,
	primaryKey,
	sqliteTable,
	text,
} from 'drizzle-orm/sqlite-core';

export const chaptersTable = sqliteTable(
	'chapters',
	{
		videoId: text('video_id').notNull(),
		startTime: integer('seconds').notNull(),
		title: text('title').notNull(),
	},
	(table) => {
		return {
			'primaryKey': primaryKey({ columns: [table.videoId, table.startTime] }),
		};
	},
);
