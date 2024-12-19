import { db } from './client.ts';
import { videoLikesTable } from './schema.ts';

const seed = async () => {
	await db
		.insert(videoLikesTable)
		.values({
			videoId: '1',
			personId: '1',
			likedAt: new Date(),
		})
		.returning()
		.all();
	Deno.exit(0);
};

await seed();
