import type { APIRoute } from "astro";
import { SESSION_COOKIE_NAME, type StoredSession } from "@/lib/auth";
import { getPermissions } from "@/lib/permissions";
export const GET: APIRoute = async (context) => {
  const sessionId = context.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionId) {
    return new Response(null, { status: 204 });
  }

  const session = (await context.locals.runtime.env.SESSION.get(
    `session:${sessionId}`,
    "json",
  )) as StoredSession | null;

  if (!session) {
    return new Response(null, { status: 204 });
  }

  if (session.expiresAt <= Date.now()) {
    await context.locals.runtime.env.SESSION.delete(`session:${sessionId}`);
    context.cookies.delete(SESSION_COOKIE_NAME, { path: "/" });
    return new Response(null, { status: 204 });
  }

  const permissions = getPermissions(session.user);
  return Response.json({ user: session.user, permissions });
};
