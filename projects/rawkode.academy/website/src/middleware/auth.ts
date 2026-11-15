import { defineMiddleware } from "astro:middleware";
import { env } from "cloudflare:workers";
import {
	getSession,
	getLocalSession,
	SESSION_COOKIE_NAME,
	type User,
} from "@/lib/auth/server";
import { createLogger } from "@/lib/logger";
import { isMobileGamePath, isMobileGameMethodAllowed } from "@/lib/auth/mobile";

const logger = createLogger("auth");

export const authMiddleware = defineMiddleware(async (context, next) => {
	if (context.isPrerendered) {
		return next();
	}

	// Service bindings to remote workers hang in local dev (workerd).
	// Use `"remote": true` in wrangler.jsonc services to enable remote proxy,
	// or skip auth entirely in dev.
	if (import.meta.env.DEV || process.env.NODE_ENV !== "production") {
		return next();
	}

	try {
		// Mobile access tokens are accepted only on game API routes. Do not fall
		// back to browser cookies when a caller supplies an invalid bearer token.
		const authorization = context.request.headers.get("authorization");
		if (authorization && isMobileGamePath(context.url.pathname)) {
			if (!isMobileGameMethodAllowed(context.url.pathname, context.request.method)) {
				return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { "Content-Type": "application/json", "Cache-Control": "private, no-store" } });
			}
			try {
				const response = await env.IDENTITY.fetch("https://id.rawkode.academy/api/mobile/session", {
					headers: { Authorization: authorization },
				});
				if (!response.ok) return new Response(JSON.stringify({ error: "Authentication required" }), {
					status: response.status === 503 ? 503 : 401,
					headers: { "Content-Type": "application/json", "Cache-Control": "private, no-store" },
				});
				const data = await response.json() as { user?: { id?: unknown; email?: unknown; name?: unknown; image?: unknown; username?: unknown; emailVerified?: unknown } };
				const u = data.user;
				if (!u || typeof u.id !== "string" || !u.id || typeof u.email !== "string" || typeof u.name !== "string" || (u.image !== null && typeof u.image !== "string") || (u.username !== null && typeof u.username !== "string") || (u.emailVerified !== 0 && u.emailVerified !== 1)) throw new Error("Invalid identity response");
				context.locals.user = { id: u.id, sub: u.id, email: u.email, name: u.name, image: u.image, username: u.username, emailVerified: u.emailVerified === 1, createdAt: new Date(), updatedAt: new Date() };
				return next();
			} catch {
				return new Response(JSON.stringify({ error: "Authentication unavailable" }), { status: 503, headers: { "Content-Type": "application/json", "Cache-Control": "private, no-store" } });
			}
		}

		// First, check for local session (OIDC flow)
		const localSessionId = context.cookies.get(SESSION_COOKIE_NAME)?.value;
		if (localSessionId && env.SESSION) {
			const localSession = await getLocalSession(
				localSessionId,
				env.SESSION as KVNamespace,
			);
			if (localSession) {
				const authenticatedUser: User & { sub: string } = {
					id: localSession.user.id,
					email: localSession.user.email,
					emailVerified: true,
					name: localSession.user.name,
					image: localSession.user.image,
					username: localSession.user.username ?? null,
					createdAt: new Date(),
					updatedAt: new Date(),
					sub: localSession.user.id,
				};
				context.locals.user = authenticatedUser;
				return next();
			}
		}

		// Fall back to identity provider session (legacy flow)
		const cookies = context.request.headers.get("Cookie") || "";
		if (!cookies) {
			return next();
		}

		const sessionData = await getSession(cookies, env);

		if (sessionData?.user) {
			const authenticatedUser: User & { sub: string } = {
				...sessionData.user,
				image: sessionData.user.image ?? null,
				sub: sessionData.user.id,
			};
			context.locals.user = authenticatedUser;
		}

		return next();
	} catch (error) {
		logger.error("Auth middleware error", error);
		return next();
	}
});
