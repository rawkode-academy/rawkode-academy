import { describe, expect, test } from "bun:test";
import { extractBlueskyFeedItems } from "@/domains/news-ingest/server/bluesky";

describe("extractBlueskyFeedItems", () => {
  test("prefers embedded external links and titles", () => {
    const items = extractBlueskyFeedItems({
      feed: [
        {
          post: {
            uri: "at://did:plc:author/app.bsky.feed.post/3launched",
            indexedAt: "2026-04-05T09:30:00.000Z",
            author: {
              handle: "launches.bsky.social",
              displayName: "Launches",
            },
            record: {
              text: "Posting the launch link",
              createdAt: "2026-04-05T09:29:00.000Z",
            },
            embed: {
              $type: "app.bsky.embed.external#view",
              external: {
                uri: "https://example.com/post?utm_source=bluesky",
                title: "Example launch",
                description: "Why the launch matters",
              },
            },
          },
        },
      ],
    });

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      normalizedUrl: "https://example.com/post",
      originalUrl: "https://example.com/post?utm_source=bluesky",
      sourceItemUrl: "https://bsky.app/profile/launches.bsky.social/post/3launched",
      sourceItemId: "at://did:plc:author/app.bsky.feed.post/3launched",
      title: "Example launch",
      excerpt: "Why the launch matters",
      authorName: "Launches",
    });
  });

  test("falls back to facet links or the Bluesky permalink and skips reposts", () => {
    const items = extractBlueskyFeedItems({
      feed: [
        {
          post: {
            uri: "at://did:plc:author/app.bsky.feed.post/3facet",
            indexedAt: "2026-04-05T09:31:00.000Z",
            author: {
              handle: "links.bsky.social",
            },
            record: {
              text: "Facet link post",
              createdAt: "2026-04-05T09:31:00.000Z",
              facets: [
                {
                  features: [
                    {
                      $type: "app.bsky.richtext.facet#link",
                      uri: "https://docs.example.com/page?fbclid=123",
                    },
                  ],
                },
              ],
            },
          },
        },
        {
          reason: { $type: "app.bsky.feed.defs#reasonRepost" },
          post: {
            uri: "at://did:plc:author/app.bsky.feed.post/3repost",
            author: { handle: "links.bsky.social" },
            record: { text: "Ignore repost" },
          },
        },
        {
          post: {
            uri: "at://did:plc:author/app.bsky.feed.post/3nolink",
            indexedAt: "2026-04-05T09:32:00.000Z",
            author: {
              did: "did:plc:author",
            },
            record: {
              text: "No external link here",
              createdAt: "2026-04-05T09:32:00.000Z",
            },
          },
        },
      ],
    });

    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      normalizedUrl: "https://docs.example.com/page",
      sourceItemUrl: "https://bsky.app/profile/links.bsky.social/post/3facet",
      title: "Facet link post",
    });
    expect(items[1]).toMatchObject({
      normalizedUrl: "https://bsky.app/profile/did%3Aplc%3Aauthor/post/3nolink",
      sourceItemUrl: "https://bsky.app/profile/did%3Aplc%3Aauthor/post/3nolink",
      title: "No external link here",
    });
  });
});
