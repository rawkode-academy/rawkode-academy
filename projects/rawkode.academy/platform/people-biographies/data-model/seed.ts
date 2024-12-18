import { db } from './client.ts';
import { peopleBiographies } from './schema.ts';

const seed = async () => {
	await db
		.insert(peopleBiographies)
		.values({
			personId: "rawkode",
			biography: "Howdy!",
		})
		.returning()
		.all();
	Deno.exit(0);
};

await seed();
