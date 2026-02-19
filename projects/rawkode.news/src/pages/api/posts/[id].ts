import type { APIRoute } from "astro";
import { eq } from "drizzle-orm";

import { getDb, type Env } from "../../../db";
import { posts } from "../../../db/schema";
import { acceptsAiHtml } from "@/lib/content-negotiation";
import { parseEntityId } from "@/lib/ids";

const normalizeTimestamp = (value: Date | number) => {
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString();
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const toAiHtmlDocument = (post: {
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
  const content = post.body?.trim() ?? "";
  const lines = ["<!doctype html>", "<html lang=\"en\">", "<head>", "  <meta charset=\"utf-8\" />"];

  lines.push(`  <title>${escapeHtml(title)}</title>`);
  lines.push(`  <meta name="ai:id" content="${escapeHtml(post.id)}" />`);
  lines.push(`  <meta name="ai:title" content="${escapeHtml(title)}" />`);
  lines.push(`  <meta name="ai:category" content="${escapeHtml(post.category)}" />`);
  lines.push(`  <meta name="ai:author" content="${escapeHtml(post.author)}" />`);
  lines.push(`  <meta name="ai:published-at" content="${escapeHtml(post.createdAt)}" />`);
  lines.push(`  <meta name="ai:comment-count" content="${post.commentCount}" />`);
  if (post.url) lines.push(`  <meta name="ai:source" content="${escapeHtml(post.url)}" />`);
  lines.push("</head>", "<body>", "  <article>");
  lines.push(`    <h1>${escapeHtml(title)}</h1>`);
  lines.push(`    <div id="content">${escapeHtml(content)}</div>`);
  lines.push("  </article>", "</body>", "</html>");

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

  if (acceptsAiHtml(request)) {
    return new Response(toAiHtmlDocument(serialized), {
      status: 200,
      headers: {
        "content-type": "ai/html; charset=utf-8",
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
