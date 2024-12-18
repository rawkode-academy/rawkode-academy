import { db } from './client.ts';
import { castingCreditsTable } from './schema.ts';

const seed = async () => {
	await db
		.insert(castingCreditsTable)
		.values({
			personId: 'rawkode',
			role: 'Host',
			videoId: 'abc123',
		})
		.returning()
		.all();
	Deno.exit(0);
};

await seed();
