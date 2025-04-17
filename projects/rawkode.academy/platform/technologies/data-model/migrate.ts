import { migrate } from "drizzle-orm/libsql/migrator";
import { db } from "./client";

const main = async () => {
	await migrate(db, {
		migrationsFolder: `${import.meta.dirname}/migrations`,
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
