import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { getSecrets } from "../utils/secrets";
import { eventsTable } from "./schema";

const secrets = await getSecrets();

const client = createClient({
	url: secrets.tursoUrl,
	authToken: secrets.tursoToken,
});

export const db = drizzle(client);

const date = new Date();

const seed = async () => {
	await db
		.insert(eventsTable)
		.values({
			id: "hands-on-docker-cloud-build",
			name: "Hands on Introduction to Docker Build Cloud",
			show: "rawkode-live",
			description: "Some Description",
			type: "live-stream",
			startsAt: date.toISOString(),
			endsAt: new Date(date.getTime() + 3600).toISOString(),
		})
		.returning()
		.all();
	process.exit(0);
};

await seed();
