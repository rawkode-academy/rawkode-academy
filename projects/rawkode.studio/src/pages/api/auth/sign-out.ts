import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { SESSION_COOKIE_NAME } from "../../../lib/auth/server";
import type { StudioEnv } from "../../../env";

export const POST: APIRoute = async (context) => {
	const sessionId = context.cookies.get(SESSION_COOKIE_NAME)?.value;
	const sessionKv = (env as unknown as StudioEnv).SESSION;
	if (sessionId && sessionKv) {
		await sessionKv.delete(`session:${sessionId}`);
	}
	context.cookies.delete(SESSION_COOKIE_NAME, { path: "/" });
	return context.redirect("/", 302);
};
