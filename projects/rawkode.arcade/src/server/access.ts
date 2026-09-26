import type { Principal, Role } from "../domain/protocol";
import type { Env } from "../env";

type AccessClaims = { sub: string; email?: string; aud: string | string[]; iss: string; exp: number; nbf?: number };
type AccessJwk = JsonWebKey & { kid?: string };
type JwkSet = { keys: AccessJwk[] };

const text = new TextEncoder();
const jwks = new Map<string, { expiresAt: number; keys: Map<string, JsonWebKey> }>();

function base64UrlJson<T>(value: string): T | undefined {
	try {
		const padded = value.replaceAll("-", "+").replaceAll("_", "/") + "===".slice((value.length + 3) % 4);
		return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(padded), (character) => character.charCodeAt(0)))) as T;
	} catch { return undefined; }
}

function configuredDomain(env: Env): string | undefined {
	return env.CF_ACCESS_TEAM_DOMAIN?.trim().replace(/^https:\/\//, "").replace(/\/$/, "") || undefined;
}

async function signingKey(domain: string, kid: string): Promise<JsonWebKey | undefined> {
	const known = jwks.get(domain);
	if (known && known.expiresAt > Date.now()) return known.keys.get(kid);
	try {
		const response = await fetch(`https://${domain}/cdn-cgi/access/certs`, { headers: { accept: "application/json" } });
		if (!response.ok) return undefined;
		const document = await response.json<JwkSet>();
		const keys = new Map(document.keys.filter((key) => typeof key.kid === "string").map((key) => [key.kid!, key]));
		// Access rotates keys; retain them briefly but never indefinitely.
		jwks.set(domain, { expiresAt: Date.now() + 5 * 60_000, keys });
		return keys.get(kid);
	} catch {
		return undefined;
	}
}

/** Verifies the signed Access assertion; no CF identity header is trusted. */
export async function verifyAccessJwt(token: string | null, env: Env, now = Date.now()): Promise<AccessClaims | undefined> {
	const domain = configuredDomain(env);
	const expectedAudience = env.CF_ACCESS_AUD?.trim();
	if (!token || !domain || !expectedAudience) return undefined;
	const [encodedHeader, encodedClaims, encodedSignature, ...rest] = token.split(".");
	if (!encodedHeader || !encodedClaims || !encodedSignature || rest.length) return undefined;
	const header = base64UrlJson<{ alg?: string; kid?: string }>(encodedHeader);
	const claims = base64UrlJson<AccessClaims>(encodedClaims);
	if (!header || header.alg !== "RS256" || !header.kid || !claims || typeof claims.sub !== "string" || !claims.sub || typeof claims.exp !== "number") return undefined;
	const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
	if (!audience.includes(expectedAudience) || claims.iss !== `https://${domain}` || claims.exp * 1_000 <= now || (claims.nbf !== undefined && claims.nbf * 1_000 > now)) return undefined;
	const jwk = await signingKey(domain, header.kid);
	if (!jwk || jwk.kty !== "RSA") return undefined;
	try {
		const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
		const signature = Uint8Array.from(atob(encodedSignature.replaceAll("-", "+").replaceAll("_", "/") + "===".slice((encodedSignature.length + 3) % 4)), (character) => character.charCodeAt(0));
		return await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, signature, text.encode(`${encodedHeader}.${encodedClaims}`)) ? claims : undefined;
	} catch { return undefined; }
}

function fallbackRole(email: string | undefined, env: Env): Role | undefined {
	const entry = env.OPERATOR_EMAILS?.split(",").map((item) => item.trim()).find((item) => item.split(":")[0]?.toLowerCase() === email?.toLowerCase());
	if (!entry) return undefined;
	const role = entry.split(":")[1] || "producer";
	return role === "host" || role === "producer" || role === "moderator" ? role : undefined;
}

/** Maps verified Access identities to only configured/operator-table privileged roles. */
export async function authenticateAccess(request: Request, env: Env): Promise<Principal | undefined> {
	const claims = await verifyAccessJwt(request.headers.get("cf-access-jwt-assertion"), env);
	if (!claims) return undefined;
	const operator = await env.DB.prepare("SELECT id, role, display_name FROM arcade_operators WHERE identity_subject IN (?, ?) AND active = 1 LIMIT 1")
		.bind(`cf-access:${claims.sub}`, claims.sub).first<{ id: string; role: string; display_name: string }>();
	const role = operator?.role === "operator" ? "producer" : operator?.role as Role | undefined ?? fallbackRole(claims.email, env);
	if (!role || !["host", "producer", "moderator"].includes(role)) return undefined;
	return { id: operator?.id ?? `cf-access:${claims.sub}`, role, displayName: operator?.display_name ?? claims.email };
}
