import type { APIRoute } from "astro";
import { buildAuthorizationUrl } from "@/lib/auth";
export const PKCE_COOKIE_NAME = "pkce_verifier";

export const GET: APIRoute = async (context) => {
  const returnTo = context.url.searchParams.get("returnTo") || "/";
  const { url, codeVerifier } = await buildAuthorizationUrl(
    context.url.origin,
    returnTo,
  );

  context.cookies.set(PKCE_COOKIE_NAME, codeVerifier, {
    path: "/",
    httpOnly: true,
    secure: context.url.protocol === "https:",
    sameSite: "lax",
    maxAge: 60 * 10,
  });

  return context.redirect(url, 302);
};
