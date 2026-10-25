// Media uploads: files go to the public content bucket under
// <collection>/<id>/, served by the content service at content.rawkode.academy.
// Image dimensions are read from the file header so covers get their
// width/height without decoding the image.

export const MEDIA_BASE_URL = "https://content.rawkode.academy";
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

const ALLOWED_TYPES = new Map<string, string>([
	["image/png", "png"],
	["image/jpeg", "jpg"],
	["image/webp", "webp"],
	["image/gif", "gif"],
	["image/svg+xml", "svg"],
	["image/avif", "avif"],
	["application/pdf", "pdf"],
]);

export interface Dimensions {
	width: number;
	height: number;
}

export function extensionFor(contentType: string): string | undefined {
	return ALLOWED_TYPES.get(
		contentType.split(";")[0]?.trim().toLowerCase() ?? "",
	);
}

/** A safe object key: kebab-case base name, the type's extension, under the entity. */
export function mediaKey(
	collection: string,
	id: string,
	filename: string,
	contentType: string,
	unique: string,
): string | undefined {
	const extension = extensionFor(contentType);
	if (!extension) return undefined;
	if (
		!/^[a-z0-9][a-z0-9-]*$/.test(collection) ||
		!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(id)
	) {
		return undefined;
	}
	const base =
		filename
			.replace(/\.[^.]*$/, "")
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-+|-+$/g, "")
			.slice(0, 60) || "file";
	return `${collection}/${id}/${base}-${unique}.${extension}`;
}

const u16be = (b: Uint8Array, i: number) =>
	((b[i] ?? 0) << 8) | (b[i + 1] ?? 0);
const u16le = (b: Uint8Array, i: number) =>
	(b[i] ?? 0) | ((b[i + 1] ?? 0) << 8);
const u24le = (b: Uint8Array, i: number) =>
	u16le(b, i) | ((b[i + 2] ?? 0) << 16);
const u32be = (b: Uint8Array, i: number) =>
	(((b[i] ?? 0) << 24) >>> 0) +
	((b[i + 1] ?? 0) << 16) +
	((b[i + 2] ?? 0) << 8) +
	(b[i + 3] ?? 0);
const ascii = (b: Uint8Array, i: number, n: number) =>
	String.fromCharCode(...b.subarray(i, i + n));

/** Width and height from a PNG, JPEG, GIF, WebP or SVG header, when present. */
export function imageDimensions(bytes: Uint8Array): Dimensions | undefined {
	// PNG: IHDR follows the 8-byte signature.
	if (bytes[0] === 0x89 && ascii(bytes, 1, 3) === "PNG") {
		return { width: u32be(bytes, 16), height: u32be(bytes, 20) };
	}
	// GIF
	if (ascii(bytes, 0, 3) === "GIF") {
		return { width: u16le(bytes, 6), height: u16le(bytes, 8) };
	}
	// WebP: lossy (VP8 ), lossless (VP8L) or extended (VP8X).
	if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") {
		const chunk = ascii(bytes, 12, 4);
		if (chunk === "VP8 ") {
			return {
				width: u16le(bytes, 26) & 0x3fff,
				height: u16le(bytes, 28) & 0x3fff,
			};
		}
		if (chunk === "VP8L") {
			const b0 = bytes[21] ?? 0;
			const b1 = bytes[22] ?? 0;
			const b2 = bytes[23] ?? 0;
			const b3 = bytes[24] ?? 0;
			return {
				width: 1 + (((b1 & 0x3f) << 8) | b0),
				height: 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6)),
			};
		}
		if (chunk === "VP8X") {
			return { width: 1 + u24le(bytes, 24), height: 1 + u24le(bytes, 27) };
		}
		return undefined;
	}
	// JPEG: walk segments to the first start-of-frame marker.
	if (bytes[0] === 0xff && bytes[1] === 0xd8) {
		let i = 2;
		while (i + 9 < bytes.length) {
			if (bytes[i] !== 0xff) return undefined;
			const marker = bytes[i + 1] ?? 0;
			const length = u16be(bytes, i + 2);
			const isFrame =
				marker >= 0xc0 &&
				marker <= 0xcf &&
				![0xc4, 0xc8, 0xcc].includes(marker);
			if (isFrame)
				return { height: u16be(bytes, i + 5), width: u16be(bytes, i + 7) };
			i += 2 + length;
		}
		return undefined;
	}
	// SVG: width/height attributes, else the viewBox.
	const head = new TextDecoder().decode(bytes.subarray(0, 4096));
	const svg = /<svg\b[^>]*>/i.exec(head)?.[0];
	if (svg) {
		const attr = (name: string) =>
			Number.parseFloat(
				new RegExp(`\\b${name}="([\\d.]+)(?:px)?"`).exec(svg)?.[1] ?? "",
			);
		const width = attr("width");
		const height = attr("height");
		if (width > 0 && height > 0)
			return { width: Math.round(width), height: Math.round(height) };
		const box = /viewBox="[\d.-]+[ ,]+[\d.-]+[ ,]+([\d.]+)[ ,]+([\d.]+)"/.exec(
			svg,
		);
		if (box) {
			return {
				width: Math.round(Number(box[1])),
				height: Math.round(Number(box[2])),
			};
		}
	}
	return undefined;
}
