import { TURSO_AUTH_TOKEN, TURSO_URL } from "astro:env/server";
import * as schema from "@/schema";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";

export const turso = createClient({
  url: TURSO_URL,
  authToken: TURSO_AUTH_TOKEN,
});

export const database = drizzle(turso, { schema });
