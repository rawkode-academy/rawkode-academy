const encoder = new TextEncoder();

function base64Url(bytes: Uint8Array): string {
	let text = "";
	for (const byte of bytes) text += String.fromCharCode(byte);
	return btoa(text).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function decodeBase64Url(value: string): Uint8Array {
	const padded = value.replaceAll("-", "+").replaceAll("_", "/") + "===".slice((value.length + 3) % 4);
	return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}

export async function signJson(payload: unknown, secret: string): Promise<string> {
	const body = base64Url(encoder.encode(JSON.stringify(payload)));
	const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
	const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(body)));
	return `${body}.${base64Url(signature)}`;
}

export async function verifyJson<T>(token: string, secret: string): Promise<T | undefined> {
	const [body, signature] = token.split(".");
	if (!body || !signature) return undefined;
	const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
	const decodedSignature = decodeBase64Url(signature);
	const verified = await crypto.subtle.verify("HMAC", key, decodedSignature.buffer as ArrayBuffer, encoder.encode(body));
	if (!verified) return undefined;
	try { return JSON.parse(new TextDecoder().decode(decodeBase64Url(body))) as T; } catch { return undefined; }
}

export function randomId(prefix: string): string {
	return `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;
}
