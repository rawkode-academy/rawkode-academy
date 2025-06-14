import {
	integer,
	primaryKey,
	sqliteTable,
	text,
} from 'drizzle-orm/sqlite-core';

export const emojiReactionsTable = sqliteTable(
	'emoji_reactions',
	{
		contentId: text('content_id').notNull(),
		personId: text('person_id').notNull(),
		emoji: text('emoji').notNull(),
		reactedAt: integer('reacted_at', { mode: 'timestamp' }),
		timestampPosition: integer('timestamp_position'),
	},
	(table) => ({
		primaryKey: primaryKey({
			columns: [table.contentId, table.personId, table.emoji],
		}),
	}),
);