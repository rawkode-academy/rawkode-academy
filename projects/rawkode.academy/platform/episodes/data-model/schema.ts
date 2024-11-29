import { primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * Why don't episodes have a date?
 *
 * I was going to include this, but
 * as each episode could be delivered as multiple
 * assets: video, audio, podcast, interview, whatever
 * Those should determine publish date
 * As such, when you visit the episode page, you'll
 * see all the assets available for that episode.
 * and if none have been published yet, we can display
 * the times they are scheduled to be published.
 */
export const episodesTable = sqliteTable('episodes', {
	showId: text('showId').notNull(),
	// We're not going to make this a sequential number,
	// because episodes are often scheduled in advance and
	// out of order.
	// This code should also provide a simple
	// way for viewers to identify the episode.
	// Like, by visiting: rawkode.academy/RESTATE1
	code: text('code').notNull(), // RESTATE1, K8S1, etc.
	contentId: text('contentId').notNull(),
}, (table) => (
	{
		pk: primaryKey({ columns: [table.showId, table.code] }),
	}
));
