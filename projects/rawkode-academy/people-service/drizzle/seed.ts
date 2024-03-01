import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { getSecrets } from "../utils/secrets";
import { peopleTable } from "./schema";

const secrets = await getSecrets();

const client = createClient({
	url: secrets.tursoUrl,
	authToken: secrets.tursoToken,
});

export const db = drizzle(client);

const seed = async () => {
	await db
		.insert(peopleTable)
		.values({
			id: "rawkode-live",
			forename: "David",
			surname: "Flanagan",
		})
		.returning()
		.all();
	process.exit(0);
};

await seed();
