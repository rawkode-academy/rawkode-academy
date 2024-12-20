import type { APIRoute } from "astro";
import { ZITADEL_CLIENT_ID, ZITADEL_URL } from "astro:env/server";

export const GET: APIRoute = ({ cookies, redirect }) => {
  cookies.delete("idToken", {
    secure: import.meta.env.MODE === "production",
    httpOnly: true,
    path: "/",
    sameSite: "lax",
  });

  cookies.delete("accessToken", {
    secure: import.meta.env.MODE === "production",
    httpOnly: true,
    path: "/",
    sameSite: "lax",
  });

  const redirectUri = new URL("/login", import.meta.env.SITE);

  return redirect(
    `${ZITADEL_URL}/oidc/v1/end_session?post_logout_redirect_uri=${redirectUri.toString()}&client_id=${ZITADEL_CLIENT_ID}`,
  );
};
