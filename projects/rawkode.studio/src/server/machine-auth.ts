// Client half of the Studio -> Payload machine authentication scheme. The scheme,
// headers, replay rules and the verifier live in
// projects/rawkode.academy/payload/src/machine-auth.ts; this file must sign exactly
// the same canonical string, and MACHINE_AUTH_TEST_VECTOR must stay byte-identical.
//
// Every machine call from Studio to Payload (the review handoff in
// ./payload-handoff.ts and the broadcast times in ./payload-broadcast.ts) signs
// with this module and the shared STUDIO_MACHINE_SECRET from Cloudflare Secrets
// Store, and travels over the PAYLOAD service binding without cookies.

export const MACHINE_AUTH_SCHEME = "RAWKODE-HMAC-SHA256";
export const STUDIO_MACHINE_PRINCIPAL = "rawkode-studio";
export const machineAuthHeaders = {
	principal: "x-rawkode-principal",
	timestamp: "x-rawkode-timestamp",
	idempotencyKey: "idempotency-key",
	signature: "x-rawkode-signature",
} as const;

export type SecretSource = string | { get(): Promise<string> };

const encoder = new TextEncoder();

function hexOf(bytes: ArrayBuffer): string {
	return Array.from(new Uint8Array(bytes), (byte) =>
		byte.toString(16).padStart(2, "0")
	).join("");
}

export async function sha256Hex(body: string): Promise<string> {
	return hexOf(await crypto.subtle.digest("SHA-256", encoder.encode(body)));
}

function rfc3986(value: string): string {
	return encodeURIComponent(value).replace(
		/[!'()*]/g,
		(character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
	);
}

export function canonicalQuery(params: URLSearchParams | string): string {
	const entries = [...new URLSearchParams(params).entries()].map((
		[key, value],
	) => [rfc3986(key), rfc3986(value)] as const);
	entries.sort(([a, x], [b, y]) =>
		a < b ? -1 : a > b ? 1 : x < y ? -1 : x > y ? 1 : 0
	);
	return entries.map(([key, value]) => `${key}=${value}`).join("&");
}

export function canonicalRequest(parts: {
	method: string;
	path: string;
	query: string;
	principal: string;
	timestamp: number;
	idempotencyKey: string | null;
	bodySha256: string;
}): string {
	return [
		MACHINE_AUTH_SCHEME,
		parts.method.toUpperCase(),
		parts.path,
		parts.query,
		parts.principal,
		String(parts.timestamp),
		parts.idempotencyKey ?? "",
		parts.bodySha256,
	].join("\n");
}

export async function resolveMachineSecret(
	secret: SecretSource | null | undefined,
): Promise<string | null> {
	if (!secret) return null;
	try {
		const value = typeof secret === "string" ? secret : await secret.get();
		return value && value.length >= 32 ? value : null;
	} catch {
		return null;
	}
}

export async function signMachineRequest(
	secret: string,
	request: {
		method: string;
		path: string;
		query?: string;
		timestamp: number;
		idempotencyKey?: string | null;
		body?: string;
	},
): Promise<Record<string, string>> {
	const canonical = canonicalRequest({
		method: request.method,
		path: request.path,
		query: canonicalQuery(request.query ?? ""),
		principal: STUDIO_MACHINE_PRINCIPAL,
		timestamp: request.timestamp,
		idempotencyKey: request.idempotencyKey ?? null,
		bodySha256: await sha256Hex(request.body ?? ""),
	});
	const key = await crypto.subtle.importKey(
		"raw",
		encoder.encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const signature = hexOf(
		await crypto.subtle.sign("HMAC", key, encoder.encode(canonical)),
	);
	return {
		[machineAuthHeaders.principal]: STUDIO_MACHINE_PRINCIPAL,
		[machineAuthHeaders.timestamp]: String(request.timestamp),
		...(request.idempotencyKey
			? { [machineAuthHeaders.idempotencyKey]: request.idempotencyKey }
			: {}),
		[machineAuthHeaders.signature]: `v1=${signature}`,
	};
}

// Copied verbatim from Payload's src/machine-auth.ts.
export const MACHINE_AUTH_TEST_VECTOR = {
	secret: "rawkode-machine-auth-test-vector-secret-0001",
	method: "POST",
	path: "/api/studio-handoff/adoptions",
	query: "b=2&a=1",
	principal: "rawkode-studio",
	timestamp: 1760000000,
	idempotencyKey: "studio:session-1:recording-1:etag-1",
	body: '{"hello":"world"}',
	canonical:
		"RAWKODE-HMAC-SHA256\nPOST\n/api/studio-handoff/adoptions\na=1&b=2\nrawkode-studio\n1760000000\nstudio:session-1:recording-1:etag-1\n93a23971a914e5eacbf0a8d25154cda309c3c1c72fbb9914d47c60f3cb681588",
	signature:
		"v1=906f15bba00b6c75688880f3836c6381ab860b505931e803ad4e4faac82811bf",
} as const;
