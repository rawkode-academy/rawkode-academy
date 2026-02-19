import type { APIRoute } from "astro";
import { eq } from "drizzle-orm";

import { getDb, type Env } from "../../../db";
import { posts } from "../../../db/schema";
import { acceptsArticleHtml } from "@/lib/content-negotiation";
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

const formatPublishedLabel = (value: string) => {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    return value;
  }
  return new Date(timestamp).toUTCString();
};

const renderBodyHtml = (value: string | null) => {
  const content = value?.trim();
  if (!content) {
    return "<p>No summary provided.</p>";
  }

  const paragraphs = content
    .replace(/\r\n?/g, "\n")
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br />")}</p>`);

  if (paragraphs.length === 0) {
    return "<p>No summary provided.</p>";
  }

  return paragraphs.join("\n      ");
};

const toArticleHtmlDocument = (post: {
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
  const createdAtLabel = formatPublishedLabel(post.createdAt);
  const sourceUrl = post.url ? escapeHtml(post.url) : null;
  const lines = [
    "<!doctype html>",
    "<html lang=\"en\">",
    "<head>",
    "  <meta charset=\"utf-8\" />",
    "  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />",
  ];

  lines.push(`  <title>${escapeHtml(title)}</title>`);
  lines.push("</head>");
  lines.push("<body>");
  lines.push("  <main>");
  lines.push("    <article>");
  lines.push("      <header>");
  lines.push(`        <h1>${escapeHtml(title)}</h1>`);
  lines.push("        <p>");
  lines.push(`          <strong>Category:</strong> ${escapeHtml(post.category)} |`);
  lines.push(`          <strong>Author:</strong> ${escapeHtml(post.author)} |`);
  lines.push(
    `          <strong>Published:</strong> <time datetime="${escapeHtml(post.createdAt)}">${escapeHtml(createdAtLabel)}</time> |`,
  );
  lines.push(`          <strong>Comments:</strong> ${post.commentCount}`);
  lines.push("        </p>");
  if (sourceUrl) {
    lines.push("        <p>");
    lines.push(`          <strong>Source:</strong> <a href="${sourceUrl}">${sourceUrl}</a>`);
    lines.push("        </p>");
  }
  lines.push("      </header>");
  lines.push("      <section>");
  lines.push(`      ${renderBodyHtml(post.body)}`);
  lines.push("      </section>");
  lines.push("      <footer>");
  lines.push(`        <small>Post ID: ${escapeHtml(post.id)}</small>`);
  lines.push("      </footer>");
  lines.push("    </article>");
  lines.push("  </main>");
  lines.push("</body>");
  lines.push("</html>");

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

  if (acceptsArticleHtml(request)) {
    return new Response(toArticleHtmlDocument(serialized), {
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
