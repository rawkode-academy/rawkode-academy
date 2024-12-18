import { db } from './client.ts';
import { videosTable } from './schema.ts';

const seed = async () => {
	await db
		.insert(videosTable)
		.values({
			title: 'Window of Opportunity',
			subtitle: 'The team is stuck in a time loop.',
			description: 'The team is stuck in a time loop.',
			publishedAt: new Date(),
			duration: 360,
		})
		.returning()
		.all();

	db.$client.close();
	Deno.exit(0);
};

await seed();
db.$client.close();
