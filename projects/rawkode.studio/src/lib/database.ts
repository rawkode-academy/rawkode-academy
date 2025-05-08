import { createClient } from "@libsql/client";
import { TURSO_AUTH_TOKEN, TURSO_URL } from "astro:env/server";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "@/schema";

export const turso = createClient({
  url: TURSO_URL,
  authToken: TURSO_AUTH_TOKEN,
});

export const database = drizzle(turso, { schema });
