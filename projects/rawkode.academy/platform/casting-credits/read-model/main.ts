import { useSentry } from '@envelop/sentry';
import * as Sentry from '@sentry/deno';
import '@sentry/tracing';
import { createYoga } from 'graphql-yoga';
import { getSchema } from './schema.ts';

if (Deno.env.get('SENTRY_DSN')) {
	Sentry.init({
		dsn: Deno.env.get('SENTRY_DSN'),
		environment: 'production',
		tracesSampleRate: 1.0,
	});
	console.debug('Sentry is enabled');
}

const yoga = createYoga({
	schema: getSchema(),
	plugins: [
		useSentry({
			includeRawResult: false,
			includeExecuteVariables: true,
		}),
	],
	graphqlEndpoint: '/',
});

const port = Deno.env.get('PORT') || '8000';

Deno.serve({
	port: Number(port),
	onListen: ({ hostname, port, transport }) => {
		console.log(`Listening on ${transport}://${hostname}:${port}`);
	},
}, yoga.fetch);
