import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

const client = createClient({
	url: process.env.TURSO_URL as string,
	authToken: process.env.TURSO_AUTH_TOKEN as string,
});

const db = drizzle(client);

const main = async () => {
	await migrate(db, {
		migrationsFolder: "./drizzle/migrations",
	});
};

try {
	await main();
} catch (err) {
	console.error("Error performing migration: ", err);
	client.close();
	process.exit(1);
}

client.close();
console.log("Tables migrated!");
process.exit(0);
