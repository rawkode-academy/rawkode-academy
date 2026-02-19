import type { APIRoute } from "astro";
import { eq } from "drizzle-orm";

import { getDb, type Env } from "../../../db";
import { posts } from "../../../db/schema";
import { acceptsMarkdown } from "@/lib/content-negotiation";
import { parseEntityId } from "@/lib/ids";

const normalizeTimestamp = (value: Date | number) => {
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString();
};

const yamlString = (value: string) => JSON.stringify(value);

const toFrontmatterMarkdown = (post: {
  id: string;
  title: string;
  category: string;
  url: string | null;
  body: string | null;
  author: string;
  commentCount: number;
  createdAt: string;
}) => {
  const title = post.title.replace(/\s+/g, " ").trim();
  const lines = [
    "---",
    `id: ${yamlString(post.id)}`,
    `title: ${yamlString(title)}`,
    `category: ${yamlString(post.category)}`,
    `author: ${yamlString(post.author)}`,
    `publishedAt: ${yamlString(post.createdAt)}`,
    `commentCount: ${post.commentCount}`,
  ];

  if (post.url) {
    lines.push(`source: ${yamlString(post.url)}`);
  }

  lines.push("---");

  if (post.body?.trim()) {
    lines.push("", post.body.trim());
  }

  return lines.join("\n");
};

export const GET: APIRoute = async ({ params, locals, request }) => {
  const env = locals.runtime.env as Env;
  const db = getDb(env);
  const id = parseEntityId(params.id);

  if (!id) {
    return new Response("Invalid post id", { status: 400 });
  }

  const [post] = await db.select().from(posts).where(eq(posts.id, id)).limit(1);

  if (!post) {
    return new Response("Post not found", { status: 404 });
  }

  const serialized = {
    ...post,
    id: String(post.id),
    createdAt: normalizeTimestamp(post.createdAt),
  };

  if (acceptsMarkdown(request)) {
    return new Response(toFrontmatterMarkdown(serialized), {
      status: 200,
      headers: {
        "content-type": "text/markdown; charset=utf-8",
        vary: "Accept",
      },
    });
  }

  return new Response(JSON.stringify(serialized), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      vary: "Accept",
    },
  });
};
