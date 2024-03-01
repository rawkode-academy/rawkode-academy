import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { showHostsTable } from "./schema";

const client = createClient({
	url: process.env.TURSO_URL as string,
	authToken: process.env.TURSO_TOKEN as string,
});

export const db = drizzle(client);

const seed = async () => {
	await db
		.insert(showHostsTable)
		.values({
			showId: "rawkode-live",
			hostId: "rawkode",
		})
		.returning()
		.all();
	process.exit(0);
};

await seed();
