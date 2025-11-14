/**
 * Migration Script: Update Emoji Reactions with Canonical Person IDs
 *
 * This script migrates existing emoji reactions from legacy Zitadel subject IDs
 * to canonical Better Auth user IDs using the legacy_identity mapping table.
 *
 * Usage:
 *   bun run data-model/migrate-person-ids.ts
 *
 * Environment Variables Required:
 *   CLOUDFLARE_ACCOUNT_ID - Your Cloudflare account ID
 *   CLOUDFLARE_API_TOKEN - API token with D1 database access
 *   REACTIONS_DATABASE_ID - D1 database ID for emoji-reactions
 *   AUTH_DATABASE_ID - D1 database ID for authentication
 */

import type { D1Database } from "@cloudflare/workers-types";

interface MigrationStats {
  total: number;
  migrated: number;
  skipped: number;
  failed: number;
  errors: string[];
}

/**
 * Migrate person IDs in the emoji_reactions table
 */
export async function migrateEmojiReactionPersonIds(
  reactionsDb: D1Database,
  authDb: D1Database,
  dryRun = false
): Promise<MigrationStats> {
  const stats: MigrationStats = {
    total: 0,
    migrated: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  console.log(`Starting emoji reactions person ID migration (dry run: ${dryRun})...`);

  try {
    // Step 1: Get all unique person IDs from emoji_reactions that look like legacy IDs
    // Legacy IDs are NOT UUIDs (don't match the UUID pattern)
    const legacyPersonIdsResult = await reactionsDb
      .prepare(`
        SELECT DISTINCT person_id
        FROM emoji_reactions
        WHERE person_id NOT LIKE '%-%-%-%-%'
      `)
      .all<{ person_id: string }>();

    const legacyPersonIds = legacyPersonIdsResult.results || [];
    stats.total = legacyPersonIds.length;

    console.log(`Found ${stats.total} unique legacy person IDs to migrate`);

    if (stats.total === 0) {
      console.log("No legacy person IDs found. Migration complete.");
      return stats;
    }

    // Step 2: Build a mapping of legacy IDs to canonical user IDs
    const idMapping = new Map<string, string>();

    // Query in batches of 100 to avoid query length limits
    const batchSize = 100;
    for (let i = 0; i < legacyPersonIds.length; i += batchSize) {
      const batch = legacyPersonIds.slice(i, i + batchSize);
      const placeholders = batch.map(() => '?').join(',');

      const mappingResult = await authDb
        .prepare(`
          SELECT legacy_subject, user_id
          FROM legacy_identity
          WHERE legacy_provider = 'zitadel'
          AND legacy_subject IN (${placeholders})
        `)
        .bind(...batch.map(row => row.person_id))
        .all<{ legacy_subject: string; user_id: string }>();

      if (mappingResult.results) {
        for (const row of mappingResult.results) {
          idMapping.set(row.legacy_subject, row.user_id);
        }
      }
    }

    console.log(`Resolved ${idMapping.size} legacy IDs to canonical user IDs`);

    // Step 3: Update reactions with resolved person IDs
    for (const { person_id: legacyId } of legacyPersonIds) {
      const canonicalId = idMapping.get(legacyId);

      if (!canonicalId) {
        stats.failed++;
        stats.errors.push(`No mapping found for legacy ID: ${legacyId}`);
        console.warn(`⚠️  Cannot resolve: ${legacyId}`);
        continue;
      }

      if (legacyId === canonicalId) {
        stats.skipped++;
        console.log(`⏭️  Skipped (already canonical): ${legacyId}`);
        continue;
      }

      if (!dryRun) {
        try {
          // Update all reactions with this legacy person ID
          const updateResult = await reactionsDb
            .prepare(`
              UPDATE emoji_reactions
              SET person_id = ?
              WHERE person_id = ?
            `)
            .bind(canonicalId, legacyId)
            .run();

          stats.migrated++;
          console.log(`✅ Migrated: ${legacyId} -> ${canonicalId} (${updateResult.meta.changes} reactions)`);
        } catch (error) {
          stats.failed++;
          const errorMsg = error instanceof Error ? error.message : String(error);
          stats.errors.push(`Failed to update ${legacyId}: ${errorMsg}`);
          console.error(`❌ Failed: ${legacyId} - ${errorMsg}`);
        }
      } else {
        stats.migrated++;
        console.log(`[DRY RUN] Would migrate: ${legacyId} -> ${canonicalId}`);
      }
    }

    console.log('\nMigration Summary:');
    console.log(`  Total legacy IDs: ${stats.total}`);
    console.log(`  Migrated: ${stats.migrated}`);
    console.log(`  Skipped: ${stats.skipped}`);
    console.log(`  Failed: ${stats.failed}`);

    if (stats.errors.length > 0) {
      console.log('\nErrors:');
      stats.errors.forEach(err => console.log(`  - ${err}`));
    }

    return stats;
  } catch (error) {
    console.error('Migration failed with error:', error);
    throw error;
  }
}

/**
 * CLI entry point
 */
if (import.meta.main) {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  const reactionsDatabaseId = process.env.REACTIONS_DATABASE_ID;
  const authDatabaseId = process.env.AUTH_DATABASE_ID;
  const dryRun = process.env.DRY_RUN === 'true';

  if (!accountId || !apiToken || !reactionsDatabaseId || !authDatabaseId) {
    console.error('Missing required environment variables:');
    console.error('  CLOUDFLARE_ACCOUNT_ID');
    console.error('  CLOUDFLARE_API_TOKEN');
    console.error('  REACTIONS_DATABASE_ID');
    console.error('  AUTH_DATABASE_ID');
    console.error('\nOptional:');
    console.error('  DRY_RUN=true (for dry run mode)');
    process.exit(1);
  }

  console.log('Environment:');
  console.log(`  Account ID: ${accountId}`);
  console.log(`  Reactions DB: ${reactionsDatabaseId}`);
  console.log(`  Auth DB: ${authDatabaseId}`);
  console.log(`  Dry Run: ${dryRun}`);
  console.log();

  // Note: This script requires a D1 HTTP client implementation
  // You'll need to use wrangler or implement a D1 HTTP client
  console.error('This script requires implementation of D1 HTTP client or use of wrangler CLI');
  console.error('Please run migrations using: wrangler d1 execute');
  process.exit(1);
}
