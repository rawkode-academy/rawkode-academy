import { defineMiddleware } from "astro:middleware";
import { SESSION_COOKIE_NAME, type StoredSession } from "@/lib/auth";
import { acceptsArticleHtml } from "@/lib/content-negotiation";

const itemPathPattern = /^\/item\/([^/]+)\/?$/;

export const onRequest = defineMiddleware(async (context, next) => {
  const itemMatch = context.url.pathname.match(itemPathPattern);
  if (itemMatch && acceptsArticleHtml(context.request)) {
    const itemId = itemMatch[1];
    const targetUrl = new URL(
      `/api/posts/${encodeURIComponent(itemId)}${context.url.search}`,
      context.url,
    );
    const targetRequest = new Request(targetUrl.toString(), {
      method: "GET",
      headers: context.request.headers,
    });

    return context.rewrite(targetRequest);
  }

  const sessionId = context.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (sessionId) {
    try {
      const session = (await context.locals.runtime.env.SESSION.get(
        `session:${sessionId}`,
        "json",
      )) as StoredSession | null;

      if (session && session.expiresAt > Date.now()) {
        context.locals.user = session.user;
      } else if (session) {
        await context.locals.runtime.env.SESSION.delete(`session:${sessionId}`);
        context.cookies.delete(SESSION_COOKIE_NAME, { path: "/" });
      }
    } catch {
      // Ignore unreadable session payloads and continue the request.
    }
  }

  return next();
});
