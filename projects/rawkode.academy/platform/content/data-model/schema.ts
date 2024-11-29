import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { createId } from '@paralleldrive/cuid2';

export const contentTable = sqliteTable('content', {
	id: text('id').primaryKey().$default(createId),
	title: text('title').notNull(),
	subtitle: text('subtitle').notNull(),
	status: text({ enum: ["draft", "published"] }).default("draft"),
});
