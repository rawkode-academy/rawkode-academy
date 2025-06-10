import { createYoga } from 'graphql-yoga';
import { getSchema } from './schema.ts';

const yoga = createYoga({
	schema: getSchema(),
	graphqlEndpoint: '/',
});

export default {
	fetch: yoga.fetch,
};