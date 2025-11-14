-- Migration: Update emoji_reactions with canonical person IDs
--
-- This migration updates existing emoji reactions that use legacy Zitadel subject IDs
-- to use canonical Better Auth user IDs via the legacy_identity mapping table.
--
-- Prerequisites:
--   1. Authentication service must have legacy_identity table populated
--   2. Run this after deploying the updated write workflow
--
-- Note: This migration is designed to be idempotent and can be run multiple times.
-- It only updates person_ids that don't match the UUID pattern (legacy IDs).

-- Create a temporary table to store the ID mappings
-- (Since D1/SQLite doesn't support CTEs in UPDATE statements directly)
CREATE TEMP TABLE IF NOT EXISTS temp_id_mappings AS
SELECT DISTINCT
  er.person_id as legacy_id,
  li.user_id as canonical_id
FROM emoji_reactions er
-- Cross-database query: This assumes we can access the AUTH_DB
-- In practice, this may need to be done via application code or separate steps
LEFT JOIN legacy_identity li ON
  li.legacy_provider = 'zitadel'
  AND li.legacy_subject = er.person_id
WHERE
  -- Only target legacy IDs (non-UUID format)
  er.person_id NOT LIKE '%-%-%-%-%'
  AND li.user_id IS NOT NULL;

-- Update emoji_reactions with canonical person IDs
UPDATE emoji_reactions
SET person_id = (
  SELECT canonical_id
  FROM temp_id_mappings
  WHERE legacy_id = emoji_reactions.person_id
)
WHERE person_id IN (
  SELECT legacy_id FROM temp_id_mappings
);

-- Clean up temporary table
DROP TABLE IF EXISTS temp_id_mappings;

-- Verify migration results
SELECT
  COUNT(*) as total_reactions,
  COUNT(DISTINCT person_id) as unique_persons,
  SUM(CASE WHEN person_id LIKE '%-%-%-%-%' THEN 1 ELSE 0 END) as canonical_ids,
  SUM(CASE WHEN person_id NOT LIKE '%-%-%-%-%' THEN 1 ELSE 0 END) as legacy_ids
FROM emoji_reactions;
