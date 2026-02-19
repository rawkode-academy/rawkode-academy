import rss from "@astrojs/rss";
import type { APIRoute } from "astro";
import { desc } from "drizzle-orm";
import { getDb } from "@/db";
import { posts } from "@/db/schema";
import type { TypedEnv } from "@/types/service-bindings";

const toDate = (value: Date | number) =>
  value instanceof Date ? value : new Date(value);

export const GET: APIRoute = async (context) => {
  const db = getDb(context.locals.runtime.env as TypedEnv);
  const items = await db
    .select({
      id: posts.id,
      title: posts.title,
      url: posts.url,
      body: posts.body,
      author: posts.author,
      createdAt: posts.createdAt,
    })
    .from(posts)
    .orderBy(desc(posts.createdAt))
    .limit(100);

  const site = context.site ?? new URL(context.url.origin);
  const selfHref = new URL("/rss.xml", site).href;

  return rss({
    title: "Rawkode News",
    description: "Latest posts from the Rawkode News community.",
    site,
    xmlns: {
      atom: "http://www.w3.org/2005/Atom",
    },
    items: items.map((post) => ({
      title: post.title,
      description:
        post.body?.trim() ||
        (post.url ? `External source: ${post.url}` : `Shared by ${post.author}`),
      link: `/item/${post.id}`,
      pubDate: toDate(post.createdAt),
    })),
    customData: `<language>en-us</language><atom:link href="${selfHref}" rel="self" type="application/rss+xml" />`,
  });
};
