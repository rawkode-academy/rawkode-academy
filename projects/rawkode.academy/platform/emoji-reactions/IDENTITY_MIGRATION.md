# Identity Continuity Solution for Emoji Reactions

## Problem Statement

During the migration from Zitadel to Better Auth, the emoji reactions system faced an identity continuity issue:

- **Legacy IDs (Zitadel)**: Long alphanumeric strings (e.g., `"274469097178030081"`)
- **New IDs (Better Auth)**: UUIDs (e.g., `"550e8400-e29b-41d4-a716-446655440000"`)

Without a mapping between these identifiers, users would lose access to their historical reactions when switching to Better Auth authentication.

## Solution Architecture

The solution implements a comprehensive identity mapping and resolution system across three layers:

### 1. Identity Mapping Table (`legacy_identity`)

**Location**: `platform/authentication/data-model/schema.ts`

A new table in the authentication service stores mappings between legacy Zitadel subject IDs and canonical Better Auth user IDs:

```typescript
export const legacyIdentity = sqliteTable("legacy_identity", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id),
  legacyProvider: text("legacy_provider").notNull(), // e.g., "zitadel"
  legacySubject: text("legacy_subject").notNull(),   // Zitadel's sub ID
  migratedAt: integer("migrated_at", { mode: "timestamp_ms" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});
```

**Unique Index**: `(legacy_provider, legacy_subject)` ensures one-to-one mapping.

### 2. PersonId Resolution Service

**Location**: `platform/emoji-reactions/data-model/personId-resolver.ts`

Provides utilities to resolve person IDs across the migration:

#### Core Functions

**`isLegacyId(personId: string): boolean`**
- Determines if a personId is a legacy Zitadel ID or Better Auth UUID
- Uses UUID pattern matching (8-4-4-4-12 format)

**`resolvePersonId(personId: string, authDb: D1Database): Promise<string>`**
- Resolves a legacy person ID to canonical Better Auth user ID
- Returns Better Auth UUIDs unchanged
- Queries `legacy_identity` table for legacy IDs
- Throws error if legacy ID cannot be resolved

**`batchResolvePersonIds(personIds: string[], authDb: D1Database): Promise<Map<string, string>>`**
- Efficiently resolves multiple person IDs in a single database query
- Separates Better Auth UUIDs (returned as-is) from legacy IDs
- Performs batch lookup for legacy IDs
- Gracefully handles unmapped IDs (warns but continues)

**`normalizePersonId(personId: string, authDb: D1Database): Promise<string>`**
- Convenience wrapper that handles errors gracefully
- Returns original ID if resolution fails (backward compatibility)

### 3. Updated Write Workflow

**Location**: `platform/emoji-reactions/write-model/reactToContent.ts`

The Cloudflare Workflow now performs two durable steps:

#### Step 1: Resolve PersonId
```typescript
const canonicalPersonId = await step.do('resolvePersonId', async () => {
  const { personId } = event.payload;
  return await normalizePersonId(personId, this.env.AUTH_DB);
});
```

#### Step 2: Persist Reaction
```typescript
await step.do('persistReactionToD1', async () => {
  await db.insert(emojiReactionsTable).values({
    contentId,
    personId: canonicalPersonId, // Uses canonical Better Auth UUID
    emoji,
    reactedAt: new Date(),
    contentTimestamp: contentTimestamp ?? 0,
  });
});
```

**Benefits of Durable Steps**:
- ID resolution is retried on failure
- Canonical ID is persisted in workflow state
- No risk of partial writes

### 4. Migration Workflow

**Location**: `platform/emoji-reactions/data-model/migration-workflow.ts`

A dedicated Cloudflare Workflow for migrating existing reactions:

```typescript
export class MigratePersonIdsWorkflow extends WorkflowEntrypoint<Env, MigrationParams>
```

**Workflow Steps**:
1. **Fetch Legacy Person IDs**: Query all non-UUID personIds from `emoji_reactions`
2. **Resolve Person IDs**: Batch resolve all legacy IDs via `legacy_identity` table
3. **Migrate in Batches**: Update reactions in batches of 100 with retry logic
4. **Generate Report**: Produce migration summary (total, migrated, skipped, failed)

**Features**:
- Dry-run mode (`dryRun: true`) for testing
- Configurable batch size
- Exponential backoff retry (3 attempts, 5s delay)
- Detailed error tracking

### 5. Read Model Updates

**Location**: `platform/emoji-reactions/read-model/schema.ts`

The GraphQL read model queries now work seamlessly because:
- New reactions are written with canonical Better Auth UUIDs
- Old reactions are migrated to canonical UUIDs via migration workflow
- Queries use the personId directly (which is now always canonical)

No changes needed to `hasUserReacted` or `getEmojiReactionsForContent` logic.

## Database Migrations

### Authentication Service

**Migration 1**: Create `legacy_identity` table
```bash
platform/authentication/data-model/migrations/0001_add_legacy_identity.sql
```

**Migration 2**: Populate mappings from existing OAuth accounts
```bash
platform/authentication/data-model/migrations/0002_populate_legacy_identities.sql
```

This extracts Zitadel account IDs from the `account` table and creates legacy identity mappings.

### Emoji Reactions Service

**Migration**: Update existing reactions with canonical person IDs

Run the migration workflow:
```typescript
// Trigger migration workflow
const instance = await env.MIGRATE_PERSON_IDS_WORKFLOW.create({
  params: {
    batchSize: 100,
    dryRun: false, // Set true for dry run
  },
});
```

Or use the TypeScript migration script (requires custom D1 client):
```bash
CLOUDFLARE_ACCOUNT_ID=xxx \
CLOUDFLARE_API_TOKEN=xxx \
REACTIONS_DATABASE_ID=xxx \
AUTH_DATABASE_ID=xxx \
bun run data-model/migrate-person-ids.ts
```

## Deployment Steps

Follow these steps in order to ensure zero data loss:

### Phase 1: Authentication Service Setup
1. Deploy authentication schema with `legacy_identity` table
2. Run migration 0001 to create table
3. Run migration 0002 to populate mappings from existing accounts

**Verification**:
```sql
SELECT COUNT(*) FROM legacy_identity;
-- Should match number of OAuth users
```

### Phase 2: Update Emoji Reactions Write Path
1. Deploy updated `reactToContent.ts` workflow with personId resolution
2. Configure `AUTH_DB` binding in `wrangler.toml`:
   ```toml
   [[d1_databases]]
   binding = "AUTH_DB"
   database_name = "authentication-db"
   database_id = "your-auth-db-id"
   ```
3. Deploy emoji-reactions write-model service

**Verification**:
```bash
# Test adding reaction with Better Auth UUID
curl -X POST https://emoji-reactions.your-domain.com/ \
  -H "Content-Type: application/json" \
  -d '{
    "contentId": "video-123",
    "personId": "550e8400-e29b-41d4-a716-446655440000",
    "emoji": "👍"
  }'
```

### Phase 3: Migrate Existing Reactions
1. Deploy migration workflow
2. Trigger migration in dry-run mode first:
   ```typescript
   const dryRun = await env.MIGRATE_PERSON_IDS_WORKFLOW.create({
     params: { dryRun: true },
   });
   const status = await dryRun.status();
   console.log(status); // Review migration plan
   ```
3. Run actual migration:
   ```typescript
   const migration = await env.MIGRATE_PERSON_IDS_WORKFLOW.create({
     params: { dryRun: false },
   });
   ```
4. Monitor workflow logs and status

**Verification**:
```sql
-- Check that all person IDs are now UUIDs
SELECT
  COUNT(*) as total_reactions,
  SUM(CASE WHEN person_id LIKE '%-%-%-%-%' THEN 1 ELSE 0 END) as canonical_ids,
  SUM(CASE WHEN person_id NOT LIKE '%-%-%-%-%' THEN 1 ELSE 0 END) as legacy_ids
FROM emoji_reactions;
-- legacy_ids should be 0 after migration
```

### Phase 4: Frontend Verification
1. Verify website frontend sends Better Auth user IDs in reactions
2. Check that users see their historical reactions after migration
3. Test adding new reactions with Better Auth authentication

## Error Handling

### Unmapped Legacy IDs

If the migration encounters legacy IDs without mappings in `legacy_identity`:

**Behavior**:
- `resolvePersonId()`: Throws error
- `normalizePersonId()`: Returns original ID and logs warning
- Migration workflow: Marks as failed, logs error, continues processing

**Resolution**:
1. Identify unmapped IDs from migration logs
2. Manually create mappings in `legacy_identity` if possible:
   ```sql
   INSERT INTO legacy_identity (id, user_id, legacy_provider, legacy_subject)
   VALUES (
     lower(hex(randomblob(16))),
     'canonical-user-id',
     'zitadel',
     'unmapped-legacy-id'
   );
   ```
3. Re-run migration workflow

### Partial Migration State

During migration, the system gracefully handles mixed ID formats:

- **Write path**: Always normalizes to canonical UUID
- **Read path**: Queries by canonical UUID (works for both migrated and new reactions)
- **No data loss**: Unmapped IDs remain queryable until resolved

## Testing

### Unit Tests

```bash
bun test platform/emoji-reactions/tests/personId-resolver.test.ts
```

Tests cover:
- Legacy ID detection (`isLegacyId`)
- Single ID resolution (`resolvePersonId`)
- Batch resolution (`batchResolvePersonIds`)
- Error handling (`normalizePersonId`)

### Integration Tests

```bash
bun test platform/emoji-reactions/tests/integration/identity-continuity.test.ts
```

Tests verify:
- Reaction preservation across migration
- New reactions with Better Auth UUIDs
- Correct aggregation across ID formats
- Handling of unmapped IDs

### Manual Testing Checklist

- [ ] User with legacy reactions can see them after migration
- [ ] User can add new reactions with Better Auth
- [ ] Reaction counts are accurate (no duplicates)
- [ ] `hasReacted` query works correctly
- [ ] Migration workflow completes without errors
- [ ] No duplicate reactions after ID normalization

## Monitoring

### Key Metrics

1. **Migration Progress**:
   ```sql
   SELECT
     COUNT(*) as total,
     SUM(CASE WHEN person_id LIKE '%-%-%-%-%' THEN 1 ELSE 0 END) as migrated
   FROM emoji_reactions;
   ```

2. **Unmapped IDs**:
   ```sql
   SELECT DISTINCT person_id
   FROM emoji_reactions
   WHERE person_id NOT LIKE '%-%-%-%-%'
   AND person_id NOT IN (SELECT legacy_subject FROM legacy_identity);
   ```

3. **Reaction Write Success Rate**:
   - Monitor workflow logs for `resolvePersonId` failures
   - Track error rates in emoji-reactions service

### Cloudflare Dashboard

- Workflow execution logs: Check for errors in `ReactToContentWorkflow`
- D1 query performance: Monitor `legacy_identity` lookup latency
- Worker error rates: Alert on personId resolution failures

## Rollback Plan

If critical issues arise:

1. **Revert write workflow** to original (without personId resolution)
2. **Keep legacy_identity table** intact for future migration attempt
3. **Investigate failures** using workflow logs and D1 query traces
4. **Fix mappings** or resolution logic as needed
5. **Re-deploy** updated solution

**Note**: Do NOT drop `legacy_identity` table, as it contains valuable mapping data.

## Future Enhancements

1. **Automatic Mapping Creation**: When users first sign in with Better Auth, automatically create legacy_identity mapping if their OAuth account ID matches a Zitadel sub
2. **Legacy ID Deprecation**: After successful migration, add database constraint to enforce UUID format for new person IDs
3. **Analytics**: Track migration success rate and identify patterns in unmapped IDs
4. **Performance Optimization**: Cache frequently accessed legacy_identity mappings

## Support

For issues or questions:
1. Check workflow logs in Cloudflare dashboard
2. Review migration summary output
3. Consult test cases for expected behavior
4. File issue at https://github.com/RawkodeAcademy/RawkodeAcademy/issues
