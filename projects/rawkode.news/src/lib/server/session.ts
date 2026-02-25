import type { AstroCookies } from "astro";
import { SESSION_COOKIE_NAME, type StoredSession } from "@/lib/auth";
import { getPermissions, type Permissions } from "@/lib/permissions";
import type { TypedEnv } from "@/types/service-bindings";

export const getSession = async (env: TypedEnv, cookies: AstroCookies) => {
  const sessionId = cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionId) {
    return null;
  }

  const session = (await env.SESSION.get(
    `session:${sessionId}`,
    "json",
  )) as StoredSession | null;

  if (!session) {
    return null;
  }

  if (session.expiresAt <= Date.now()) {
    await env.SESSION.delete(`session:${sessionId}`);
    cookies.delete(SESSION_COOKIE_NAME, { path: "/" });
    return null;
  }

  return session;
};

export const getSessionWithPermissions = async (
  env: TypedEnv,
  cookies: AstroCookies,
): Promise<{ session: StoredSession | null; permissions: Permissions | null }> => {
  const session = await getSession(env, cookies);
  if (!session) {
    return { session: null, permissions: null };
  }

  const permissions = await getPermissions(env, session.user.id);
  return { session, permissions };
};

export const buildReturnToPath = (url: URL) =>
  `${url.pathname}${url.search}${url.hash}`;
