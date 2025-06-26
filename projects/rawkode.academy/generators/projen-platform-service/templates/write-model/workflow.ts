import {
  WorkflowEntrypoint,
  WorkflowStep,
  WorkflowEvent,
} from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import { z } from "zod";
import { createId } from "@paralleldrive/cuid2";
import { Create{{ graphqlTypeName }} } from "../data-model/integrations/zod.ts";
import { {{ tableName }} } from "../data-model/schema.ts";

export interface Env {
  DB: D1Database;
}

type Create{{ graphqlTypeName }}Params = z.infer<typeof Create{{ graphqlTypeName }}>;

export class {{ graphqlTypeName }}WriteWorkflow extends WorkflowEntrypoint<
  Env,
  Create{{ graphqlTypeName }}Params
> {
  async run(event: WorkflowEvent<Create{{ graphqlTypeName }}Params>, step: WorkflowStep) {
    const db = drizzle(this.env.DB);

    // Step 1: Validate input
    const validatedData = await step.do(
      "validate input",
      async () => {
        try {
          return Create{{ graphqlTypeName }}.parse(event.payload);
        } catch (error) {
          throw new Error(`Validation failed: ${error.message}`);
        }
      }
    );

    // Step 2: Generate ID and timestamps
    const recordData = await step.do(
      "prepare data",
      async () => {
        const now = new Date();
        return {
          id: createId(),
          ...validatedData,
          createdAt: now,
          updatedAt: now,
        };
      }
    );

    // Step 3: Insert into database with retry logic
    const result = await step.do(
      "insert into database",
      {
        retries: {
          limit: 3,
          delay: "1 second",
          backoff: "exponential",
        },
        timeout: "30 seconds",
      },
      async () => {
        try {
          const inserted = await db
            .insert({{ tableName }})
            .values(recordData)
            .returning()
            .get();
          
          return inserted;
        } catch (error) {
          throw new Error(`Database insert failed: ${error.message}`);
        }
      }
    );

    // Step 4: Post-processing
    await step.do(
      "post-processing",
      async () => {
        console.log(`Successfully created {{ graphqlTypeName }} with ID: ${result.id}`);
      }
    );

    return {
      success: true,
      data: result,
    };
  }
}