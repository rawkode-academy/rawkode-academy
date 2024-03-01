import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { getSecrets } from "../utils/secrets";

const secrets = await getSecrets();

const client = createClient({
	url: secrets.tursoUrl,
	authToken: secrets.tursoToken,
});

const db = drizzle(client);

const main = async () => {
	await migrate(db, {
		migrationsFolder: "./migrations",
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
