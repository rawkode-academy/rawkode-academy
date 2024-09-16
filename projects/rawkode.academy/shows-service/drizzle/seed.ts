import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { getSecrets } from "../utils/secrets";
import { showsTable } from "./schema";

const secrets = await getSecrets();

const client = createClient({
	url: secrets.tursoUrl,
	authToken: secrets.tursoToken,
});

export const db = drizzle(client);

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
