import { drizzle } from "drizzle-orm/libsql";
import { client } from "./client.ts";
import { showsTable } from "./schema.ts";

const db = drizzle(client);

const seed = async () => {
  await db
    .insert(showsTable)
    .values({
      id: "rawkode-live",
      name: "Rawkode Live",
    })
    .returning()
    .all();
	Deno.exit(0);
};

await seed();
