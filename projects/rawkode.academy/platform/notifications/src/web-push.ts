import type {
	NotificationPayload,
	PushSubscriptionInput,
} from "./contracts.js";

const RECORD_SIZE = 4096;
const JWT_TTL_SECONDS = 12 * 60 * 60;

export class WebPushSubscriptionExpiredError extends Error {
	constructor(
		message: string,
		readonly status: number,
	) {
		super(message);
		this.name = "WebPushSubscriptionExpiredError";
	}
}

export interface WebPushConfig {
	publicKey: string;
	privateKey: string;
	subject: string;
	now?: () => number;
}

export interface WebPushResult {
	status: number;
}

type Fetcher = typeof fetch;

interface EcdhDeriveBitsParams extends SubtleCryptoDeriveKeyAlgorithm {
	public: CryptoKey;
	$public: CryptoKey;
}

function concatBytes(...parts: Uint8Array[]): Uint8Array {
	const totalLength = parts.reduce((sum, part) => sum + part.byteLength, 0);
	const output = new Uint8Array(totalLength);
	let offset = 0;
	for (const part of parts) {
		output.set(part, offset);
		offset += part.byteLength;
	}
	return output;
}

export function bytesToBase64Url(bytes: Uint8Array): string {
	let binary = "";
	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}
	return btoa(binary)
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/g, "");
}

export function base64UrlToBytes(value: string): Uint8Array {
	const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
	const padded = normalized.padEnd(
		normalized.length + (4 - (normalized.length % 4 || 4)),
		"=",
	);
	const binary = atob(padded);
	const output = new Uint8Array(binary.length);
	for (let index = 0; index < binary.length; index += 1) {
		output[index] = binary.charCodeAt(index);
	}
	return output;
}

function readDerLength(bytes: Uint8Array, offset: number): [number, number] {
	const first = bytes[offset];
	if (first === undefined) {
		throw new Error("Invalid ECDSA signature");
	}
	if ((first & 0x80) === 0) {
		return [first, offset + 1];
	}

	const lengthBytes = first & 0x7f;
	if (lengthBytes === 0 || lengthBytes > 2) {
		throw new Error("Invalid ECDSA signature length");
	}

	let length = 0;
	let nextOffset = offset + 1;
	for (let index = 0; index < lengthBytes; index += 1) {
		const byte = bytes[nextOffset];
		if (byte === undefined) {
			throw new Error("Invalid ECDSA signature length");
		}
		length = (length << 8) | byte;
		nextOffset += 1;
	}

	return [length, nextOffset];
}

function derIntegerToFixedLength(bytes: Uint8Array): Uint8Array {
	let start = 0;
	while (start < bytes.byteLength - 1 && bytes[start] === 0) {
		start += 1;
	}

	const value = bytes.slice(start);
	if (value.byteLength > 32) {
		throw new Error("Invalid ECDSA P-256 integer length");
	}

	const output = new Uint8Array(32);
	output.set(value, 32 - value.byteLength);
	return output;
}

function ecdsaSignatureToJose(signature: Uint8Array): Uint8Array {
	if (signature.byteLength === 64) {
		return signature;
	}
	if (signature[0] !== 0x30) {
		throw new Error("Invalid ECDSA signature");
	}

	const [sequenceLength, sequenceStart] = readDerLength(signature, 1);
	if (sequenceStart + sequenceLength !== signature.byteLength) {
		throw new Error("Invalid ECDSA signature length");
	}

	let offset = sequenceStart;
	if (signature[offset] !== 0x02) {
		throw new Error("Invalid ECDSA signature");
	}

	const [rLength, rStart] = readDerLength(signature, offset + 1);
	const r = signature.slice(rStart, rStart + rLength);
	offset = rStart + rLength;

	if (signature[offset] !== 0x02) {
		throw new Error("Invalid ECDSA signature");
	}

	const [sLength, sStart] = readDerLength(signature, offset + 1);
	const s = signature.slice(sStart, sStart + sLength);
	if (sStart + sLength !== signature.byteLength) {
		throw new Error("Invalid ECDSA signature length");
	}

	return concatBytes(derIntegerToFixedLength(r), derIntegerToFixedLength(s));
}

async function hmacSha256(
	keyBytes: Uint8Array,
	data: Uint8Array,
): Promise<Uint8Array> {
	const key = await crypto.subtle.importKey(
		"raw",
		keyBytes,
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	return new Uint8Array(
		(await crypto.subtle.sign("HMAC", key, data)) as ArrayBuffer,
	);
}

async function hkdfExpand(
	prk: Uint8Array,
	info: Uint8Array,
	length: number,
): Promise<Uint8Array> {
	const chunks: Uint8Array<ArrayBufferLike>[] = [];
	let previous: Uint8Array<ArrayBufferLike> = new Uint8Array();
	let counter = 1;

	while (chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0) < length) {
		previous = await hmacSha256(
			prk,
			concatBytes(previous, info, new Uint8Array([counter])),
		);
		chunks.push(previous);
		counter += 1;
	}

	const output = concatBytes(...chunks);
	return new Uint8Array(
		output.buffer.slice(output.byteOffset, output.byteOffset + length),
	);
}

async function importVapidPrivateKey(
	publicKey: string,
	privateKey: string,
): Promise<CryptoKey> {
	const publicBytes = base64UrlToBytes(publicKey);
	const privateBytes = base64UrlToBytes(privateKey);
	if (publicBytes.byteLength !== 65 || publicBytes[0] !== 4) {
		throw new Error("VAPID public key must be an uncompressed P-256 key");
	}
	if (privateBytes.byteLength !== 32) {
		throw new Error("VAPID private key must be a 32-byte P-256 scalar");
	}

	return crypto.subtle.importKey(
		"jwk",
		{
			kty: "EC",
			crv: "P-256",
			x: bytesToBase64Url(publicBytes.slice(1, 33)),
			y: bytesToBase64Url(publicBytes.slice(33, 65)),
			d: bytesToBase64Url(privateBytes),
			ext: false,
		},
		{ name: "ECDSA", namedCurve: "P-256" },
		false,
		["sign"],
	);
}

async function createVapidAuthorization(
	endpoint: string,
	config: WebPushConfig,
): Promise<string> {
	const audience = new URL(endpoint).origin;
	const now = config.now?.() ?? Date.now();
	const header = bytesToBase64Url(
		new TextEncoder().encode(JSON.stringify({ typ: "JWT", alg: "ES256" })),
	);
	const claims = bytesToBase64Url(
		new TextEncoder().encode(
			JSON.stringify({
				aud: audience,
				exp: Math.floor(now / 1000) + JWT_TTL_SECONDS,
				sub: config.subject,
			}),
		),
	);
	const token = `${header}.${claims}`;
	const key = await importVapidPrivateKey(config.publicKey, config.privateKey);
	const signature = new Uint8Array(
		await crypto.subtle.sign(
			{ name: "ECDSA", hash: "SHA-256" },
			key,
			new TextEncoder().encode(token),
		),
	);

	return `vapid t=${token}.${bytesToBase64Url(ecdsaSignatureToJose(signature))}, k=${config.publicKey}`;
}

async function encryptPayload(
	subscription: PushSubscriptionInput,
	payload: NotificationPayload,
): Promise<Uint8Array> {
	const receiverPublicKey = base64UrlToBytes(subscription.keys.p256dh);
	const authSecret = base64UrlToBytes(subscription.keys.auth);
	const salt = crypto.getRandomValues(new Uint8Array(16));
	const senderKeys = (await crypto.subtle.generateKey(
		{ name: "ECDH", namedCurve: "P-256" },
		true,
		["deriveBits"],
	)) as CryptoKeyPair;
	const receiverKey = await crypto.subtle.importKey(
		"raw",
		receiverPublicKey,
		{ name: "ECDH", namedCurve: "P-256" },
		false,
		[],
	);
	const senderPublicKey = new Uint8Array(
		(await crypto.subtle.exportKey("raw", senderKeys.publicKey)) as ArrayBuffer,
	);
	const deriveBitsParams: EcdhDeriveBitsParams = {
		name: "ECDH",
		public: receiverKey,
		$public: receiverKey,
	};
	const sharedSecret = new Uint8Array(
		await crypto.subtle.deriveBits(
			deriveBitsParams,
			senderKeys.privateKey,
			256,
		),
	);

	const authPrk = await hmacSha256(authSecret, sharedSecret);
	const keyInfo = concatBytes(
		new TextEncoder().encode("WebPush: info\0"),
		receiverPublicKey,
		senderPublicKey,
	);
	const ikm = await hkdfExpand(authPrk, keyInfo, 32);
	const prk = await hmacSha256(salt, ikm);
	const cek = await hkdfExpand(
		prk,
		new TextEncoder().encode("Content-Encoding: aes128gcm\0"),
		16,
	);
	const nonce = await hkdfExpand(
		prk,
		new TextEncoder().encode("Content-Encoding: nonce\0"),
		12,
	);
	const plaintext = concatBytes(
		new TextEncoder().encode(JSON.stringify(payload)),
		new Uint8Array([2]),
	);
	const key = await crypto.subtle.importKey(
		"raw",
		cek,
		{ name: "AES-GCM" },
		false,
		["encrypt"],
	);
	const ciphertext = new Uint8Array(
		await crypto.subtle.encrypt(
			{ name: "AES-GCM", iv: nonce, tagLength: 128 },
			key,
			plaintext,
		),
	);
	const recordSize = new Uint8Array(4);
	new DataView(recordSize.buffer).setUint32(0, RECORD_SIZE, false);

	return concatBytes(
		salt,
		recordSize,
		new Uint8Array([senderPublicKey.byteLength]),
		senderPublicKey,
		ciphertext,
	);
}

export async function sendWebPush(
	subscription: PushSubscriptionInput,
	payload: NotificationPayload,
	config: WebPushConfig,
	fetcher: Fetcher = fetch,
): Promise<WebPushResult> {
	const body = await encryptPayload(subscription, payload);
	const authorization = await createVapidAuthorization(
		subscription.endpoint,
		config,
	);
	const response = await fetcher(subscription.endpoint, {
		method: "POST",
		headers: {
			Authorization: authorization,
			"Content-Encoding": "aes128gcm",
			"Content-Type": "application/octet-stream",
			TTL: "86400",
			Urgency: "normal",
		},
		body,
	});

	if (response.status === 404 || response.status === 410) {
		throw new WebPushSubscriptionExpiredError(
			`Push subscription expired with status ${response.status}`,
			response.status,
		);
	}
	if (!response.ok) {
		throw new Error(`Push service returned ${response.status}`);
	}

	return { status: response.status };
}
