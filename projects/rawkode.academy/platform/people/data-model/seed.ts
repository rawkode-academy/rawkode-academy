import { db } from "./client.ts";
import { peopleTable } from "./schema.ts";

const seed = async () => {
  await db
    .insert(peopleTable)
    .values({
      forename: "David",
      surname: "Flanagan",
    })
    .returning()
    .all();

  Deno.exit(0);
};

await seed();
