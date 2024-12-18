import { createId } from '@paralleldrive/cuid2';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const videosTable = sqliteTable('content', {
	id: text('id').primaryKey().$default(createId),
	title: text('title').notNull(),
	subtitle: text('subtitle').notNull(),
	description: text('description').notNull(),
	duration: integer({ mode: 'number' }).notNull(),
	publishedAt: integer({ mode: 'timestamp' }).notNull(),
});
