import process from "node:process";
import { db } from "./client.ts";
import { videoTechnologiesTable } from "./schema.ts";

const seed = async () => {
  await db
    .insert(videoTechnologiesTable)
    .values({
      videoId: "video-id",
      technologyId: "kubernetes",
    })
    .returning()
    .all();

  process.exit(0);
};

await seed();
