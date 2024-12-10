import { db } from './client.ts';
import { videosTable } from './schema.ts';
import { createId } from '@paralleldrive/cuid2';

const seed = async () => {
	await db
		.insert(videosTable)
		.values({
			id: createId(),
			title: 'Window of Opportunity',
			subtitle: 'The team is stuck in a time loop.',
			status: 'draft',
		})
		.returning()
		.all();

	db.$client.close();
	Deno.exit(0);
};

await seed();
db.$client.close();
