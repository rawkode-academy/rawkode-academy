import { db } from './client.ts';
import { peopleLinks } from './schema.ts';

const seed = async () => {
	await db
		.insert(peopleLinks)
		.values({
			personId: "rawkode",
			url: "https://rawkode.academy",
			name: "Homepage",
		})
		.returning()
		.all();
	Deno.exit(0);
};

await seed();
