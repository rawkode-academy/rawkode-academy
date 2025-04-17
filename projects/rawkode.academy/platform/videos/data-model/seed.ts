import { getDatabase } from "./client";
import { videosTable } from "./schema";

const db = getDatabase();

const seed = async () => {
	await db
		.insert(videosTable)
		.values({
			title: "Window of Opportunity",
			subtitle: "The team is stuck in a time loop.",
			slug: "window-of-opportunity",
			description: "The team is stuck in a time loop.",
			publishedAt: new Date(),
			duration: 360,
		})
		.returning()
		.all();

	db.$client.close();
	process.exit(0);
};

await seed();
db.$client.close();
