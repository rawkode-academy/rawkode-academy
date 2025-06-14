import { unstable_dev } from 'wrangler';
import { getSchema } from './schema';
import { printSchema } from 'graphql';
import { writeFileSync } from 'node:fs';

const worker = await unstable_dev('main.ts', {
	experimental: { disableExperimentalWarning: true },
});

// Mock D1 database for schema generation only
const mockEnv = {
	DB: {} as D1Database,
};

const schema = getSchema(mockEnv);
const sdl = printSchema(schema);

writeFileSync('schema.gql', sdl);

await worker.stop();