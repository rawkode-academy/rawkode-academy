import { defineMiddleware } from "astro:middleware";
import { env } from "cloudflare:workers";
import {
	getLocalSession,
	SESSION_COOKIE_NAME,
	getSignInUrl,
} from "@/lib/auth/server";

export type Role = "admin" | "competitor";

export interface PortalUser {
	id: string;
	email: string;
	name: string;
	image: string | null;
}

declare global {
	namespace App {
		interface Locals {
			user: PortalUser | null;
			roles: Role[];
		}
	}
}

const PUBLIC_PREFIXES = ["/api/auth/"];
const ADMIN_PREFIX = "/admin";
const COMPETITOR_PREFIX = "/me";

// Admins are an explicit allowlist of id.rawkode.academy user ids (OIDC subs),
// set via the KLUSTERED_ADMIN_IDS var. Everyone else who authenticates is a
// competitor and can manage their own details under /me.
function adminIds(): string[] {
	return (env.KLUSTERED_ADMIN_IDS ?? "")
		.split(",")
		.map((id) => id.trim())
		.filter(Boolean);
}

export const onRequest = defineMiddleware(async (context, next) => {
	context.locals.user = null;
	context.locals.roles = [];

	const sessionId = context.cookies.get(SESSION_COOKIE_NAME)?.value;
	if (sessionId) {
		const session = await getLocalSession(sessionId, env.SESSION);
		if (session) {
			context.locals.user = {
				id: session.user.id,
				email: session.user.email,
				name: session.user.name,
				image: session.user.image,
			};
			const isAdmin = adminIds().includes(session.user.id);
			context.locals.roles = isAdmin ? ["admin", "competitor"] : ["competitor"];
		} else {
			context.cookies.delete(SESSION_COOKIE_NAME, { path: "/" });
		}
	}

	const pathname = context.url.pathname;

	if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
		return next();
	}

	const requiresAuth =
		pathname.startsWith(ADMIN_PREFIX) || pathname.startsWith(COMPETITOR_PREFIX);

	if (requiresAuth && !context.locals.user) {
		return context.redirect(getSignInUrl(pathname), 302);
	}

	if (
		pathname.startsWith(ADMIN_PREFIX) &&
		!context.locals.roles.includes("admin")
	) {
		return new Response("Forbidden", { status: 403 });
	}

	return next();
});
