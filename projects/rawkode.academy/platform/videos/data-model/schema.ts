import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { createId } from '@paralleldrive/cuid2';

export const videosTable = sqliteTable('videos', {
	id: text('id').primaryKey().$default(createId),
	title: text('title').notNull(),
	subtitle: text('subtitle').notNull(),
	status: text({ enum: ['draft', 'published'] }).default('draft'),
});
