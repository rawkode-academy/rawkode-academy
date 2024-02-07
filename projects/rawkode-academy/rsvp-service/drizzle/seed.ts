import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { rsvpTable } from "./schema";

const client = createClient({
	url: process.env.TURSO_URL as string,
	authToken: process.env.TURSO_AUTH_TOKEN as string,
});

export const db = drizzle(client);

const seed = async () => {
	const result = await db
		.insert(rsvpTable)
		.values({
			userId: "1",
			eventId: "1",
		})
		.returning()
		.all();

	console.log(`Inserted ${result.length} RSVPs!`);
	process.exit(0);
};

await seed();
