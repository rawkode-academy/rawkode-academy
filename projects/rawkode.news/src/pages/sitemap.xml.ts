import type { APIRoute } from "astro";
import { desc } from "drizzle-orm";
import { getDb } from "@/db";
import { posts } from "@/db/schema";
import type { TypedEnv } from "@/types/service-bindings";

const escapeXml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

const formatLastMod = (value: Date | number) => {
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString();
};

export const GET: APIRoute = async ({ locals, site, url }) => {
  const db = getDb(locals.runtime.env as TypedEnv);
  const baseUrl = site ?? new URL(url.origin);

  const entries = await db
    .select({
      id: posts.id,
      createdAt: posts.createdAt,
    })
    .from(posts)
    .orderBy(desc(posts.createdAt));

  const latestPostDate = entries.length > 0 ? formatLastMod(entries[0].createdAt) : undefined;

  const staticPaths = ["/", "/new", "/news", "/rka", "/show", "/ask", "/search", "/rss.xml"];

  const staticUrls = staticPaths.map((path) => ({
    loc: new URL(path, baseUrl).toString(),
    lastmod: latestPostDate,
  }));

  const postUrls = entries.map((post) => ({
    loc: new URL(`/item/${post.id}`, baseUrl).toString(),
    lastmod: formatLastMod(post.createdAt),
  }));

  const urls = [...staticUrls, ...postUrls];

  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map((entry) =>
      [
        "  <url>",
        `    <loc>${escapeXml(entry.loc)}</loc>`,
        entry.lastmod ? `    <lastmod>${entry.lastmod}</lastmod>` : "",
        "  </url>",
      ]
        .filter(Boolean)
        .join("\n")
    ),
    "</urlset>",
  ].join("\n");

  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
    },
  });
};
