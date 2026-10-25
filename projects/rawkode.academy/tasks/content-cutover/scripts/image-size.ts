// Intrinsic pixel size from an image header: PNG, JPEG, GIF, WebP, SVG.
import { readFileSync } from "node:fs";

export function imageSize(file: string): { width: number; height: number } | undefined {
	const b = readFileSync(file);
	// PNG: IHDR follows the 8-byte signature.
	if (b.readUInt32BE(0) === 0x89504e47) return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
	// GIF
	if (b.toString("ascii", 0, 3) === "GIF") return { width: b.readUInt16LE(6), height: b.readUInt16LE(8) };
	// JPEG: walk segments to the first SOFn.
	if (b[0] === 0xff && b[1] === 0xd8) {
		let i = 2;
		while (i < b.length) {
			if (b[i] !== 0xff) return undefined;
			const marker = b[i + 1] as number;
			const length = b.readUInt16BE(i + 2);
			if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc)
				return { height: b.readUInt16BE(i + 5), width: b.readUInt16BE(i + 7) };
			i += 2 + length;
		}
		return undefined;
	}
	// WebP
	if (b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") {
		const chunk = b.toString("ascii", 12, 16);
		if (chunk === "VP8 ") return { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
		if (chunk === "VP8L") {
			const bits = b.readUInt32LE(21);
			return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
		}
		if (chunk === "VP8X") return { width: b.readUIntLE(24, 3) + 1, height: b.readUIntLE(27, 3) + 1 };
		return undefined;
	}
	// SVG: width/height attributes, else the viewBox.
	const text = b.toString("utf8", 0, Math.min(b.length, 4096));
	const svg = text.match(/<svg\b[^>]*>/);
	if (svg) {
		const attr = (name: string) => svg[0].match(new RegExp(`\\s${name}="([\\d.]+)(?:px)?"`))?.[1];
		const w = attr("width");
		const h = attr("height");
		if (w && h) return { width: Math.round(Number(w)), height: Math.round(Number(h)) };
		const box = svg[0].match(/viewBox="[\d.-]+[\s,]+[\d.-]+[\s,]+([\d.]+)[\s,]+([\d.]+)"/);
		if (box) return { width: Math.round(Number(box[1])), height: Math.round(Number(box[2])) };
	}
	return undefined;
}
