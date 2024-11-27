import type { Config } from 'drizzle-kit';

export default ({
	schema: './schema.ts',
	out: './migrations',
	driver: 'turso',
	dialect: 'sqlite',
	breakpoints: true,
	strict: true,
	verbose: true,
} satisfies Config);
