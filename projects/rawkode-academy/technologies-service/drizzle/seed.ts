import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { technologiesTable } from "./schema";
import { getSecrets } from "../utils/secrets";

const secrets = await getSecrets();

const client = createClient({
	url: secrets.tursoUrl,
	authToken: secrets.tursoToken,
});

export const db = drizzle(client);

const seed = async () => {
	await db
		.insert(technologiesTable)
		.values({
			id: "kubernetes",
			name: "Kubernetes",
			description: "Kubernetes",
			license: "Apache-2.0",
			websiteUrl: "https://kubernetes.io/",
			documentationUrl: "https://kubernetes.io/docs/",
			githubRepository: "https://github.com/kubernetes/kubernetes",
		})
		.returning()
		.all();
	process.exit(0);
};

await seed();
