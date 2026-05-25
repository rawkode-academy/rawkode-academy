import { defineMiddleware } from "astro:middleware";
import { env } from "cloudflare:workers";
import { and, eq, gt } from "drizzle-orm";
import { getDb, schema } from "@/db/client";
import { SESSION_COOKIE_NAME, getSignInUrl } from "@/lib/auth/server";

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

export const onRequest = defineMiddleware(async (context, next) => {
	context.locals.user = null;
	context.locals.roles = [];

	const sessionId = context.cookies.get(SESSION_COOKIE_NAME)?.value;
	if (sessionId) {
		const db = getDb(env.DB);
		const row = await db
			.select()
			.from(schema.sessions)
			.where(
				and(
					eq(schema.sessions.id, sessionId),
					gt(schema.sessions.expiresAt, new Date()),
				),
			)
			.get();

		if (row) {
			context.locals.user = {
				id: row.userId,
				email: row.userEmail,
				name: row.userName,
				image: row.userImage,
			};

			const roleRows = await db
				.select({ role: schema.userRoles.role })
				.from(schema.userRoles)
				.where(eq(schema.userRoles.userId, row.userId))
				.all();
			context.locals.roles = roleRows.map((r) => r.role as Role);

			await db
				.update(schema.sessions)
				.set({ lastSeenAt: new Date() })
				.where(eq(schema.sessions.id, sessionId));
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

	if (pathname.startsWith(ADMIN_PREFIX) && !context.locals.roles.includes("admin")) {
		return new Response("Forbidden", { status: 403 });
	}

	return next();
});
