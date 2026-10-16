import { describe, expect, it } from "vitest";
import {
  getRecordingPersistencePolicy,
  shouldUseLocalRecordingFallback,
} from "./uploadFallbackPolicy";

describe("getRecordingPersistencePolicy", () => {
  it("keeps test and unspecified sessions local-only", () => {
    expect(getRecordingPersistencePolicy("test")).toBe("local-only");
    expect(getRecordingPersistencePolicy(undefined)).toBe("local-only");
  });

  it("allows persistent recording uploads only for production sessions", () => {
    expect(getRecordingPersistencePolicy("prod")).toBe("persistent");
  });
});

describe("shouldUseLocalRecordingFallback", () => {
  it("allows local recording when the upload service is unreachable or unavailable", () => {
    expect(shouldUseLocalRecordingFallback(undefined)).toBe(true);
    expect(shouldUseLocalRecordingFallback(500)).toBe(true);
    expect(shouldUseLocalRecordingFallback(503)).toBe(true);
  });

  it("blocks local fallback for recording lease, authorization, and request failures", () => {
    expect(shouldUseLocalRecordingFallback(400)).toBe(false);
    expect(shouldUseLocalRecordingFallback(401)).toBe(false);
    expect(shouldUseLocalRecordingFallback(403)).toBe(false);
    expect(shouldUseLocalRecordingFallback(404)).toBe(false);
    expect(shouldUseLocalRecordingFallback(409)).toBe(false);
  });
});
