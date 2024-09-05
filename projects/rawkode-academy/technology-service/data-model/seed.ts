import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { technologiesTable } from "./schema/index.ts";

const client = createClient({
	url: import.meta.env.TURSO_URL as string,
	authToken: import.meta.env.TURSO_TOKEN,
});

export const db = drizzle(client);

const seed = async () => {
	db.delete(technologiesTable).run();

	await db
		.insert(technologiesTable)
		.values({
			id: "kubernetes",
			name: "Kubernetes",
			description: "Kubernetes",
			license: "Apache-2.0",
			website: "https://kubernetes.io/",
			documentation: "https://kubernetes.io/docs/",
			sourceRepository: "https://github.com/kubernetes/kubernetes",
		})
		.returning()
		.all();
	process.exit(0);
};

await seed();
