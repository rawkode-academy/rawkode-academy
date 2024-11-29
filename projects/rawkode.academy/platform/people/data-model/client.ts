import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as dataSchema from "../data-model/schema.ts";

const serviceName = Deno.env.get("SERVICE_NAME");
const libSqlUrl = Deno.env.get("LIBSQL_URL");
const libSqlBaseUrl = Deno.env.get("LIBSQL_BASE_URL");
const authToken = Deno.env.get("LIBSQL_TOKEN") || "";

const url = libSqlUrl || `https://${serviceName}-${libSqlBaseUrl}`;

const client = createClient({
  url,
  authToken,
});

export const db = drizzle(client, { schema: dataSchema });
