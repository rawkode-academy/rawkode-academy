import {
	authorSide,
	canComment,
	canSeeReview,
	canSignOff,
	canTriageTo,
	isTriage,
	parseNewComment,
	reviewsVisible,
	scopeFor,
} from "./access.ts";
import {
	authorizationUrl,
	challengeFor,
	exchangeCode,
	originOf,
	principalFromClaims,
	randomToken,
} from "./auth.ts";
import { seedComments, seedOrgs, seedReviews, previewPersonas } from "./seed.ts";
import { KvStore, type Store } from "./store.ts";
import type { Env, Persona, Session } from "./types.ts";
import { dashboardPage, loginPage, reviewPage } from "./views.ts";

const COOKIE = "portal_session";
const SESSION_MS = 1000 * 60 * 60 * 24 * 7;

const isPreview = (env: Env) => env.PREVIEW === "true";

const storeFor = (env: Env): Store =>
	new KvStore(env.STORE, isPreview(env) ? { orgs: seedOrgs, reviews: seedReviews, comments: seedComments } : null);

const headers = (extra: Record<string, string> = {}, nonce = ""): Headers => {
	const h = new Headers({
		"Content-Type": "text/html; charset=utf-8",
		"Cache-Control": "no-store",
		"X-Content-Type-Options": "nosniff",
		"Referrer-Policy": "same-origin",
		"Content-Security-Policy": `default-src 'self'; media-src 'self' https://interactive-examples.mdn.mozilla.net; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; frame-ancestors 'none'; form-action 'self'`,
		...extra,
	});
	return h;
};

const html = (body: string, nonce = "", status = 200, extra: Record<string, string> = {}) =>
	new Response(body, { status, headers: headers(extra, nonce) });

const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
	});

const redirect = (to: string, cookie?: string) => {
	const h = new Headers({ Location: to, "Cache-Control": "no-store" });
	if (cookie) h.append("Set-Cookie", cookie);
	return new Response(null, { status: 303, headers: h });
};

const cookieValue = (request: Request, name: string): string | null => {
	for (const part of (request.headers.get("Cookie") ?? "").split(";")) {
		const [key, ...rest] = part.trim().split("=");
		if (key === name) return rest.join("=");
	}
	return null;
};

const sessionCookie = (request: Request, id: string, maxAge: number) =>
	`${COOKIE}=${id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${new URL(request.url).protocol === "https:" ? "; Secure" : ""}`;

/** State-changing requests must come from this site. SameSite=Lax is the first line; this is the second. */
const sameOrigin = (request: Request, env: Env) =>
	request.headers.get("Origin") === originOf(env, request);

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);
		const store = storeFor(env);
		const nonce = randomToken(16);
		const preview = isPreview(env);

		if (url.pathname === "/healthz") return json({ ok: true });

		// Sign-in.
		if (url.pathname === "/login") {
			return html(loginPage(preview, previewPersonas), nonce);
		}
		if (url.pathname === "/login/start" && request.method === "GET" && !preview) {
			const state = randomToken();
			const verifier = randomToken(48);
			await store.putLogin(state, verifier);
			return redirect(authorizationUrl(env, originOf(env, request), state, await challengeFor(verifier)));
		}
		if (url.pathname === "/api/auth/callback" && !preview) {
			const state = url.searchParams.get("state");
			const code = url.searchParams.get("code");
			const verifier = state ? await store.takeLogin(state) : null;
			if (!code || !verifier) return redirect("/login");
			const claims = await exchangeCode(env, originOf(env, request), code, verifier);
			const principal = claims ? principalFromClaims(claims) : null;
			if (!principal) return html(loginPage(false, []).replace("</main>", `<p>We couldn't sign you in. Ask Rawkode Academy to check your GitHub account is on your organisation.</p></main>`), nonce, 401);
			const id = randomToken();
			await store.putSession(id, { principal, expiresAt: Date.now() + SESSION_MS });
			return redirect("/", sessionCookie(request, id, SESSION_MS / 1000));
		}
		if (url.pathname === "/login/preview" && request.method === "POST" && preview) {
			if (!sameOrigin(request, env)) return json({ error: "Bad origin" }, 403);
			const key = String((await request.formData()).get("persona") ?? "");
			const persona = previewPersonas.find((item) => item.key === key);
			if (!persona) return redirect("/login");
			const id = randomToken();
			await store.putSession(id, { principal: persona.principal, expiresAt: Date.now() + SESSION_MS });
			return redirect("/", sessionCookie(request, id, SESSION_MS / 1000));
		}

		// Everything below needs a session.
		const sessionId = cookieValue(request, COOKIE);
		const session = sessionId ? await store.getSession(sessionId) : null;
		if (!session || !sessionId) {
			return url.pathname.startsWith("/api/") ? json({ error: "Sign in first" }, 401) : redirect("/login");
		}
		const principal = session.principal;
		// In production the organisation list comes from identity memberships until
		// it is linked to the collaborations data.
		const orgs = preview
			? await store.listOrgs()
			: principal.orgs.map((m) => ({ id: m.orgId, name: m.orgId, kind: "partner" as const }));
		const scope = scopeFor(session, orgs);

		if (request.method === "POST") {
			if (!sameOrigin(request, env)) return json({ error: "Bad origin" }, 403);
			if (url.pathname === "/logout") {
				await store.deleteSession(sessionId);
				return redirect("/login", sessionCookie(request, "", 0));
			}
			if (url.pathname === "/view-as") {
				if (!principal.admin) return json({ error: "Forbidden" }, 403);
				const target = String((await request.formData()).get("target") ?? "");
				const [orgId, persona] = target.split("|");
				if (!orgs.some((org) => org.id === orgId) || (persona !== "partner" && persona !== "supporter")) return redirect("/");
				const next: Session = { ...session, viewAs: { orgId, persona: persona as Persona } };
				await store.putSession(sessionId, next);
				console.log(JSON.stringify({ event: "view_as_start", admin: principal.login, orgId, persona }));
				return redirect("/");
			}
			if (url.pathname === "/view-as/exit") {
				const { viewAs: _gone, ...rest } = session;
				await store.putSession(sessionId, rest);
				return redirect("/");
			}
		}

		if (url.pathname === "/" && request.method === "GET") {
			const reviews = reviewsVisible(scope, orgs, await store.listReviews());
			return html(dashboardPage(session, scope, orgs, preview, reviews), nonce, 200);
		}

		const reviewMatch = url.pathname.match(/^\/reviews\/([\w-]+)$/);
		if (reviewMatch && request.method === "GET") {
			const review = await store.getReview(reviewMatch[1]);
			if (!review || !canSeeReview(scope, orgs, review)) return html(page404(), nonce, 404);
			const comments = await store.listComments(review.id);
			return html(
				reviewPage({
					session, scope, orgs, preview, review, comments, nonce, principal,
					canComment: canComment(scope, review),
					canSignOff: canSignOff(scope, principal, review),
				}),
				nonce,
			);
		}

		const commentPost = url.pathname.match(/^\/api\/reviews\/([\w-]+)\/comments$/);
		if (commentPost && request.method === "POST") {
			if (!sameOrigin(request, env)) return json({ error: "Bad origin" }, 403);
			const review = await store.getReview(commentPost[1]);
			if (!review || !canSeeReview(scope, orgs, review)) return json({ error: "Not found" }, 404);
			if (!canComment(scope, review)) return json({ error: "Comments are closed" }, 403);
			const parsed = parseNewComment(await request.json().catch(() => null));
			if (!parsed.ok) return json({ error: parsed.error }, 400);
			const comment = {
				id: crypto.randomUUID(),
				reviewId: review.id,
				draftVersion: review.draftVersion,
				authorLogin: principal.login,
				authorName: principal.name,
				authorSide: authorSide(scope),
				timestampMs: parsed.timestampMs,
				body: parsed.body,
				triage: "new" as const,
				createdAt: new Date().toISOString(),
			};
			await store.putComment(comment);
			return json(comment, 201);
		}

		const triagePost = url.pathname.match(/^\/api\/comments\/([\w-]+)\/triage$/);
		if (triagePost && request.method === "POST") {
			if (!sameOrigin(request, env)) return json({ error: "Bad origin" }, 403);
			const comment = await store.getComment(triagePost[1]);
			const review = comment ? await store.getReview(comment.reviewId) : null;
			if (!comment || !review || !canSeeReview(scope, orgs, review)) return json({ error: "Not found" }, 404);
			const body = (await request.json().catch(() => ({}))) as { triage?: unknown; note?: unknown };
			if (!isTriage(body.triage) || !canTriageTo(scope, principal, comment, body.triage)) {
				return json({ error: "You can't do that" }, 403);
			}
			const updated = {
				...comment,
				triage: body.triage,
				...(typeof body.note === "string" && body.note.trim() ? { triageNote: body.note.trim().slice(0, 500) } : {}),
			};
			await store.putComment(updated);
			return json(updated);
		}

		const signoffPost = url.pathname.match(/^\/api\/reviews\/([\w-]+)\/signoff$/);
		if (signoffPost && request.method === "POST") {
			if (!sameOrigin(request, env)) return json({ error: "Bad origin" }, 403);
			const review = await store.getReview(signoffPost[1]);
			if (!review || !canSeeReview(scope, orgs, review)) return json({ error: "Not found" }, 404);
			if (!canSignOff(scope, principal, review)) return json({ error: "You can't sign this off" }, 403);
			await store.putReview({
				...review,
				state: "approved",
				partnerApprovedBy: principal.name,
				partnerApprovedAt: new Date().toISOString(),
			});
			return json({ ok: true });
		}

		return html(page404(), nonce, 404);
	},
} satisfies ExportedHandler<Env>;

const page404 = () => `<!doctype html><title>Not found</title><main style="font:16px system-ui;max-width:40rem;margin:3rem auto"><h1>Not found</h1><a href="/">Back to the portal</a></main>`;
