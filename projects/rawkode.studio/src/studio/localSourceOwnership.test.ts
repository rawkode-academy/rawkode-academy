import { describe, expect, it } from "vitest";
import { shouldPersistOwnedScreenCleanup } from "./localSourceOwnership";

describe("local source ownership", () => {
  it("does not remove live local sources when pagehide enters the back-forward cache", () => {
    expect(shouldPersistOwnedScreenCleanup({ persisted: true })).toBe(false);
    expect(shouldPersistOwnedScreenCleanup({ persisted: false })).toBe(true);
    expect(shouldPersistOwnedScreenCleanup()).toBe(true);
  });
});
