import {
  type Context,
  endpoint,
  service,
  TerminalError,
} from "@restatedev/restate-sdk-cloudflare-workers/fetch";
import { eq } from "drizzle-orm";
import type { z } from "zod";
import { db } from "../data-model/client.js";
import { createTechnology } from "../data-model/integrations/zod.js";
import { technologiesTable } from "../data-model/schema.js";
import process from "node:process";

// This avoids using polyfilled node APIs
process.env.USE_WEB_CRYPTO = "true";

type T = z.infer<typeof createTechnology>;

const technologiesService = service({
  name: "technology",
  handlers: {
    create: async (ctx: Context, technology: T) => {
      try {
        createTechnology.parse(technology);
      } catch (e) {
        return {
          message: "Failed to create technology.",
          error: e,
        };
      }

      ctx.console.log(
        "Checking unique constraints are passing before writing to database",
      );

      const checks = await db
        .select()
        .from(technologiesTable)
        .where(eq(technologiesTable.id, technology.id));

      if (checks.length > 0) {
        throw new TerminalError(
          `New technology, ${technology.id}, does not pass unique ID constraints.`,
          { errorCode: 400 },
        );
      }

      await db.insert(technologiesTable).values(technology).run();

      return "Job done";
    },
  },
});

export default endpoint()
  .bind(technologiesService)
  .withIdentityV1(process.env.RESTATE_IDENTITY_KEY || "")
  .bidirectional()
  .handler();
