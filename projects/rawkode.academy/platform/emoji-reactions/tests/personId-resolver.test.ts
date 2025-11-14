/**
 * Tests for PersonId Resolution
 *
 * These tests verify that the personId resolver correctly handles:
 * 1. Legacy Zitadel subject IDs
 * 2. New Better Auth UUIDs
 * 3. Batch resolution
 * 4. Error handling for unmapped IDs
 *
 * NOTE: These tests use mocked D1 database and do NOT require test setup.
 */

import { describe, it, expect, mock } from "bun:test";
import type { D1Database } from "@cloudflare/workers-types";
import {
  isLegacyId,
  resolvePersonId,
  batchResolvePersonIds,
  normalizePersonId,
} from "../data-model/personId-resolver";

// Mock D1 Database
const createMockDb = () => {
  const mockDb = {
    prepare: mock((query: string) => ({
      bind: mock((...args: unknown[]) => ({
        first: mock(async () => {
          // Simulate legacy identity lookup
          const legacyId = args[0] as string;
          if (legacyId === "274469097178030081") {
            return { user_id: "550e8400-e29b-41d4-a716-446655440000" };
          }
          if (legacyId === "274469097178030082") {
            return { user_id: "660f9511-f3ac-52e5-b827-557766551111" };
          }
          return null;
        }),
        all: mock(async () => {
          // Simulate batch legacy identity lookup
          const results = [];
          for (const arg of args) {
            if (arg === "274469097178030081") {
              results.push({
                legacy_subject: "274469097178030081",
                user_id: "550e8400-e29b-41d4-a716-446655440000",
              });
            } else if (arg === "274469097178030082") {
              results.push({
                legacy_subject: "274469097178030082",
                user_id: "660f9511-f3ac-52e5-b827-557766551111",
              });
            }
          }
          return { results };
        }),
      })),
    })),
  };

  return mockDb as unknown as D1Database;
};

describe("isLegacyId", () => {
  it("should identify Better Auth UUIDs as NOT legacy", () => {
    expect(isLegacyId("550e8400-e29b-41d4-a716-446655440000")).toBe(false);
    expect(isLegacyId("660f9511-f3ac-52e5-b827-557766551111")).toBe(false);
  });

  it("should identify Zitadel subject IDs as legacy", () => {
    expect(isLegacyId("274469097178030081")).toBe(true);
    expect(isLegacyId("123456789012345678")).toBe(true);
  });

  it("should handle various non-UUID formats as legacy", () => {
    expect(isLegacyId("user_12345")).toBe(true);
    expect(isLegacyId("abc123xyz")).toBe(true);
    expect(isLegacyId("")).toBe(true);
  });
});

describe("resolvePersonId", () => {
  it("should return Better Auth UUIDs unchanged", async () => {
    const mockDb = createMockDb();
    const uuid = "550e8400-e29b-41d4-a716-446655440000";

    const result = await resolvePersonId(uuid, mockDb);
    expect(result).toBe(uuid);
  });

  it("should resolve legacy Zitadel IDs to Better Auth UUIDs", async () => {
    const mockDb = createMockDb();
    const legacyId = "274469097178030081";

    const result = await resolvePersonId(legacyId, mockDb);
    expect(result).toBe("550e8400-e29b-41d4-a716-446655440000");
  });

  it("should throw error for unmapped legacy IDs", async () => {
    const mockDb = createMockDb();
    const unmappedId = "999999999999999999";

    await expect(resolvePersonId(unmappedId, mockDb)).rejects.toThrow(
      /Cannot resolve legacy person ID/
    );
  });
});

describe("batchResolvePersonIds", () => {
  it("should resolve mixed Better Auth and legacy IDs", async () => {
    const mockDb = createMockDb();
    const ids = [
      "550e8400-e29b-41d4-a716-446655440000", // Better Auth UUID (unchanged)
      "274469097178030081", // Legacy Zitadel ID (mapped)
      "660f9511-f3ac-52e5-b827-557766551111", // Better Auth UUID (unchanged)
      "274469097178030082", // Legacy Zitadel ID (mapped)
    ];

    const result = await batchResolvePersonIds(ids, mockDb);

    expect(result.size).toBe(4);
    expect(result.get("550e8400-e29b-41d4-a716-446655440000")).toBe(
      "550e8400-e29b-41d4-a716-446655440000"
    );
    expect(result.get("274469097178030081")).toBe(
      "550e8400-e29b-41d4-a716-446655440000"
    );
    expect(result.get("660f9511-f3ac-52e5-b827-557766551111")).toBe(
      "660f9511-f3ac-52e5-b827-557766551111"
    );
    expect(result.get("274469097178030082")).toBe(
      "660f9511-f3ac-52e5-b827-557766551111"
    );
  });

  it("should handle all Better Auth UUIDs without DB query", async () => {
    const mockDb = createMockDb();
    const ids = [
      "550e8400-e29b-41d4-a716-446655440000",
      "660f9511-f3ac-52e5-b827-557766551111",
    ];

    const result = await batchResolvePersonIds(ids, mockDb);

    expect(result.size).toBe(2);
    expect(mockDb.prepare).not.toHaveBeenCalled();
  });

  it("should gracefully handle unmapped legacy IDs", async () => {
    const mockDb = createMockDb();
    const ids = [
      "274469097178030081", // Mapped
      "999999999999999999", // Unmapped
    ];

    const result = await batchResolvePersonIds(ids, mockDb);

    // Should still include the unmapped ID (kept as-is for partial migration)
    expect(result.size).toBe(2);
    expect(result.get("274469097178030081")).toBe(
      "550e8400-e29b-41d4-a716-446655440000"
    );
    expect(result.get("999999999999999999")).toBe("999999999999999999");
  });
});

describe("normalizePersonId", () => {
  it("should resolve valid legacy IDs", async () => {
    const mockDb = createMockDb();
    const legacyId = "274469097178030081";

    const result = await normalizePersonId(legacyId, mockDb);
    expect(result).toBe("550e8400-e29b-41d4-a716-446655440000");
  });

  it("should return original ID on resolution failure", async () => {
    const mockDb = createMockDb();
    const unmappedId = "999999999999999999";

    const result = await normalizePersonId(unmappedId, mockDb);
    expect(result).toBe(unmappedId);
  });

  it("should return Better Auth UUIDs unchanged", async () => {
    const mockDb = createMockDb();
    const uuid = "550e8400-e29b-41d4-a716-446655440000";

    const result = await normalizePersonId(uuid, mockDb);
    expect(result).toBe(uuid);
  });
});
