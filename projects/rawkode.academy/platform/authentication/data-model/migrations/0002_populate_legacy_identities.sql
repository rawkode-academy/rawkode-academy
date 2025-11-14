-- Migration: Populate legacy_identity table from existing account data
-- This migration extracts Zitadel account IDs from the account table
-- and creates legacy identity mappings for all users who have OAuth accounts

INSERT INTO `legacy_identity` (`id`, `user_id`, `legacy_provider`, `legacy_subject`, `migrated_at`, `created_at`)
SELECT
  lower(hex(randomblob(16))) as id,
  a.user_id,
  'zitadel' as legacy_provider,
  a.account_id as legacy_subject,
  (cast(unixepoch('subsecond') * 1000 as integer)) as migrated_at,
  (cast(unixepoch('subsecond') * 1000 as integer)) as created_at
FROM `account` a
WHERE a.provider_id IN ('github', 'google', 'zitadel')
  AND NOT EXISTS (
    SELECT 1 FROM `legacy_identity` li
    WHERE li.user_id = a.user_id
    AND li.legacy_provider = 'zitadel'
    AND li.legacy_subject = a.account_id
  );
