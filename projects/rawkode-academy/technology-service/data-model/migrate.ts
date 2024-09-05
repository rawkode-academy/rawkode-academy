import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

const client = createClient({
	url: import.meta.env.TURSO_URL as string,
	authToken: import.meta.env.TURSO_TOKEN,
});

const db = drizzle(client);

try {
	await migrate(db, {
		migrationsFolder: "./migrations",
	});
	console.log("Tables migrated!");
	client.close();
	process.exit(0);
} catch (err) {
	console.error("Error performing migration: ", err);
	client.close();
	process.exit(1);
}
