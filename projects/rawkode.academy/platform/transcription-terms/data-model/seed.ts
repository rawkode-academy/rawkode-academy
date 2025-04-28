import process from "node:process";
import { db } from "./client.ts";
import { transcriptionTerms } from "./schema.ts";

const seed = async () => {
  await db
    .insert(transcriptionTerms)
    .values({
      foreignId: "kubernetes",
      term: "k8s",
    })
    .returning()
    .all();
  process.exit(0);
};

await seed();
