import { drizzle } from "drizzle-orm/libsql";
import { client } from "./client";
import { showsTable } from "./schema";

const db = drizzle(client);

const seed = async () => {
	await db
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
