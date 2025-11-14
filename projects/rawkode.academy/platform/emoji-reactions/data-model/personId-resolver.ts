/**
 * PersonId Resolver
 *
 * This module provides utilities to resolve person IDs across the Zitadel to Better Auth migration.
 * It handles both legacy Zitadel subject IDs and new Better Auth user IDs, ensuring continuity
 * of user reactions across the authentication transition.
 *
 * Architecture:
 * - Legacy IDs (Zitadel): Long alphanumeric strings (e.g., "274469097178030081")
 * - New IDs (Better Auth): UUIDs with hyphens (e.g., "550e8400-e29b-41d4-a716-446655440000")
 * - Resolution strategy: Check ID format first, then query auth service if needed
 */

import type { D1Database } from "@cloudflare/workers-types";

/**
 * Determine if a personId is a legacy Zitadel ID or Better Auth UUID
 */
export function isLegacyId(personId: string): boolean {
  // Better Auth IDs are UUIDs (8-4-4-4-12 format with hyphens)
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return !uuidPattern.test(personId);
}

/**
 * Resolve a legacy person ID to a canonical Better Auth user ID
 *
 * @param personId - The person ID to resolve (could be legacy Zitadel or new Better Auth)
 * @param authDb - The authentication service D1 database
 * @returns The canonical Better Auth user ID
 * @throws Error if the legacy ID cannot be resolved
 */
export async function resolvePersonId(
  personId: string,
  authDb: D1Database,
): Promise<string> {
  // If it's already a Better Auth UUID, return as-is
  if (!isLegacyId(personId)) {
    return personId;
  }

  // Query the legacy_identity table to find the mapped user ID
  const result = await authDb
    .prepare(
      `SELECT user_id FROM legacy_identity
       WHERE legacy_provider = 'zitadel'
       AND legacy_subject = ?`
    )
    .bind(personId)
    .first<{ user_id: string }>();

  if (!result) {
    throw new Error(
      `Cannot resolve legacy person ID: ${personId}. No mapping found in legacy_identity table.`
    );
  }

  return result.user_id;
}

/**
 * Batch resolve multiple person IDs efficiently
 *
 * @param personIds - Array of person IDs to resolve
 * @param authDb - The authentication service D1 database
 * @returns Map of original personId to canonical Better Auth user ID
 */
export async function batchResolvePersonIds(
  personIds: string[],
  authDb: D1Database,
): Promise<Map<string, string>> {
  const resolved = new Map<string, string>();
  const legacyIds: string[] = [];

  // Separate legacy IDs from Better Auth IDs
  for (const id of personIds) {
    if (isLegacyId(id)) {
      legacyIds.push(id);
    } else {
      resolved.set(id, id);
    }
  }

  // If no legacy IDs, return early
  if (legacyIds.length === 0) {
    return resolved;
  }

  // Build a parameterized query for batch lookup
  const placeholders = legacyIds.map(() => '?').join(',');
  const query = `
    SELECT legacy_subject, user_id
    FROM legacy_identity
    WHERE legacy_provider = 'zitadel'
    AND legacy_subject IN (${placeholders})
  `;

  const result = await authDb
    .prepare(query)
    .bind(...legacyIds)
    .all<{ legacy_subject: string; user_id: string }>();

  // Map legacy IDs to their resolved user IDs
  if (result.results) {
    for (const row of result.results) {
      resolved.set(row.legacy_subject, row.user_id);
    }
  }

  // Check for any unresolved legacy IDs
  const unresolved = legacyIds.filter(id => !resolved.has(id));
  if (unresolved.length > 0) {
    console.warn(
      `Warning: Could not resolve ${unresolved.length} legacy person IDs: ${unresolved.join(', ')}`
    );
    // For unmapped IDs, keep them as-is to allow partial migration
    for (const id of unresolved) {
      resolved.set(id, id);
    }
  }

  return resolved;
}

/**
 * Normalize a person ID to its canonical form
 * This is a convenience wrapper around resolvePersonId that handles errors gracefully
 *
 * @param personId - The person ID to normalize
 * @param authDb - The authentication service D1 database
 * @returns The canonical person ID, or the original if resolution fails
 */
export async function normalizePersonId(
  personId: string,
  authDb: D1Database,
): Promise<string> {
  try {
    return await resolvePersonId(personId, authDb);
  } catch (error) {
    console.error(`Failed to normalize person ID ${personId}:`, error);
    // Return original ID to maintain backward compatibility during transition
    return personId;
  }
}
