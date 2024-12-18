import { db } from './client.ts';
import { episodesTable } from './schema.ts';

const seed = async () => {
	await db
		.insert(episodesTable)
		.values({
			videoId: 'SG1-S04E06',
			showId: 'SG1',
			code: 'S04E06',
		})
		.returning()
		.all();

	db.$client.close();
	Deno.exit(0);
};

await seed();
db.$client.close();
