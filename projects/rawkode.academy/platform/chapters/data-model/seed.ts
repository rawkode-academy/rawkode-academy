import { db } from './client.ts';
import { chaptersTable } from './schema.ts';

const seed = async () => {
	await db
		.insert(chaptersTable)
		.values({
			videoId: 'abc123',
			startTime: 0,
			title: 'Introduction',
		})
		.returning()
		.all();
	Deno.exit(0);
};

await seed();
