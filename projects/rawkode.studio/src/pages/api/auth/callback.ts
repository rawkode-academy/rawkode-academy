import { createHmac } from "node:crypto";
import { AUTH_STATE_SECRET } from "astro:env/server";
import { Zitadel } from "@/lib/zitadel";
import type { APIRoute } from "astro";

const zitadel = new Zitadel();

export const GET: APIRoute = async ({
  cookies,
  request,
}): Promise<Response> => {
  const url = new URL(request.url);
  const searchParams = url.searchParams;

  const code = searchParams.get("code");
  const state = searchParams.get("state");

  if (!code || !state) {
    return new Response(null, {
      status: 401,
      statusText: "Authentication failed",
    });
  }

  // Only need to retrieve the code verifier - state is self-contained
  const cookieCodeVerifier = cookies.get("codeVerifier");

  cookies.delete("codeVerifier", {
    secure: import.meta.env.MODE === "production",
    path: "/",
    httpOnly: true,
  });

  if (!cookieCodeVerifier) {
    return new Response(null, {
      status: 401,
      statusText: "Authentication failed",
    });
  }

  // Decode and validate the state
  let returnTo = "/";
  try {
    // Decode the state from base64url
    const decodedState = JSON.parse(
      Buffer.from(state, "base64url").toString("utf-8"),
    );

    // Extract signature and state data
    const { signature, ...stateData } = decodedState;

    if (!signature) {
      return new Response(null, {
        status: 401,
        statusText: "Authentication failed",
      });
    }

    // Verify HMAC signature
    const expectedSignature = createHmac("sha256", AUTH_STATE_SECRET)
      .update(JSON.stringify(stateData))
      .digest("base64url");

    if (signature !== expectedSignature) {
      return new Response(null, {
        status: 401,
        statusText: "Authentication failed",
      });
    }

    // Check timestamp to ensure state isn't too old
    const stateAge = Date.now() - stateData.timestamp;
    if (stateAge > 10 * 60 * 1000) {
      // 10 minutes
      return new Response(null, {
        status: 401,
        statusText: "Authentication failed",
      });
    }

    // Extract returnTo from the verified state
    if (stateData.returnTo) {
      returnTo = stateData.returnTo;
    }
  } catch (e) {
    console.error("State validation failed:", e);
    return new Response(null, {
      status: 401,
      statusText: "Authentication failed",
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
      statusText: "Authentication service error",
    });
  }

  cookies.set("accessToken", tokens.accessToken(), {
    secure: import.meta.env.MODE === "production",
    httpOnly: true,
    path: "/",
    maxAge: tokens.accessTokenExpiresInSeconds(),
    sameSite: "strict",
  });

  cookies.set("idToken", tokens.idToken(), {
    secure: import.meta.env.MODE === "production",
    httpOnly: true,
    path: "/",
    maxAge: tokens.accessTokenExpiresInSeconds(),
    sameSite: "strict",
  });

  // Determine the redirect URL - use returnTo from state if available and valid
  let redirectUrl = import.meta.env.SITE;

  if (returnTo && returnTo !== "/") {
    // Validate that the returnTo URL is safe (same origin)
    try {
      const returnToUrl = new URL(returnTo, import.meta.env.SITE);
      const siteUrl = new URL(import.meta.env.SITE);

      // Only allow redirects to the same origin
      if (returnToUrl.origin === siteUrl.origin) {
        redirectUrl = returnToUrl.toString();
      }
    } catch {
      // If URL parsing fails, use default redirect
    }
  }

  const redirectHtml = `<html><head><meta http-equiv="refresh" content="0;URL='${redirectUrl}'"/></head><body><p>Moved to <a href="${redirectUrl}">${redirectUrl}</a>.</p></body></html>`;

  return new Response(redirectHtml, {
    status: 200,
    headers: { "Content-Type": "text/html" },
  });
};
