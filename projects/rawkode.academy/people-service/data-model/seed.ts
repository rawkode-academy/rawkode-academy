import { drizzle } from "drizzle-orm/libsql";
import { client } from "./client.ts";
import { peopleTable } from "./schema.ts";

const db = drizzle(client);

const seed = async () => {
  await db
    .insert(peopleTable)
    .values({
      id: "1",
			forename: "Jack",
			surname: "O'Neill",
    })
    .returning()
		.all();

  Deno.exit(0);
};

await seed();
