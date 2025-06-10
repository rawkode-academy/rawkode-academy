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
		contentType: text('content_type').notNull(), // 'video', 'episode', etc.
		personId: text('person_id').notNull(),
		emoji: text('emoji').notNull(),
		reactedAt: integer('reacted_at', { mode: 'timestamp' }).notNull(),
	},
	(table) => ({
		primaryKey: primaryKey({
			columns: [table.contentId, table.contentType, table.personId, table.emoji],
		}),
	}),
);