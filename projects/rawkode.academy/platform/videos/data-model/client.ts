import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as dataSchema from "../data-model/schema.ts";
import process from "node:process";

export const getDatabase = () => {
	const serviceName = process.env.SERVICE_NAME;
	const libSqlUrl = process.env.LIBSQL_URL;
	const libSqlBaseUrl = process.env.LIBSQL_BASE_URL;
	const authToken = process.env.LIBSQL_TOKEN;

	const url = libSqlUrl || `https://${serviceName}-${libSqlBaseUrl}`;

	console.error("LibSQL URL:", url);

	const client = createClient({
		url,
		authToken,
	});

	return drizzle(client, { schema: dataSchema });
};
