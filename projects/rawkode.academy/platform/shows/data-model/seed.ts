import { db } from "./client.ts";
import { showsTable } from "./schema.ts";

const seed = async () => {
	await db
		.insert(showsTable)
		.values({
			id: "rawkode-live",
			name: "Rawkode Live",
		})
		.returning()
		.all();
	Deno.exit(0);
};

await seed();
