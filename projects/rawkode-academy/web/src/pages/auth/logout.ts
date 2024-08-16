import WorkOS from "@workos-inc/node";
import type { APIRoute } from "astro";
import { decodeJwt } from "jose";
import { getSessionFromCookie } from "../../middleware";

export const GET: APIRoute = async ({ cookies, redirect }) => {
	const { getSecret } = await import("astro:env/server");

	const session = await getSessionFromCookie(cookies);

	cookies.delete("wos-session", {
		path: "/",
		httpOnly: true,
		secure: true,
		sameSite: "lax",
	});


	if (!("accessToken" in session)) {
		return redirect("/");
	}

	const workos = new WorkOS(getSecret("WORKOS_API_KEY"));
	const sessionId = decodeJwt(session.accessToken).sid as string;
	return redirect(workos.userManagement.getLogoutUrl({
		sessionId
	}));
};
