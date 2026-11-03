import { describe, expect, it } from "vitest";
import {
  getRecordingPersistencePolicy,
  shouldUseLocalRecordingFallback,
} from "./uploadFallbackPolicy";

describe("getRecordingPersistencePolicy", () => {
  it("keeps test and unspecified sessions local-only regardless of content backing", () => {
    expect(getRecordingPersistencePolicy("test", true)).toBe("local-only");
    expect(getRecordingPersistencePolicy("test", false)).toBe("local-only");
    expect(getRecordingPersistencePolicy(undefined, undefined)).toBe("local-only");
  });

  it("keeps content-backed production on the persistent recording path", () => {
    expect(getRecordingPersistencePolicy("prod", true)).toBe("persistent");
  });

  it("records standalone production locally without attempting persistent upload", () => {
    expect(getRecordingPersistencePolicy("prod", false)).toBe("local-only");
  });

  it("does not silently use local-only recording when production backing is unknown", () => {
    expect(getRecordingPersistencePolicy("prod", undefined)).toBe("persistent");
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
    expect(shouldUseLocalRecordingFallback(422)).toBe(false);
    expect(shouldUseLocalRecordingFallback(429)).toBe(false);
  });
});
