import { lexicographicSortSchema, printSchema } from 'graphql';
import { getSchema } from './schema.ts';

const schemaAsString = printSchema(lexicographicSortSchema(getSchema()));

Deno.writeFileSync(
	`${import.meta.dirname}/schema.gql`,
	new TextEncoder().encode(schemaAsString),
);
