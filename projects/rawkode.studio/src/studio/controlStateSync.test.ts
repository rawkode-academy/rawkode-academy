import { describe, expect, it } from "vitest";
import { createInitialStudioState } from "./seed";
import {
  resolveStudioControlStateConflict,
  shouldFlushStudioControlStateAfterSave,
} from "./controlStateSync";

describe("Studio control-state synchronization", () => {
  it("adopts the authoritative programme and discards every stale local serial on conflict", () => {
    const authoritativeState = createInitialStudioState();
    authoritativeState.status = "Authoritative programme";

    const conflict = resolveStudioControlStateConflict({
      error: "Programme changed in another tab.",
      revision: 8,
      state: authoritativeState,
      updatedAt: 123,
      updatedBy: "other-producer",
    }, 5);

    expect(conflict).toEqual({
      changeSerial: 6,
      error: "Programme changed in another tab. Local changes were discarded.",
      revision: 8,
      savedSerial: 6,
      state: authoritativeState,
    });
  });

  it("rejects a conflict response without authoritative state", () => {
    expect(() =>
      resolveStudioControlStateConflict({
        revision: 8,
        state: null,
        updatedAt: null,
        updatedBy: null,
      }, 5)
    ).toThrow("did not include the authoritative programme");
  });

  it("flushes only edits made after a successful in-flight save", () => {
    expect(shouldFlushStudioControlStateAfterSave("saved", 4, 3)).toBe(true);
    expect(shouldFlushStudioControlStateAfterSave("saved", 4, 4)).toBe(false);
    expect(shouldFlushStudioControlStateAfterSave("conflict", 4, 3)).toBe(false);
    expect(shouldFlushStudioControlStateAfterSave("error", 4, 3)).toBe(false);
  });
});
