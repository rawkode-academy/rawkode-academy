import { createClient } from '@libsql/client/web';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';

const client = createClient({
	url: 'file:emoji-reactions.db',
});

const db = drizzle(client);

await migrate(db, {
	migrationsFolder: './migrations',
});

console.log('Migrations complete');

await client.close();