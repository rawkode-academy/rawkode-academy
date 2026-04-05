import { describe, expect, test } from "bun:test";
import { normalizeExternalUrl } from "@/shared/urls/normalization";

describe("normalizeExternalUrl", () => {
  test("strips tracking params and fragments while preserving stable params", () => {
    expect(
      normalizeExternalUrl(
        "HTTPS://Example.com/path/?utm_source=newsletter&b=2&a=1&fbclid=abc123#section",
      ),
    ).toBe("https://example.com/path?a=1&b=2");
  });

  test("normalizes trailing slashes but preserves the root path", () => {
    expect(normalizeExternalUrl("https://example.com/articles///")).toBe(
      "https://example.com/articles",
    );
    expect(normalizeExternalUrl("https://example.com/?utm_campaign=launch")).toBe(
      "https://example.com/",
    );
  });

  test("rejects unsupported protocols", () => {
    expect(() => normalizeExternalUrl("ftp://example.com/file.txt")).toThrow(
      "URL must use http:// or https://",
    );
  });
});
