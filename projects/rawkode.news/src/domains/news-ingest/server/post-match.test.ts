import { describe, expect, test } from "bun:test";
import { findMatchingPostByNormalizedUrl } from "@/domains/news-ingest/server/post-match";

describe("findMatchingPostByNormalizedUrl", () => {
  test("matches existing posts even when stored URLs include tracking params", () => {
    const match = findMatchingPostByNormalizedUrl(
      [
        { id: "one", url: "https://example.com/story?utm_source=rss" },
        { id: "two", url: "https://example.com/other" },
      ],
      "https://example.com/story",
    );

    expect(match).toEqual({ id: "one", url: "https://example.com/story?utm_source=rss" });
  });

  test("ignores rows without valid URLs", () => {
    const match = findMatchingPostByNormalizedUrl(
      [
        { id: "one", url: null },
        { id: "two", url: "notaurl" },
      ],
      "https://example.com/story",
    );

    expect(match).toBeNull();
  });
});
