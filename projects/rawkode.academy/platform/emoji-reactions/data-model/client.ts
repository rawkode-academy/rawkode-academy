import { drizzle } from 'drizzle-orm/d1';
import { createClient } from '@libsql/client/web';
import * as schema from './schema.ts';

export const db = drizzle(
	createClient({
		url: 'file:emoji-reactions.db',
	}),
	{ schema },
);