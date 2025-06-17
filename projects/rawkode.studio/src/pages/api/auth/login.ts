import { AUTH_STATE_SECRET } from "astro:env/server";
import { createHmac, randomBytes } from "node:crypto";
import { generateCodeVerifier } from "arctic";
import type { APIRoute } from "astro";
import { Zitadel } from "@/lib/zitadel";

export const GET: APIRoute = ({ cookies, redirect, url }) => {
  const zitadel = new Zitadel();

  // Get the returnTo parameter from the query string
  const returnTo = url.searchParams.get("returnTo") || "/";

  // Create a custom state that includes both a random nonce and the returnTo URL
  const stateData = {
    nonce: randomBytes(32).toString("base64url"),
    returnTo: returnTo,
    timestamp: Date.now(),
  };

  // Create HMAC signature of the state data
  const signature = createHmac("sha256", AUTH_STATE_SECRET)
    .update(JSON.stringify(stateData))
    .digest("base64url");

  // Combine data and signature
  const signedState = {
    ...stateData,
    signature,
  };

  // Encode the signed state as base64url
  const state = Buffer.from(JSON.stringify(signedState)).toString("base64url");
  const codeVerifier = generateCodeVerifier();

  const authorizationURL = zitadel.createAuthorizationURL(state, codeVerifier);

  // Only store the code verifier - state is now self-contained with HMAC signature
  cookies.set("codeVerifier", codeVerifier, {
    secure: import.meta.env.MODE === "production",
    path: "/",
    httpOnly: true,
    maxAge: 60 * 10,
    sameSite: "lax", // Allow cookie during OAuth redirect flow
  });

  return redirect(authorizationURL.toString());
};
