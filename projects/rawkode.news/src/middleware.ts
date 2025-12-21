import { defineMiddleware } from "astro:middleware";
import { SESSION_COOKIE_NAME, type StoredSession } from "@/lib/auth";

export const onRequest = defineMiddleware(async (context, next) => {
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
      return;
    }
  }

  return next();
});
