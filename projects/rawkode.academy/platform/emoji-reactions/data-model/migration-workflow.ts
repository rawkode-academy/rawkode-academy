/**
 * Cloudflare Workflow for Migrating Emoji Reaction Person IDs
 *
 * This workflow migrates existing emoji reactions from legacy Zitadel subject IDs
 * to canonical Better Auth user IDs. It runs as a durable workflow to handle
 * large datasets and ensure reliability.
 *
 * Deploy this as a separate worker and trigger it once after deploying the
 * updated authentication schema with legacy_identity table.
 */

import {
  WorkflowEntrypoint,
  WorkflowStep,
  type WorkflowEvent,
} from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import { sql } from "drizzle-orm";
import { emojiReactionsTable } from "./schema";
import { batchResolvePersonIds, isLegacyId } from "./personId-resolver";

export interface Env {
  DB: D1Database;
  AUTH_DB: D1Database;
}

export interface MigrationParams {
  batchSize?: number;
  dryRun?: boolean;
}

export interface MigrationResult {
  total: number;
  migrated: number;
  skipped: number;
  failed: number;
  errors: string[];
}

export class MigratePersonIdsWorkflow extends WorkflowEntrypoint<
  Env,
  MigrationParams
> {
  async run(
    event: WorkflowEvent<MigrationParams>,
    step: WorkflowStep
  ): Promise<MigrationResult> {
    const batchSize = event.payload.batchSize ?? 100;
    const dryRun = event.payload.dryRun ?? false;

    const result: MigrationResult = {
      total: 0,
      migrated: 0,
      skipped: 0,
      failed: 0,
      errors: [],
    };

    // Step 1: Get all unique legacy person IDs
    const legacyIds = await step.do("fetchLegacyPersonIds", async () => {
      const db = drizzle(this.env.DB);

      const rows = await db
        .select({ personId: emojiReactionsTable.personId })
        .from(emojiReactionsTable)
        .groupBy(emojiReactionsTable.personId)
        .all();

      // Filter to only legacy IDs (non-UUID format)
      const legacy = rows
        .map((row) => row.personId)
        .filter((id) => isLegacyId(id));

      console.log(`Found ${legacy.length} unique legacy person IDs`);
      return legacy;
    });

    result.total = legacyIds.length;

    if (legacyIds.length === 0) {
      console.log("No legacy person IDs found. Migration complete.");
      return result;
    }

    // Step 2: Resolve all legacy IDs to canonical user IDs
    const idMapping = await step.do("resolvePersonIds", async () => {
      const mapping = await batchResolvePersonIds(legacyIds, this.env.AUTH_DB);

      console.log(`Resolved ${mapping.size} legacy IDs to canonical user IDs`);
      return Object.fromEntries(mapping);
    });

    // Step 3: Update reactions in batches
    const batches = Math.ceil(legacyIds.length / batchSize);

    for (let i = 0; i < batches; i++) {
      const batchResult = await step.do(
        `migrateBatch-${i}`,
        {
          retries: {
            limit: 3,
            delay: "5 seconds",
            backoff: "exponential",
          },
        },
        async () => {
          const start = i * batchSize;
          const end = Math.min(start + batchSize, legacyIds.length);
          const batchIds = legacyIds.slice(start, end);

          const batchStats = {
            migrated: 0,
            skipped: 0,
            failed: 0,
            errors: [] as string[],
          };

          for (const legacyId of batchIds) {
            const canonicalId = idMapping[legacyId];

            if (!canonicalId) {
              batchStats.failed++;
              batchStats.errors.push(
                `No mapping found for legacy ID: ${legacyId}`
              );
              continue;
            }

            if (legacyId === canonicalId) {
              batchStats.skipped++;
              continue;
            }

            if (!dryRun) {
              try {
                const db = drizzle(this.env.DB);

                await db
                  .update(emojiReactionsTable)
                  .set({ personId: canonicalId })
                  .where(sql`${emojiReactionsTable.personId} = ${legacyId}`)
                  .run();

                batchStats.migrated++;
                console.log(`Migrated: ${legacyId} -> ${canonicalId}`);
              } catch (error) {
                batchStats.failed++;
                const errorMsg =
                  error instanceof Error ? error.message : String(error);
                batchStats.errors.push(
                  `Failed to update ${legacyId}: ${errorMsg}`
                );
              }
            } else {
              batchStats.migrated++;
              console.log(`[DRY RUN] Would migrate: ${legacyId} -> ${canonicalId}`);
            }
          }

          return batchStats;
        }
      );

      // Aggregate batch results
      result.migrated += batchResult.migrated;
      result.skipped += batchResult.skipped;
      result.failed += batchResult.failed;
      result.errors.push(...batchResult.errors);
    }

    // Step 4: Generate summary report
    await step.do("generateReport", async () => {
      console.log("\n=== Migration Summary ===");
      console.log(`Total legacy IDs: ${result.total}`);
      console.log(`Migrated: ${result.migrated}`);
      console.log(`Skipped: ${result.skipped}`);
      console.log(`Failed: ${result.failed}`);

      if (result.errors.length > 0) {
        console.log("\nErrors:");
        result.errors.forEach((err) => console.log(`  - ${err}`));
      }

      return result;
    });

    return result;
  }
}
