import { ZITADEL_CLIENT_ID, ZITADEL_URL } from "astro:env/server";
import type { APIRoute } from "astro";

export const prerender = false;

export const GET: APIRoute = ({ cookies, redirect }) => {
	cookies.delete("accessToken", {
		secure: import.meta.env.PROD === true,
		httpOnly: true,
		path: "/",
		sameSite: "strict",
	});

	return redirect(
		`${ZITADEL_URL}/oidc/v1/end_session?post_logout_redirect_uri=${import.meta.env.SITE}&client_id=${ZITADEL_CLIENT_ID}`,
	);
};
