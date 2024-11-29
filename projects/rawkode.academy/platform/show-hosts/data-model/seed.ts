import { db } from './client.ts';
import { showHostsTable } from './schema.ts';

const seed = async () => {
	await db
		.insert(showHostsTable)
		.values({
			showId: 'rawkode-live',
			hostId: 'rawkode',
		})
		.returning()
		.all();
	Deno.exit(0);
};

await seed();
