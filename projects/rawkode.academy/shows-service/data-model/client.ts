import { createClient } from "@libsql/client";

export const client = createClient({
	url: import.meta.env.LIBSQL_URL as string,
	authToken: import.meta.env.LIBSQL_TOKEN as string,
});
