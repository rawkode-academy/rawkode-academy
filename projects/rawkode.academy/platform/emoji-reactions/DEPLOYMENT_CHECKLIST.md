# Identity Continuity - Deployment Checklist

This checklist ensures safe deployment of the identity continuity solution for emoji reactions during the Zitadel to Better Auth migration.

## Pre-Deployment Verification

- [ ] Review all code changes in:
  - `platform/authentication/data-model/schema.ts` (legacy_identity table)
  - `platform/emoji-reactions/data-model/personId-resolver.ts` (resolution service)
  - `platform/emoji-reactions/write-model/reactToContent.ts` (updated workflow)
  - `website/src/actions/reaction.ts` (updated comments)

- [ ] Run unit tests:
  ```bash
  cd platform/emoji-reactions
  bun test tests/personId-resolver.test.ts
  ```

- [ ] Verify type checking passes:
  ```bash
  cd platform/authentication
  bun run tsc --noEmit

  cd platform/emoji-reactions
  bun run tsc --noEmit
  ```

## Phase 1: Authentication Service (Deploy First)

### 1.1 Create Migration Files

- [ ] Verify migration files exist:
  - `platform/authentication/data-model/migrations/0001_add_legacy_identity.sql`
  - `platform/authentication/data-model/migrations/0002_populate_legacy_identities.sql`

### 1.2 Deploy Schema Changes

- [ ] Run migration to create `legacy_identity` table:
  ```bash
  wrangler d1 migrations apply authentication-db
  ```

- [ ] Verify table created:
  ```bash
  wrangler d1 execute authentication-db --command "SELECT name FROM sqlite_master WHERE type='table' AND name='legacy_identity';"
  ```

### 1.3 Populate Legacy Mappings

- [ ] Run population migration:
  ```bash
  wrangler d1 execute authentication-db --file=platform/authentication/data-model/migrations/0002_populate_legacy_identities.sql
  ```

- [ ] Verify mappings created:
  ```bash
  wrangler d1 execute authentication-db --command "SELECT COUNT(*) as mapping_count FROM legacy_identity;"
  ```

- [ ] Sample some mappings to verify correctness:
  ```bash
  wrangler d1 execute authentication-db --command "SELECT * FROM legacy_identity LIMIT 5;"
  ```

### 1.4 Validation

- [ ] Count should match number of OAuth accounts with Zitadel provider
- [ ] Each mapping should have a valid `user_id` referencing the `user` table
- [ ] `legacy_subject` values should match Zitadel sub format

## Phase 2: Emoji Reactions Write Service (Deploy Second)

### 2.1 Update Service Configuration

- [ ] Add `AUTH_DB` binding to `wrangler.toml` (or equivalent config):
  ```toml
  [[d1_databases]]
  binding = "AUTH_DB"
  database_name = "authentication-db"
  database_id = "<your-auth-db-id>"
  ```

### 2.2 Deploy Updated Service

- [ ] Deploy emoji-reactions write-model with personId resolution:
  ```bash
  cd platform/emoji-reactions/write-model
  wrangler deploy
  ```

- [ ] Verify deployment succeeded in Cloudflare dashboard

### 2.3 Test New Reactions

- [ ] Test adding reaction with Better Auth UUID:
  ```bash
  curl -X POST https://emoji-reactions-write-model.your-worker.workers.dev/ \
    -H "Content-Type: application/json" \
    -d '{
      "contentId": "test-video-123",
      "personId": "550e8400-e29b-41d4-a716-446655440000",
      "emoji": "👍",
      "contentTimestamp": 0
    }'
  ```

- [ ] Verify workflow logs show successful personId resolution
- [ ] Check database to confirm reaction was stored with canonical UUID

### 2.4 Test Legacy ID Resolution

- [ ] Test adding reaction with legacy Zitadel ID (if available):
  ```bash
  curl -X POST https://emoji-reactions-write-model.your-worker.workers.dev/ \
    -H "Content-Type: application/json" \
    -d '{
      "contentId": "test-video-456",
      "personId": "274469097178030081",
      "emoji": "❤️",
      "contentTimestamp": 0
    }'
  ```

- [ ] Verify workflow resolved legacy ID to canonical UUID in logs
- [ ] Check database to confirm personId was normalized

## Phase 3: Data Migration (Run After Write Service is Stable)

### 3.1 Deploy Migration Workflow

- [ ] Deploy migration workflow to Cloudflare Workers:
  ```bash
  cd platform/emoji-reactions
  wrangler deploy --name migrate-person-ids
  ```

### 3.2 Dry Run Migration

- [ ] Trigger dry run to preview changes:
  ```typescript
  const dryRunInstance = await env.MIGRATE_PERSON_IDS_WORKFLOW.create({
    id: crypto.randomUUID(),
    params: {
      batchSize: 100,
      dryRun: true,
    },
  });
  ```

- [ ] Monitor workflow logs to see migration plan
- [ ] Review estimated counts:
  - Total legacy IDs
  - Resolvable IDs
  - Unmapped IDs (should be 0)

### 3.3 Production Migration

- [ ] Trigger production migration:
  ```typescript
  const migrationInstance = await env.MIGRATE_PERSON_IDS_WORKFLOW.create({
    id: crypto.randomUUID(),
    params: {
      batchSize: 100,
      dryRun: false,
    },
  });
  ```

- [ ] Monitor workflow execution in Cloudflare dashboard
- [ ] Watch for errors or failures in logs

### 3.4 Verify Migration Results

- [ ] Check migration summary in workflow output
- [ ] Verify all legacy IDs were migrated:
  ```sql
  SELECT
    COUNT(*) as total_reactions,
    SUM(CASE WHEN person_id LIKE '%-%-%-%-%' THEN 1 ELSE 0 END) as canonical_ids,
    SUM(CASE WHEN person_id NOT LIKE '%-%-%-%-%' THEN 1 ELSE 0 END) as legacy_ids
  FROM emoji_reactions;
  ```
  Expected: `legacy_ids = 0`

- [ ] Sample reactions to verify personIds are canonical:
  ```sql
  SELECT content_id, person_id, emoji, reacted_at
  FROM emoji_reactions
  ORDER BY reacted_at DESC
  LIMIT 10;
  ```

## Phase 4: Frontend Verification

### 4.1 Website Integration

- [ ] Deploy updated website code (reaction.ts with updated comments)

- [ ] Test user flow:
  1. User signs in with Better Auth
  2. User views video with existing reactions
  3. User adds new reaction
  4. User sees their reaction count increment

### 4.2 Historical Reactions

- [ ] Verify users can see their pre-migration reactions:
  1. Identify user who had reactions with legacy Zitadel ID
  2. Check their Better Auth UUID in `user` table
  3. Verify `hasReacted` query returns true for their old reactions
  4. Confirm reaction count includes historical reactions

### 4.3 GraphQL API

- [ ] Test `getEmojiReactionsForContent` query:
  ```graphql
  query {
    getEmojiReactionsForContent(contentId: "video-123") {
      emoji
      count
    }
  }
  ```

- [ ] Test `hasReacted` query with Better Auth UUID:
  ```graphql
  query {
    video(id: "video-123") {
      hasReacted(personId: "550e8400-...", emoji: "👍")
    }
  }
  ```

## Phase 5: Monitoring & Validation

### 5.1 Error Monitoring

- [ ] Set up alerts for:
  - PersonId resolution failures
  - Workflow execution errors
  - Unmapped legacy ID warnings

### 5.2 Performance Monitoring

- [ ] Monitor `legacy_identity` query latency
- [ ] Check workflow execution duration
- [ ] Track emoji-reactions service error rate

### 5.3 Data Validation

- [ ] Run validation query weekly for first month:
  ```sql
  -- Check for any remaining legacy IDs
  SELECT DISTINCT person_id
  FROM emoji_reactions
  WHERE person_id NOT LIKE '%-%-%-%-%';
  ```

- [ ] Verify no duplicate reactions after migration:
  ```sql
  SELECT content_id, person_id, emoji, content_timestamp, COUNT(*)
  FROM emoji_reactions
  GROUP BY content_id, person_id, emoji, content_timestamp
  HAVING COUNT(*) > 1;
  ```

## Rollback Plan

If critical issues are detected:

### Immediate Actions

- [ ] Pause new deployments
- [ ] Document the issue with:
  - Error messages
  - Affected user IDs
  - Timestamp of occurrence
  - Workflow logs

### Rollback Write Service

- [ ] Revert emoji-reactions write-model to previous version without personId resolution
- [ ] Remove `AUTH_DB` binding from configuration
- [ ] Deploy rollback version

### Preserve Data

- [ ] **DO NOT** drop `legacy_identity` table
- [ ] **DO NOT** revert migrated personIds in `emoji_reactions`
- [ ] Keep all logs and workflow execution history

### Investigation

- [ ] Review workflow execution logs
- [ ] Check for unmapped legacy IDs
- [ ] Verify `legacy_identity` data integrity
- [ ] Test personId resolution logic with problematic IDs

### Re-deployment

- [ ] Fix identified issues
- [ ] Update tests to cover edge cases
- [ ] Re-test in staging environment
- [ ] Follow deployment checklist again

## Success Criteria

The migration is considered successful when:

- [ ] All authentication migrations applied without errors
- [ ] All legacy identities populated in `legacy_identity` table
- [ ] Emoji reactions write service resolves personIds correctly
- [ ] Migration workflow completed with 100% success rate
- [ ] No legacy person IDs remain in `emoji_reactions` table
- [ ] Users can see their historical reactions after migration
- [ ] New reactions work correctly with Better Auth UUIDs
- [ ] No increase in error rates or user-reported issues
- [ ] GraphQL API returns correct reaction counts and hasReacted status

## Post-Deployment

### Week 1

- [ ] Daily check of error logs
- [ ] Monitor user feedback for reaction issues
- [ ] Verify reaction counts are accurate

### Week 2-4

- [ ] Weekly validation queries
- [ ] Review CloudFlare analytics for emoji-reactions service
- [ ] Document any edge cases discovered

### Month 2+

- [ ] Consider performance optimizations (caching)
- [ ] Evaluate migration success metrics
- [ ] Plan for legacy table deprecation (if applicable)

## Documentation

- [ ] Update API documentation with identity continuity details
- [ ] Document known limitations or edge cases
- [ ] Create runbook for common issues
- [ ] Archive deployment logs and migration results

---

**Deployment Lead**: _________________
**Date**: _________________
**Sign-off**: _________________
