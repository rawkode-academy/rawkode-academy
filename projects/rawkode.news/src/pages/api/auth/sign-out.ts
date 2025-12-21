import type { APIRoute } from "astro";
import { SESSION_COOKIE_NAME } from "@/lib/auth";

export const GET: APIRoute = async (context) => {
  const sessionId = context.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (sessionId) {
    await context.locals.runtime.env.SESSION.delete(`session:${sessionId}`);
  }

  context.cookies.delete(SESSION_COOKIE_NAME, { path: "/" });

  const returnTo = context.url.searchParams.get("returnTo") || "/";
  return context.redirect(returnTo, 302);
};

export const POST: APIRoute = async (context) => GET(context);
