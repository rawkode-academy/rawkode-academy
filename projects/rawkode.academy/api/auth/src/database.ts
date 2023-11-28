import { Client, createClient } from '@libsql/client';
import * as schema from '../drizzle/schema';
import { LibSQLDatabase, drizzle } from 'drizzle-orm/libsql';
import { QueryBuilder } from 'drizzle-orm/sqlite-core';

export const qb = new QueryBuilder();

function getDbInstance() {
	let drizzleClient: LibSQLDatabase<typeof schema>;
	let libSQLClient: Client;

	return function initiateDB(url = '', authToken = '') {
		if (!libSQLClient || !drizzleClient) {
			console.log('new Instance');
			try {
				(libSQLClient = createClient({
					url,
					authToken,
				})),
					(drizzleClient = drizzle(libSQLClient, { schema }));
			} catch (e) {
				console.log('failed to connect to database');
			}

			return { drizzleClient, libSQLClient };
		}

		return { drizzleClient, libSQLClient };
	};
}

export default getDbInstance();
