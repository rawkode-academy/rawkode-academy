import { unstable_dev } from 'wrangler';
import { getSchema } from './schema.ts';
import { printSchema } from 'graphql';

const worker = await unstable_dev('main.ts', {
	experimental: { disableExperimentalWarning: true },
});

const schema = getSchema();
const sdl = printSchema(schema);

console.log(sdl);

await worker.stop();