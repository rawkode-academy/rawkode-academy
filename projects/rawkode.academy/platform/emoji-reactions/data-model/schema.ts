import {
	integer,
	primaryKey,
	sqliteTable,
	text,
} from 'drizzle-orm/sqlite-core';

export const videoEmojiReactionsTable = sqliteTable(
	'video_emoji_reactions',
	{
		videoId: text('video_id').notNull(),
		personId: text('person_id').notNull(),
		emoji: text('emoji').notNull(),
		reactedAt: integer('reacted_at', { mode: 'timestamp' }).notNull(),
	},
	(table) => ({
		primaryKey: primaryKey({
			columns: [table.videoId, table.personId, table.emoji],
		}),
	}),
);

export const episodeEmojiReactionsTable = sqliteTable(
	'episode_emoji_reactions',
	{
		episodeId: text('episode_id').notNull(),
		personId: text('person_id').notNull(),
		emoji: text('emoji').notNull(),
		reactedAt: integer('reacted_at', { mode: 'timestamp' }).notNull(),
	},
	(table) => ({
		primaryKey: primaryKey({
			columns: [table.episodeId, table.personId, table.emoji],
		}),
	}),
);