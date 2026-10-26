// Who is calling the CMS: a person signed in through id.rawkode.academy (role
// claims for the rawkode-academy-cms client), or an agent with an API token.
import type { Actor } from "@rawkodeacademy/content-write";

export const ROLES = [
	"content_admin",
	"content_agent",
	"content_guest",
	"content_partner",
] as const;
export type Role = (typeof ROLES)[number];

export interface Principal {
	actor: Actor;
	roles: Role[];
	/** How the request authenticated; cookie sessions get CSRF checks. */
	via: "session" | "token";
}

export const SESSION_COOKIE = "cms-session";
export const SESSION_SECONDS = 60 * 60 * 12;
export const TOKEN_PREFIX = "cms_";

export const ID_PROVIDER_URL = "https://id.rawkode.academy";
export const CLIENT_ID = "rawkode-academy-cms";
const ROLE_CLAIM = "https://rawkode.academy/roles";

const encoder = new TextEncoder();

export function base64Url(bytes: Uint8Array): string {
	let binary = "";
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary)
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/, "");
}

export function randomToken(bytes = 32): string {
	const buffer = new Uint8Array(bytes);
	crypto.getRandomValues(buffer);
	return base64Url(buffer);
}

export async function sha256(value: string): Promise<string> {
	const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
	return base64Url(new Uint8Array(digest));
}

/** Content roles from userinfo claims, ignoring roles other clients define. */
export function rolesFromClaims(claims: Record<string, unknown>): Role[] {
	const raw = claims[ROLE_CLAIM] ?? claims.roles ?? [];
	const list = Array.isArray(raw) ? raw : [];
	return ROLES.filter((role) => list.includes(role));
}

export function readCookie(request: Request, name: string): string | undefined {
	const header = request.headers.get("cookie") ?? "";
	for (const part of header.split(";")) {
		const [key, ...rest] = part.trim().split("=");
		if (key === name) return decodeURIComponent(rest.join("="));
	}
	return undefined;
}

export function sessionCookie(value: string, maxAge = SESSION_SECONDS): string {
	return `${SESSION_COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

// ------------------------------------------------------------- sessions

export interface SessionUser {
	id: string;
	name: string;
	email?: string | null;
	roles: Role[];
}

export async function createSession(
	db: D1Database,
	user: SessionUser,
	now = Date.now(),
): Promise<string> {
	const token = randomToken();
	// Expired sessions are swept whenever someone signs in.
	await db.prepare("DELETE FROM sessions WHERE expires_at < ?").bind(now).run();
	await db
		.prepare(
			"INSERT INTO sessions (id_hash, user_id, name, email, roles, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
		)
		.bind(
			await sha256(token),
			user.id,
			user.name,
			user.email ?? null,
			JSON.stringify(user.roles),
			now + SESSION_SECONDS * 1000,
			now,
		)
		.run();
	return token;
}

export async function deleteSession(
	db: D1Database,
	token: string,
): Promise<void> {
	await db
		.prepare("DELETE FROM sessions WHERE id_hash = ?")
		.bind(await sha256(token))
		.run();
}

// ---------------------------------------------------------------- tokens

export interface ApiTokenRecord {
	id: string;
	name: string;
	role: Role;
	createdBy: string;
	createdAt: number;
	lastUsedAt: number | null;
	revokedAt: number | null;
}

/** Creates a token; the returned secret is the only copy. */
export async function createApiToken(
	db: D1Database,
	input: { name: string; role: Role; createdBy: string },
	now = Date.now(),
): Promise<{ id: string; secret: string }> {
	const id = randomToken(9);
	const secret = `${TOKEN_PREFIX}${id}_${randomToken()}`;
	await db
		.prepare(
			"INSERT INTO api_tokens (id, name, role, secret_hash, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?)",
		)
		.bind(
			id,
			input.name,
			input.role,
			await sha256(secret),
			input.createdBy,
			now,
		)
		.run();
	return { id, secret };
}

export async function listApiTokens(db: D1Database): Promise<ApiTokenRecord[]> {
	const { results } = await db
		.prepare(
			"SELECT id, name, role, created_by, created_at, last_used_at, revoked_at FROM api_tokens ORDER BY created_at DESC",
		)
		.all<Record<string, unknown>>();
	return results.map((r) => ({
		id: String(r.id),
		name: String(r.name),
		role: r.role as Role,
		createdBy: String(r.created_by),
		createdAt: Number(r.created_at),
		lastUsedAt: r.last_used_at === null ? null : Number(r.last_used_at),
		revokedAt: r.revoked_at === null ? null : Number(r.revoked_at),
	}));
}

export async function revokeApiToken(
	db: D1Database,
	id: string,
	now = Date.now(),
) {
	await db
		.prepare(
			"UPDATE api_tokens SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL",
		)
		.bind(now, id)
		.run();
}

// --------------------------------------------------------- authenticate

/** Resolves the caller from a bearer token or the session cookie. */
export async function authenticate(
	request: Request,
	db: D1Database,
	now = Date.now(),
): Promise<Principal | null> {
	const header = request.headers.get("authorization") ?? "";
	const bearer = /^Bearer\s+(\S+)$/i.exec(header)?.[1];
	if (bearer) {
		if (!bearer.startsWith(TOKEN_PREFIX)) return null;
		const row = await db
			.prepare(
				"SELECT id, name, role FROM api_tokens WHERE secret_hash = ? AND revoked_at IS NULL",
			)
			.bind(await sha256(bearer))
			.first<{ id: string; name: string; role: Role }>();
		if (!row || !ROLES.includes(row.role)) return null;
		await db
			.prepare("UPDATE api_tokens SET last_used_at = ? WHERE id = ?")
			.bind(now, row.id)
			.run();
		return {
			actor: { id: `token:${row.id}`, kind: "agent", name: row.name },
			roles: [row.role],
			via: "token",
		};
	}
	const cookie = readCookie(request, SESSION_COOKIE);
	if (!cookie) return null;
	const session = await db
		.prepare(
			"SELECT user_id, name, roles, expires_at FROM sessions WHERE id_hash = ?",
		)
		.bind(await sha256(cookie))
		.first<{
			user_id: string;
			name: string;
			roles: string;
			expires_at: number;
		}>();
	if (!session || session.expires_at < now) return null;
	const roles = (JSON.parse(session.roles) as string[]).filter((r): r is Role =>
		(ROLES as readonly string[]).includes(r),
	);
	if (roles.length === 0) return null;
	return {
		actor: { id: session.user_id, kind: "user", name: session.name },
		roles,
		via: "session",
	};
}

/**
 * Cookie-authenticated writes must come from the CMS itself: same Origin and a
 * JSON (or multipart upload) body, which a cross-site form cannot send.
 */
export function sameOriginWrite(request: Request, origin: string): boolean {
	if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return true;
	return request.headers.get("origin") === origin;
}

// ------------------------------------------------------------------ OIDC

export function callbackUrl(origin: string): string {
	return `${origin}/api/auth/callback`;
}

export async function authorizationRequest(
	origin: string,
	returnTo: string,
): Promise<{ url: string; verifier: string; state: string }> {
	const verifier = randomToken();
	const challenge = base64Url(
		new Uint8Array(
			await crypto.subtle.digest("SHA-256", encoder.encode(verifier)),
		),
	);
	const state = `${randomToken(12)}.${base64Url(encoder.encode(safeReturnTo(returnTo)))}`;
	const url = new URL("/auth/oauth2/authorize", ID_PROVIDER_URL);
	url.searchParams.set("client_id", CLIENT_ID);
	url.searchParams.set("redirect_uri", callbackUrl(origin));
	url.searchParams.set("response_type", "code");
	url.searchParams.set("scope", "openid profile email");
	url.searchParams.set("state", state);
	url.searchParams.set("code_challenge", challenge);
	url.searchParams.set("code_challenge_method", "S256");
	return { url: url.toString(), verifier, state };
}

/** Only same-site paths: never redirect to another origin after sign-in. */
export function safeReturnTo(path: string | null | undefined): string {
	if (!path || !path.startsWith("/")) return "/";
	// Browsers treat a backslash like "/" and drop tabs and newlines, so
	// "/<backslash>evil.com" would leave the site. Resolve it and keep it only if it stays on origin.
	if (/[\\\u0000-\u001f\u007f]/.test(path)) return "/";
	const base = "https://cms.invalid";
	const resolved = new URL(path, base);
	if (resolved.origin !== base) return "/";
	return `${resolved.pathname}${resolved.search}${resolved.hash}`;
}

export function returnToFromState(state: string): string {
	const encoded = state.split(".")[1] ?? "";
	try {
		const padded = encoded.replace(/-/g, "+").replace(/_/g, "/");
		return safeReturnTo(atob(padded));
	} catch {
		return "/";
	}
}

export async function exchangeCode(
	origin: string,
	code: string,
	verifier: string,
	fetcher: typeof fetch = fetch,
): Promise<{ access_token: string } | null> {
	const response = await fetcher(`${ID_PROVIDER_URL}/auth/oauth2/token`, {
		method: "POST",
		headers: { "content-type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			grant_type: "authorization_code",
			code,
			redirect_uri: callbackUrl(origin),
			client_id: CLIENT_ID,
			code_verifier: verifier,
		}),
	});
	if (!response.ok) {
		console.error(
			"[cms] token exchange failed",
			response.status,
			await response.text(),
		);
		return null;
	}
	return (await response.json()) as { access_token: string };
}

export async function fetchUserInfo(
	accessToken: string,
	fetcher: typeof fetch = fetch,
): Promise<Record<string, unknown> | null> {
	const response = await fetcher(`${ID_PROVIDER_URL}/auth/oauth2/userinfo`, {
		headers: { authorization: `Bearer ${accessToken}` },
	});
	if (!response.ok) return null;
	return (await response.json()) as Record<string, unknown>;
}
