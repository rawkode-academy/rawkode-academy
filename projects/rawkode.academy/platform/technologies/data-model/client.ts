import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as dataSchema from "../data-model/schema";

const serviceName = process.env.SERVICE_NAME;
const libSqlUrl = process.env.LIBSQL_URL;
const libSqlBaseUrl = process.env.LIBSQL_BASE_URL;
const authToken = process.env.LIBSQL_TOKEN;

const url = libSqlUrl || `https://${serviceName}-${libSqlBaseUrl}`;

const client = createClient({
	url,
	authToken,
});

export const db = drizzle(client, { schema: dataSchema });
