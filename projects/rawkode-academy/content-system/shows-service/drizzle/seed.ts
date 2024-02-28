import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { showsTable } from "./schema";

const client = createClient({
	url: process.env.TURSO_URL as string,
	authToken: process.env.TURSO_TOKEN as string,
});

export const db = drizzle(client);

const seed = async () => {
	const result = await db
		.insert(showsTable)
		.values({
			id: "rawkode-live",
			name: "Rawkode Live",
		})
		.returning()
		.all();
	process.exit(0);
};

await seed();
