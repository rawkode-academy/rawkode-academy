import type { Env, OrgRole, Principal } from "./types.ts";

const ROLE_CLAIM = "https://rawkode.academy/roles";
const ORGS_CLAIM = "https://rawkode.academy/orgs";
export const ADMIN_ROLE = "collab_admin";
const ORG_ROLES: readonly string[] = ["owner", "admin", "moderator", "contributor", "member"];

const base64Url = (bytes: Uint8Array): string =>
	btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");

export const randomToken = (bytes = 32): string =>
	base64Url(crypto.getRandomValues(new Uint8Array(bytes)));

export const challengeFor = async (verifier: string): Promise<string> =>
	base64Url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))));

export const originOf = (env: Env, request: Request): string =>
	env.PUBLIC_ORIGIN || new URL(request.url).origin;

export const authorizationUrl = (
	env: Env,
	origin: string,
	state: string,
	challenge: string,
): string => {
	const url = new URL("/auth/oauth2/authorize", env.OIDC_ISSUER);
	url.searchParams.set("client_id", env.OIDC_CLIENT_ID);
	url.searchParams.set("redirect_uri", `${origin}/api/auth/callback`);
	url.searchParams.set("response_type", "code");
	url.searchParams.set("scope", "openid profile roles");
	url.searchParams.set("state", state);
	url.searchParams.set("code_challenge", challenge);
	url.searchParams.set("code_challenge_method", "S256");
	return url.toString();
};

/** Turns identity's userinfo claims into a Principal. Pure: unit tested. */
export const principalFromClaims = (claims: Record<string, unknown>): Principal | null => {
	const sub = claims.sub;
	const login = claims.username ?? claims.preferred_username;
	if (typeof sub !== "string" || typeof login !== "string" || login === "") return null;
	const roles = Array.isArray(claims[ROLE_CLAIM])
		? (claims[ROLE_CLAIM] as unknown[])
		: Array.isArray(claims.roles)
			? (claims.roles as unknown[])
			: [];
	const rawOrgs = Array.isArray(claims[ORGS_CLAIM]) ? (claims[ORGS_CLAIM] as unknown[]) : [];
	const orgs = rawOrgs.flatMap((item) => {
		if (typeof item !== "object" || item === null) return [];
		const { id, role } = item as { id?: unknown; role?: unknown };
		return typeof id === "string" && typeof role === "string" && ORG_ROLES.includes(role)
			? [{ orgId: id, role: role as OrgRole }]
			: [];
	});
	return {
		userId: sub,
		login,
		name: typeof claims.name === "string" && claims.name !== "" ? claims.name : login,
		admin: roles.includes(ADMIN_ROLE),
		orgs,
	};
};

export const exchangeCode = async (
	env: Env,
	origin: string,
	code: string,
	verifier: string,
): Promise<Record<string, unknown> | null> => {
	const token = await fetch(new URL("/auth/oauth2/token", env.OIDC_ISSUER), {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			grant_type: "authorization_code",
			code,
			redirect_uri: `${origin}/api/auth/callback`,
			client_id: env.OIDC_CLIENT_ID,
			code_verifier: verifier,
		}),
	});
	if (!token.ok) return null;
	const { access_token } = (await token.json()) as { access_token?: string };
	if (!access_token) return null;
	const info = await fetch(new URL("/auth/oauth2/userinfo", env.OIDC_ISSUER), {
		headers: { Authorization: `Bearer ${access_token}` },
	});
	return info.ok ? ((await info.json()) as Record<string, unknown>) : null;
};
