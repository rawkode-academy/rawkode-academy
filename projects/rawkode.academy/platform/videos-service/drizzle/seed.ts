import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { getSecrets } from "../utils/secrets";
import { videosTable } from "./schema";

const secrets = await getSecrets();

const client = createClient({
	url: secrets.tursoUrl,
	authToken: secrets.tursoToken,
});

export const db = drizzle(client);

const date = new Date();

const seed = async () => {
	await db
		.insert(videosTable)
		.values({
			id: "hands-on-docker-cloud-build",
			title: "Hands on Introduction to Docker Build Cloud",
			description: "Some Description",
			duration: 3600,
			publishedAt: date.toISOString(),
			type: "live-stream",
			visibility: "public",
			chapters: [
				{
					timestamp: "00:00:00",
					title: "Introduction",
				},
			],
			show: "rawkode-live",
		})
		.returning()
		.all();
	process.exit(0);
};

await seed();
