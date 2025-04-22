import process from "node:process";
import { db } from "./client.ts";
import { videoGuestsTable } from "./schema.ts";

const seed = async () => {
  await db
    .insert(videoGuestsTable)
    .values({
      videoId: "video-id",
      guestId: "rawkode",
    })
    .returning()
    .all();

  process.exit(0);
};

await seed();
