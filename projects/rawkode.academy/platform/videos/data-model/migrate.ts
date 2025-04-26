import { migrate } from "drizzle-orm/libsql/migrator";
import { getDatabase } from "./client.ts";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const db = getDatabase();

const main = async () => {
	const __dirname = dirname(fileURLToPath(import.meta.url));
	await migrate(db, {
		migrationsFolder: `${__dirname}/migrations`,
	});
};

try {
	await main();
} catch (err) {
	console.error("Error performing migration: ", err);
	process.exit(1);
}

console.log("Tables migrated!");
process.exit(0);
