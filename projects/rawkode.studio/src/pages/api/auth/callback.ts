import { Zitadel } from "@/lib/zitadel";
import type { APIRoute } from "astro";

const zitadel = new Zitadel();

export const GET: APIRoute = async (
  { cookies, redirect, request },
): Promise<Response> => {
  const url = new URL(request.url);
  const searchParams = url.searchParams;

  const code = searchParams.get("code");
  const state = searchParams.get("state");

  if (!code || !state) {
    return new Response(null, {
      status: 401,
      statusText: "Unable to authenticate user. PKCE flow not completed",
    });
  }

  const cookieState = cookies.get("state");
  const cookieCodeVerifier = cookies.get("codeVerifier");

  cookies.delete("state", {
    secure: false,
    path: "/",
    httpOnly: true,
  });

  cookies.delete("codeVerifier", {
    secure: false,
    path: "/",
    httpOnly: true,
  });

  if (!cookieState || !cookieCodeVerifier) {
    return new Response(null, {
      status: 401,
      statusText: "Unable to authenticate user. PKCE flow not started",
    });
  }

  if (cookieState.value !== state) {
    return new Response(null, {
      status: 401,
      statusText: "Unable to authenticate user. State mismatch",
    });
  }

  let tokens = undefined;

  try {
    tokens = await zitadel.validateAuthorizationCode(
      code,
      cookieCodeVerifier.value,
    );
  } catch (e) {
    console.error(e);

    return new Response(null, {
      status: 500,
      statusText: "Unable to create authentication URL",
    });
  }

  cookies.set("accessToken", tokens.accessToken(), {
    secure: import.meta.env.MODE === "production",
    httpOnly: true,
    path: "/",
    maxAge: tokens.accessTokenExpiresInSeconds(),
    sameSite: import.meta.env.MODE === "production" ? "strict" : "lax",
  });

  cookies.set("idToken", tokens.idToken(), {
    secure: import.meta.env.MODE === "production",
    httpOnly: true,
    path: "/",
    maxAge: tokens.accessTokenExpiresInSeconds(),
    sameSite: import.meta.env.MODE === "production" ? "strict" : "lax",
  });

  return redirect("/");
};
