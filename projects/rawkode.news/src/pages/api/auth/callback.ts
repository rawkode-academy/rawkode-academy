import type { APIRoute } from "astro";
import {
  createSession,
  exchangeCodeForTokens,
  getUserInfo,
  parseState,
  SESSION_COOKIE_NAME,
  SESSION_DURATION_SECONDS,
} from "@/lib/auth";
import { PKCE_COOKIE_NAME } from "./sign-in";

export const GET: APIRoute = async (context) => {
  const code = context.url.searchParams.get("code");
  const state = context.url.searchParams.get("state");
  const error = context.url.searchParams.get("error");
  const codeVerifier = context.cookies.get(PKCE_COOKIE_NAME)?.value;
  if (error) {
    return context.redirect("/?error=auth_failed", 302);
  }

  if (!code) {
    return context.redirect("/?error=missing_code", 302);
  }

  if (!codeVerifier) {
    return context.redirect("/?error=missing_pkce_verifier", 302);
  }

  context.cookies.delete(PKCE_COOKIE_NAME, { path: "/" });

  const { returnTo } = state ? parseState(state) : { returnTo: "/" };
  const tokens = await exchangeCodeForTokens(
    code,
    context.url.origin,
    codeVerifier,
  );
  if (!tokens) {
    return context.redirect("/?error=token_exchange_failed", 302);
  }

  const userInfo = await getUserInfo(tokens.access_token);
  if (!userInfo) {
    return context.redirect("/?error=userinfo_failed", 302);
  }
  if (!userInfo.name || !userInfo.name.trim()) {
    return context.redirect("/?error=missing_name", 302);
  }

  const sessionId = crypto.randomUUID();
  const session = createSession(userInfo);

  await context.locals.runtime.env.SESSION.put(
    `session:${sessionId}`,
    JSON.stringify(session),
    { expirationTtl: SESSION_DURATION_SECONDS },
  );

  context.cookies.set(SESSION_COOKIE_NAME, sessionId, {
    path: "/",
    httpOnly: true,
    secure: context.url.protocol === "https:",
    sameSite: "lax",
    maxAge: SESSION_DURATION_SECONDS,
  });

  return context.redirect(returnTo, 302);
};
