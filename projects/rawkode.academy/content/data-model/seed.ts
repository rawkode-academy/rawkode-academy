import { db } from './client.ts';
import { contentTable } from './schema.ts';

const seed = async () => {
	await db
		.insert(contentTable)
		.values({
			title: 'Window of Opportunity',
			subtitle: 'The team is stuck in a time loop.',
		})
		.returning()
		.all();

	db.$client.close();
	Deno.exit(0);
};

await seed();
db.$client.close();
