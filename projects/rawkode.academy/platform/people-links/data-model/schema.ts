import { primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const peopleLinks = sqliteTable(
	'people_links',
	{
		personId: text('person_id').notNull(),
		url: text('url').notNull(),
		name: text('name').notNull(),
	},
	(table) => ({
		pk: primaryKey({
			columns: [table.personId, table.url],
		}),
	}),
);
