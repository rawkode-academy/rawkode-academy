import type { Config } from 'drizzle-kit';

export default {
	schema: './schema.ts',
	out: './migrations',
	driver: 'libsql',
	dbCredentials: {
		url: 'file:emoji-reactions.db',
	},
} satisfies Config;