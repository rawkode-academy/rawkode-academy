import { db } from "./client";
import { castingCreditsTable } from "./schema";

const seed = async () => {
	await db
		.insert(castingCreditsTable)
		.values({
			personId: "rawkode",
			role: "Host",
			videoId: "abc123",
		})
		.returning()
		.all();
	process.exit(0);
};

await seed();
