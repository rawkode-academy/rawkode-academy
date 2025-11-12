import { join, dirname as pathDirname, basename } from "node:path";
import { resolveDataDirSync } from "@rawkodeacademy/content-technologies";

export function resolveTechnologyIconUrl(
	entryId: string,
	icon: unknown,
): string | undefined {
	// If already an Astro ImageMetadata, prefer .src
	if (icon && typeof icon === "object" && (icon as any).src) {
		return (icon as any).src as string;
	}

	if (typeof icon !== "string") return undefined;

	// Normalize: trim, strip wrapping quotes, and fix accidental ./ prefix on remote urls
	let value = icon.trim();
	if (
		(value.startsWith('"') && value.endsWith('"')) ||
		(value.startsWith("'") && value.endsWith("'"))
	) {
		value = value.slice(1, -1);
	}
	if (/^\.\/["']?https?:\/\//i.test(value)) {
		value = value.replace(/^\.\/["']?/i, "");
	}

	// Remote URL passthrough
	if (/^https?:\/\//i.test(value)) return value;

	// For relative paths like "./id.svg", create a dev-safe @fs URL.
	try {
		const base = resolveDataDirSync();
		const subdir = entryId.includes("/") ? pathDirname(entryId) : "";
		const abs = join(base, subdir, value);
		if (import.meta.env.DEV) {
			return "/@fs/" + abs;
		}
		// In production builds, prefer the content CDN for technology logos.
		// Fall back to the basename of the icon file.
		const file = basename(value);
		return `https://content.rawkode.academy/logos/technologies/${file}`;
	} catch {}
	return value;
}
