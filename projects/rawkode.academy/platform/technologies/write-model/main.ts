import {
  type Context,
  endpoint,
  service,
  TerminalError,
} from "@restatedev/restate-sdk/fetch";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../data-model/client.ts";
import { CreateTechnology } from "../data-model/integrations/zod.ts";
import { technologiesTable } from "../data-model/schema.ts";

// This avoids using polyfilled node APIs
Deno.env.set("USE_WEB_CRYPTO", "true");

type T = z.infer<typeof CreateTechnology>;

const technologiesService = service({
  name: "technology",
  handlers: {
    create: async (ctx: Context, technology: T) => {
      try {
        CreateTechnology.parse(technology);
      } catch (e) {
        return {
          message: "Failed to create technology.",
          error: e,
        };
      }

      ctx.console.log(
        "Checking unique constraints are passing before writing to database",
      );

      const checks = await db.select().from(technologiesTable).where(
        eq(technologiesTable.id, technology.id),
      );

      if (checks.length > 0) {
        throw new TerminalError(
          `New technology, ${technology.id}, does not pass unique ID constraints.`,
          { errorCode: 400 },
        );
      }

      await db
        .insert(technologiesTable)
        .values(technology)
        .run();

      return "Job done";
    },
  },
});

const handler = endpoint().bind(technologiesService).withIdentityV1(
  Deno.env.get("RESTATE_IDENTITY_KEY") || "",
).bidirectional().handler();

Deno.serve(
  { port: parseInt(Deno.env.get("PORT") || "9080", 10) },
  handler.fetch,
);
