import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { youtubeVideoTable } from "./schema";

const client = createClient({
	url: import.meta.env.TURSO_URL as string,
	authToken: import.meta.env.TURSO_TOKEN as string,
});

export const db = drizzle(client);

const seed = async () => {
	await db
		.insert(youtubeVideoTable)
		.values({
			id: "123",
			title: "My First Video",
			streamedLive: false,
			date: new Date(),
			description: "This is my first video",
		})
		.returning()
		.all();
	process.exit(0);
};

await seed();
