import {
  type Context,
  endpoint,
  service,
  TerminalError,
} from "@restatedev/restate-sdk/fetch";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../data-model/client.ts";
import { CreatePerson } from "../data-model/integrations/zod.ts";
import { peopleTable } from "../data-model/schema.ts";

// This avoids using polyfilled node APIs
Deno.env.set("USE_WEB_CRYPTO", "true");

type T = z.infer<typeof CreatePerson>;

const peopleService = service({
  name: "person",
  handlers: {
    create: async (ctx: Context, person: T) => {
      try {
        CreatePerson.parse(person);
      } catch (e) {
        return {
          message: "Failed to create person.",
          error: e,
        };
      }

      ctx.console.log(
        "Checking unique constraints are passing before writing to database",
      );

      const checks = await db.select().from(peopleTable).where(
        eq(peopleTable.id, person.id),
      );

      if (checks.length > 0) {
        throw new TerminalError(
          `New person, ${person.id}, does not pass unique ID constraints.`,
          { errorCode: 400 },
        );
      }

      await db
        .insert(peopleTable)
        .values(person)
        .run();

      return "Job done";
    },
  },
});

// We allow this to be empty because of how deno deploy works
const restateIdentityKey = Deno.env.get("RESTATE_IDENTITY_KEY") || "";

// and because of ^^ we set a fake key for the "first" deploy
// YES, THIS SUCKS.
const handler = endpoint().bind(peopleService).withIdentityV1(
  restateIdentityKey ||
    "publickeyv1_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
).bidirectional().handler();

const port = Deno.env.get("PORT") || "9080";

Deno.serve({
  port: Number(port),
  onListen: ({ hostname, port, transport }) => {
    console.log(`Listening on ${transport}://${hostname}:${port}`);
  },
}, handler.fetch);
