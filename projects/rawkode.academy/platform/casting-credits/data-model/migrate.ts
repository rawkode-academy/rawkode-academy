import { migrate } from "drizzle-orm/libsql/migrator";
import { dirname } from "node:path";
import { db } from "./client";

const main = async () => {
	await migrate(db, {
		migrationsFolder: `${dirname(import.meta.path)}/migrations`,
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
