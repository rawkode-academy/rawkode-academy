export const IMAGE_SERVICE_TEMPLATE_VERSION = "2026-05-24-1";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

const encodeBytes = (bytes: Uint8Array): string => {
	let binary = "";

	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}

	return btoa(binary)
		.replaceAll("+", "-")
		.replaceAll("/", "_")
		.replace(/=+$/u, "");
};

const decodeBytes = (encoded: string): Uint8Array => {
	const padded = encoded
		.replaceAll("-", "+")
		.replaceAll("_", "/")
		.padEnd(Math.ceil(encoded.length / 4) * 4, "=");
	const binary = atob(padded);
	const bytes = new Uint8Array(binary.length);

	for (let i = 0; i < binary.length; i += 1) {
		bytes[i] = binary.charCodeAt(i);
	}

	return bytes;
};

export const encodeImageServicePayload = (payload: unknown): string =>
	encodeBytes(textEncoder.encode(JSON.stringify(payload)));

export const decodeImageServicePayload = (payload: string): unknown =>
	JSON.parse(textDecoder.decode(decodeBytes(payload)));
