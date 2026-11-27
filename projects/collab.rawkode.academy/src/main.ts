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
import { D1Directory, deriveOrgs, mergeLinks, type Directory } from "./directory.ts";
import { applyIngest, parseIngest, tokenMatches } from "./ingest.ts";
import { KvStore, type Store } from "./store.ts";
import type { Env, Persona, Session } from "./types.ts";
import { adminOrgsPage, dashboardPage, loginPage, reviewPage } from "./views.ts";

const COOKIE = "portal_session";
const SESSION_MS = 1000 * 60 * 60 * 24 * 7;

const storeFor = (env: Env): Store => new KvStore(env.STORE);

const directoryFor = (env: Env): Directory => new D1Directory(env);

const headers = (extra: Record<string, string> = {}, nonce = ""): Headers => {
	const h = new Headers({
		"Content-Type": "text/html; charset=utf-8",
		"Cache-Control": "no-store",
		"X-Content-Type-Options": "nosniff",
		"Referrer-Policy": "same-origin",
		"Content-Security-Policy": `default-src 'self'; media-src 'self' blob: https://content.rawkode.academy; connect-src 'self' https://content.rawkode.academy; script-src 'nonce-${nonce}' https://cdnjs.cloudflare.com; style-src 'unsafe-inline'; frame-ancestors 'none'; form-action 'self'`,
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

const redirect = (to: string, cookie?: string, status = 303) => {
	const h = new Headers({ Location: to, "Cache-Control": "no-store" });
	if (cookie) h.append("Set-Cookie", cookie);
	return new Response(null, { status, headers: h });
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

		if (url.hostname === "collab.rawkode.academy") {
			return redirect(`https://collaborate.rawkode.academy${url.pathname}${url.search}`, undefined, 301);
		}

		if (url.pathname === "/healthz") return json({ ok: true });

		// Machine endpoint: the encode workflow opens or refreshes a review when a draft is ready.
		if (url.pathname === "/api/ingest/review") {
			if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
			if (!tokenMatches(request.headers.get("authorization"), env.INGEST_TOKEN)) return json({ error: "Unauthorized" }, 401);
			const input = parseIngest(await request.json().catch(() => null));
			if (!input) return json({ error: "Invalid payload" }, 400);
			const ingestStore = storeFor(env);
			const orgLinks = mergeLinks(await ingestStore.listOrgLinks(), await directoryFor(env).collaboratorOrgLinks());
			if (!orgLinks.some((link) => link.orgId === input.orgId)) return json({ error: "Unknown organisation" }, 422);
			const review = applyIngest(await ingestStore.getReview(`${input.orgId}-${input.videoId}`), input, new Date());
			await ingestStore.putReview(review);
			console.log(JSON.stringify({ event: "review_ingested", reviewId: review.id, draftVersion: review.draftVersion }));
			return json({ id: review.id, draftVersion: review.draftVersion, url: `/reviews/${review.id}` }, 200);
		}

		// Sign-in.
		if (url.pathname === "/login") {
			return html(loginPage(), nonce);
		}
		if (url.pathname === "/login/start" && request.method === "GET") {
			const state = randomToken();
			const verifier = randomToken(48);
			await store.putLogin(state, verifier);
			return redirect(authorizationUrl(env, originOf(env, request), state, await challengeFor(verifier)));
		}
		if (url.pathname === "/api/auth/callback") {
			const state = url.searchParams.get("state");
			const code = url.searchParams.get("code");
			const verifier = state ? await store.takeLogin(state) : null;
			if (!code || !verifier) return redirect("/login");
			const claims = await exchangeCode(env, originOf(env, request), code, verifier);
			const principal = claims ? principalFromClaims(claims) : null;
			if (!principal) return html(loginPage().replace("</main>", `<p>We couldn't sign you in. Ask Rawkode Academy to check your GitHub account is on your organisation.</p></main>`), nonce, 401);
			const id = randomToken();
			await store.putSession(id, { principal, expiresAt: Date.now() + SESSION_MS });
			return redirect("/", sessionCookie(request, id, SESSION_MS / 1000));
		}
		// Everything below needs a session.
		const sessionId = cookieValue(request, COOKIE);
		const session = sessionId ? await store.getSession(sessionId) : null;
		if (!session || !sessionId) {
			return url.pathname.startsWith("/api/") ? json({ error: "Sign in first" }, 401) : redirect("/login");
		}
		const principal = session.principal;
		const directory = directoryFor(env);
		const links = mergeLinks(await store.listOrgLinks(), await directory.collaboratorOrgLinks());
		const [collaborators, supporters] = await Promise.all([directory.collaborators(), directory.supporters()]);
		const orgs = deriveOrgs(links, collaborators, supporters);
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
			if (url.pathname === "/admin/orgs" || url.pathname === "/admin/orgs/delete") {
				if (!principal.admin || session.viewAs) return json({ error: "Forbidden" }, 403);
				const form = await request.formData();
				const orgId = String(form.get("orgId") ?? "").trim();
				if (!/^[\w-]{1,64}$/.test(orgId)) return redirect("/admin/orgs?error=org");
				if (url.pathname === "/admin/orgs/delete") {
					await store.deleteOrgLink(orgId);
					return redirect("/admin/orgs");
				}
				const collaboratorId = String(form.get("collaboratorId") ?? "") || undefined;
				const supporterId = String(form.get("supporterId") ?? "") || undefined;
				const knownCollaborator = !collaboratorId || collaborators.some((item) => item.id === collaboratorId);
				const knownSupporter = !supporterId || supporters.some((item) => item.id === supporterId);
				if ((!collaboratorId && !supporterId) || !knownCollaborator || !knownSupporter) {
					return redirect("/admin/orgs?error=link");
				}
				await store.putOrgLink({ orgId, collaboratorId, supporterId });
				console.log(JSON.stringify({ event: "org_link", admin: principal.login, orgId, collaboratorId, supporterId }));
				return redirect("/admin/orgs");
			}
			if (url.pathname === "/admin/reviews") {
				if (!principal.admin || session.viewAs) return json({ error: "Forbidden" }, 403);
				const form = await request.formData();
				const videoId = String(form.get("videoId") ?? "").trim();
				const input = parseIngest({
					orgId: String(form.get("orgId") ?? ""),
					videoId,
					title: String(form.get("title") ?? ""),
					videoUrl: String(form.get("videoUrl") ?? "").trim() || `https://content.rawkode.academy/videos/${videoId}/stream.m3u8`,
					dueAt: String(form.get("dueAt") ?? "") || undefined,
				});
				if (!input || !links.some((link) => link.orgId === input.orgId)) return redirect("/admin/orgs?error=review");
				const review = applyIngest(await store.getReview(`${input.orgId}-${input.videoId}`), input, new Date());
				await store.putReview(review);
				console.log(JSON.stringify({ event: "review_opened", admin: principal.login, reviewId: review.id, draftVersion: review.draftVersion }));
				return redirect(`/reviews/${review.id}`);
			}
			if (url.pathname === "/view-as/exit") {
				const { viewAs: _gone, ...rest } = session;
				await store.putSession(sessionId, rest);
				return redirect("/");
			}
		}

		if (url.pathname === "/admin/orgs" && request.method === "GET") {
			if (!principal.admin || session.viewAs) return html(page404(), nonce, 404);
			return html(
				adminOrgsPage({ session, scope, orgs, links, collaborators, supporters, error: url.searchParams.get("error") }),
				nonce,
			);
		}

		if (url.pathname === "/" && request.method === "GET") {
			const reviews = reviewsVisible(scope, orgs, await store.listReviews());
			const partnerLinks = links.filter(
				(link) => link.collaboratorId && scope.orgIds.has(link.orgId) && orgs.find((org) => org.id === link.orgId)?.kind !== "supporter",
			);
			const collaborations = (
				await Promise.all(
					partnerLinks.map(async (link) => (await directory.collaborationsFor(link.collaboratorId!)).map((item) => ({ ...item, orgId: link.orgId }))),
				)
			).flat();
			const unlinked = !principal.admin && principal.orgs.length > 0 && scope.orgIds.size === 0;
			return html(dashboardPage(session, scope, orgs, reviews, collaborations, unlinked), nonce, 200);
		}

		const reviewMatch = url.pathname.match(/^\/reviews\/([\w-]+)$/);
		if (reviewMatch && request.method === "GET") {
			const review = await store.getReview(reviewMatch[1]);
			if (!review || !canSeeReview(scope, orgs, review)) return html(page404(), nonce, 404);
			const comments = await store.listComments(review.id);
			return html(
				reviewPage({
					session, scope, orgs, review, comments, nonce, principal,
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
