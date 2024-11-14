import { drizzle } from 'drizzle-orm/libsql';
import { client } from './client.ts';
import { episodesTable } from './schema.ts';

const db = drizzle(client);

const seed = async () => {
	await db
		.insert(episodesTable)
		.values({
			showId: 'SG1',
			code: 'S04E06',
			title: 'Window of Opportunity',
			subtitle: 'A classic episode',
			description: 'The team is stuck in a time loop.',
		})
		.returning()
		.all();
	Deno.exit(0);
};

await seed();
