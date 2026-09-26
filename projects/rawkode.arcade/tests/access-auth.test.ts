import { expect, test } from "bun:test";
import { verifyAccessJwt } from "../src/server/access";
import type { Env } from "../src/env";

const encode = (value: unknown) => btoa(JSON.stringify(value)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");

async function signedToken(privateKey: CryptoKey, claims: Record<string, unknown>): Promise<string> {
	const header = encode({ alg: "RS256", kid: "test-key" });
	const payload = encode(claims);
	const signature = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", privateKey, new TextEncoder().encode(`${header}.${payload}`)));
	let raw = "";
	for (const byte of signature) raw += String.fromCharCode(byte);
	return `${header}.${payload}.${btoa(raw).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "")}`;
}

test("accepts only a signed Cloudflare Access JWT with matching issuer and audience", async () => {
	const pair = await crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
	const publicJwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
	publicJwk.kid = "test-key";
	const originalFetch = globalThis.fetch;
	globalThis.fetch = async () => Response.json({ keys: [publicJwk] });
	try {
		const env = { CF_ACCESS_TEAM_DOMAIN: "team.cloudflareaccess.com", CF_ACCESS_AUD: "arcade-aud" } as Env;
		const now = Date.now();
		const token = await signedToken(pair.privateKey, { sub: "access-subject", email: "host@example.com", iss: "https://team.cloudflareaccess.com", aud: ["arcade-aud"], exp: Math.floor(now / 1_000) + 60 });
		expect((await verifyAccessJwt(token, env, now))?.sub).toBe("access-subject");
		const wrongAudience = await signedToken(pair.privateKey, { sub: "access-subject", iss: "https://team.cloudflareaccess.com", aud: "other", exp: Math.floor(now / 1_000) + 60 });
		expect(await verifyAccessJwt(wrongAudience, env, now)).toBeUndefined();
	} finally { globalThis.fetch = originalFetch; }
});
