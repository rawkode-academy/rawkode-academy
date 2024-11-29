import type { Config } from 'drizzle-kit';

export default ({
	schema: './schema.ts',
	out: './migrations',
	dialect: 'turso',
	breakpoints: true,
	strict: true,
	verbose: true,
} satisfies Config);
