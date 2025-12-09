import {
	integer,
	primaryKey,
	sqliteTable,
	text,
} from 'drizzle-orm/sqlite-core';

export const playerLearnedInsultsTable = sqliteTable(
	'player_learned_insults',
	{
		personId: text('person_id').notNull(),
		insultId: text('insult_id').notNull(),
		learnedAt: integer('learned_at', { mode: 'timestamp' }).notNull(),
	},
	(table) => ({
		primaryKey: primaryKey({
			columns: [table.personId, table.insultId],
		}),
	}),
);

export const playerLearnedComebacksTable = sqliteTable(
	'player_learned_comebacks',
	{
		personId: text('person_id').notNull(),
		comebackId: text('comeback_id').notNull(),
		learnedAt: integer('learned_at', { mode: 'timestamp' }).notNull(),
	},
	(table) => ({
		primaryKey: primaryKey({
			columns: [table.personId, table.comebackId],
		}),
	}),
);