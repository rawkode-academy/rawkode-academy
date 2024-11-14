import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { client } from './client.ts';

const db = drizzle(client);

const main = async () => {
	await migrate(db, {
		migrationsFolder: `${import.meta.dirname}/migrations`,
	});
};

try {
	await main();
} catch (err) {
	console.error('Error performing migration: ', err);
	client.close();
	Deno.exit(1);
}

client.close();
console.log('Tables migrated!');
Deno.exit(0);
