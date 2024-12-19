import {
	integer,
	primaryKey,
	sqliteTable,
	text,
} from 'drizzle-orm/sqlite-core';

export const videoLikesTable = sqliteTable(
	'video_likes',
	{
		videoId: text('video_id').notNull(),
		personId: text('person_id').notNull(),
		likedAt: integer('liked_at', { mode: 'timestamp' }).notNull(),
	},
	(table) => ({
		primaryKey: primaryKey({
			columns: [table.videoId, table.personId],
		}),
	}),
);
