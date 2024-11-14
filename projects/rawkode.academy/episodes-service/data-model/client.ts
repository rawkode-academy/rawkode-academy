import { createClient } from '@libsql/client';

export const client = createClient({
	url: Deno.env.get('LIBSQL_URL') || '',
	authToken: Deno.env.get('LIBSQL_TOKEN'),
});
