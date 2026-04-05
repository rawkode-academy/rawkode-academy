import { describe, expect, test } from "bun:test";
import {
  discoverRssFeedUrlFromHtml,
  loadRssFeed,
  parseRssFeed,
} from "@/domains/news-ingest/server/rss";

describe("parseRssFeed", () => {
  test("parses RSS items and converts HTML descriptions to markdown", () => {
    const items = parseRssFeed(`<?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/">
        <channel>
          <title>Example feed</title>
          <item>
            <title>Launch update</title>
            <link>https://example.com/news/launch?utm_source=rss</link>
            <guid>launch-1</guid>
            <pubDate>Sat, 05 Apr 2026 12:00:00 GMT</pubDate>
            <description><![CDATA[
              <p>New release <strong>today</strong>.</p>
              <ul>
                <li>First change</li>
                <li>Second change</li>
              </ul>
            ]]></description>
          </item>
          <item>
            <title>Missing URL</title>
            <guid>skip-me</guid>
          </item>
        </channel>
      </rss>`);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      normalizedUrl: "https://example.com/news/launch",
      originalUrl: "https://example.com/news/launch?utm_source=rss",
      sourceItemUrl: "https://example.com/news/launch",
      sourceItemId: "launch-1",
      title: "Launch update",
      excerpt: "New release **today**.\n\n- First change\n- Second change",
    });
    expect(items[0]?.publishedAt?.toISOString()).toBe("2026-04-05T12:00:00.000Z");
  });

  test("parses Atom entry links and summaries", () => {
    const items = parseRssFeed(`<?xml version="1.0" encoding="utf-8"?>
      <feed xmlns="http://www.w3.org/2005/Atom">
        <title>Atom example</title>
        <entry>
          <title>Atom launch</title>
          <link rel="alternate" href="https://atom.example.dev/post/1?utm_medium=atom" />
          <id>tag:example.dev,2026:1</id>
          <updated>2026-04-04T10:11:12Z</updated>
          <summary>Atom summary</summary>
          <author><name>Example author</name></author>
        </entry>
      </feed>`);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      normalizedUrl: "https://atom.example.dev/post/1",
      sourceItemUrl: "https://atom.example.dev/post/1",
      sourceItemId: "tag:example.dev,2026:1",
      title: "Atom launch",
      excerpt: "Atom summary",
      authorName: "Example author",
    });
  });

  test("converts escaped HTML descriptions to markdown", () => {
    const items = parseRssFeed(`<?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0">
        <channel>
          <title>Escaped HTML feed</title>
          <item>
            <title>Escaped launch</title>
            <link>https://example.com/news/escaped</link>
            <description>
              &lt;p&gt;Escaped &lt;strong&gt;markup&lt;/strong&gt; works.&lt;/p&gt;
              &lt;ul&gt;
                &lt;li&gt;First item&lt;/li&gt;
                &lt;li&gt;Second item&lt;/li&gt;
              &lt;/ul&gt;
            </description>
          </item>
        </channel>
      </rss>`);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      normalizedUrl: "https://example.com/news/escaped",
      title: "Escaped launch",
      excerpt: "Escaped **markup** works.\n\n- First item\n- Second item",
    });
  });

  test("discovers an alternate feed URL from html", () => {
    expect(
      discoverRssFeedUrlFromHtml(
        `<!doctype html>
          <html>
            <head>
              <link rel="alternate" type="application/rss+xml" href="/feed.xml" title="Main feed" />
            </head>
          </html>`,
        "https://example.com/blog",
      ),
    ).toBe("https://example.com/feed.xml");
  });

  test("loads a feed after autodiscovering it from a page url", async () => {
    const fetchStub = async (input: RequestInfo | URL) => {
      const url = typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
      if (url === "https://example.com/blog") {
        return new Response(
          `<!doctype html>
            <html>
              <head>
                <link rel="alternate" type="application/rss+xml" href="/feed.xml" />
              </head>
            </html>`,
          {
            status: 200,
            headers: { "content-type": "text/html; charset=utf-8" },
          },
        );
      }

      if (url === "https://example.com/feed.xml") {
        return new Response(
          `<?xml version="1.0" encoding="UTF-8"?>
            <rss version="2.0">
              <channel>
                <item>
                  <title>Detected feed item</title>
                  <link>https://example.com/posts/detected</link>
                </item>
              </channel>
            </rss>`,
          {
            status: 200,
            headers: { "content-type": "application/rss+xml" },
          },
        );
      }

      return new Response("not found", { status: 404 });
    };

    const result = await loadRssFeed("https://example.com/blog", fetchStub);

    expect(result.feedUrl).toBe("https://example.com/feed.xml");
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      normalizedUrl: "https://example.com/posts/detected",
      title: "Detected feed item",
    });
  });
});
