import {
	encodeImageServicePayload,
	IMAGE_SERVICE_TEMPLATE_VERSION,
} from "@/lib/image-service-payload";
import type { ImageServicePayload } from "@/types/image-service";
import type {
	OpenGraphImageFormat,
	OpenGraphImagePayload,
} from "@/types/opengraph";

export const OPEN_GRAPH_IMAGE_WIDTH = 1200;
export const OPEN_GRAPH_IMAGE_HEIGHT = 630;
export const IMAGE_SERVICE_URL = "https://image.rawkode.academy/image";
export const BRAND_NAME = "Rawkode Academy";
export const TITLE_MAX_LENGTH = 60;
export const META_DESCRIPTION_MAX_LENGTH = 160;
export const TWITTER_SITE_HANDLE = "@rawkodeacademy";
export const DEFAULT_SITE_URL = "https://rawkode.academy";

const DEFAULT_DESCRIPTION =
	"Hands-on cloud native lessons, articles, and tutorials from Rawkode Academy.";

const R2_VIDEO_THUMBNAIL_PATTERN =
	/^https:\/\/content\.rawkode\.academy\/videos\/[^/]+\/thumbnail\.webp(?:$|[?#])/i;

type OpenGraphImageInput = {
	title: string;
	ogTitle?: string | undefined;
	subtitle?: string | undefined;
	description?: string | undefined;
	image?: OpenGraphImagePayload | undefined;
	pageUrl: URL;
	useImageDirectly?: boolean | undefined;
};

export type ResolvedOpenGraphImage = {
	url: string;
	alt: string;
	width?: number | undefined;
	height?: number | undefined;
	type?: string | undefined;
};

const normalizeInlineText = (value?: string | null | undefined): string =>
	(value ?? "").replace(/\s+/g, " ").trim();

const stripTrailingLoneHighSurrogate = (value: string): string =>
	value.replace(/[\uD800-\uDBFF]$/, "");

const DATA_IMAGE_URI_PATTERN = /^data:\s*image\/[a-z0-9.+-]+(?:\s*[;,])/i;
const DATA_SVG_URI_PATTERN = /^data:\s*image\/svg\+xml(?:\s*[;,]|$)/i;

const decodePathnameOnce = (value: string): string => {
	if (!value.includes("%")) {
		return value;
	}
	try {
		return decodeURIComponent(value);
	} catch {
		return value.replace(/%[0-9a-fA-F]{2}/g, (match) => {
			try {
				return decodeURIComponent(match);
			} catch {
				return match;
			}
		});
	}
};

const decodeUrlPathname = (pathname: string): string => {
	let decoded = pathname;
	for (let i = 0; i < 2 && decoded.includes("%"); i += 1) {
		const next = decodePathnameOnce(decoded);
		if (next === decoded) {
			break;
		}
		decoded = next;
	}
	return decoded;
};

const isSafeHttpUrl = (candidate: URL): boolean =>
	(candidate.protocol === "http:" || candidate.protocol === "https:") &&
	candidate.username === "" &&
	candidate.password === "";

const imageUrlFromValue = (
	value: unknown,
	pageUrl: URL,
): string | undefined => {
	if (value instanceof URL) {
		if (isSafeHttpUrl(value)) {
			return value.href;
		}
		if (
			value.protocol === "data:" &&
			DATA_IMAGE_URI_PATTERN.test(value.href)
		) {
			return value.href;
		}
		return undefined;
	}

	if (typeof value !== "string") {
		return undefined;
	}

	const sanitized = value.replace(/[\t\r\n]+/g, "").trim();
	if (sanitized.length === 0) {
		return undefined;
	}

	if (/^data:/i.test(sanitized)) {
		return DATA_IMAGE_URI_PATTERN.test(sanitized) ? sanitized : undefined;
	}

	let safeBase: URL;
	try {
		safeBase =
			pageUrl instanceof URL && isSafeHttpUrl(pageUrl)
				? pageUrl
				: new URL(DEFAULT_SITE_URL);
	} catch {
		safeBase = new URL(DEFAULT_SITE_URL);
	}

	try {
		const parsed = new URL(sanitized, safeBase);
		return isSafeHttpUrl(parsed) ? parsed.href : undefined;
	} catch {
		return undefined;
	}
};

export const isSvgImageUrl = (url: string): boolean => {
	const trimmedUrl = url.replace(/[\t\r\n]+/g, "").trim();
	if (!trimmedUrl) {
		return false;
	}
	if (DATA_SVG_URI_PATTERN.test(trimmedUrl)) {
		return true;
	}
	try {
		const parsed = new URL(trimmedUrl, DEFAULT_SITE_URL);
		if (parsed.protocol === "data:") {
			return false;
		}
		const decodedPathname = decodeUrlPathname(parsed.pathname).toLowerCase();
		return decodedPathname.endsWith(".svg");
	} catch {
		const rawPath = decodeUrlPathname(trimmedUrl.split(/[?#]/)[0] ?? "");
		return /\.svg$/i.test(rawPath);
	}
};

export const inferImageMimeType = (
	imageUrl: string,
	explicitMimeType?: string | undefined,
	format?: OpenGraphImageFormat | string | undefined,
): string | undefined => {
	if (typeof explicitMimeType === "string") {
		const mediaType = explicitMimeType.split(";")[0]?.trim().toLowerCase() ?? "";
		if (mediaType.length > 0) {
			return mediaType === "image/jpg" ? "image/jpeg" : mediaType;
		}
	}

	const trimmedUrl = imageUrl.replace(/[\t\r\n]+/g, "").trim();
	const dataMimeMatch = trimmedUrl.match(
		/^data:\s*([a-z0-9.+-]+\/[a-z0-9.+-]+)/i,
	);
	if (dataMimeMatch?.[1]) {
		const dataMime = dataMimeMatch[1].toLowerCase();
		return dataMime === "image/jpg" ? "image/jpeg" : dataMime;
	}

	try {
		const parsed = new URL(trimmedUrl, DEFAULT_SITE_URL);
		if (parsed.protocol !== "data:") {
			const pathname = decodeUrlPathname(parsed.pathname).toLowerCase();
			if (pathname.endsWith(".svg")) return "image/svg+xml";
			if (pathname.endsWith(".png")) return "image/png";
			if (pathname.endsWith(".jpg") || pathname.endsWith(".jpeg")) {
				return "image/jpeg";
			}
			if (pathname.endsWith(".webp")) return "image/webp";
			if (pathname.endsWith(".gif")) return "image/gif";
			if (pathname.endsWith(".avif")) return "image/avif";
		}
	} catch {
		// Fall through to format hint if URL parsing fails.
	}

	const normalizedFormat = format?.trim().toLowerCase();
	switch (normalizedFormat) {
		case "svg":
			return "image/svg+xml";
		case "png":
			return "image/png";
		case "jpg":
		case "jpeg":
			return "image/jpeg";
		case "webp":
			return "image/webp";
		default:
			return undefined;
	}
};

export const formatPageTitle = (
	title?: string | null | undefined,
	maxLength = TITLE_MAX_LENGTH,
): string => {
	const collapsed = normalizeInlineText(title);
	if (!collapsed) {
		return BRAND_NAME;
	}

	const stripped = collapsed
		.replace(/(?:\s*[-–—|·:]+\s*rawkode\s+academy)+$/i, "")
		.trim();
	if (!stripped || stripped.toLowerCase() === BRAND_NAME.toLowerCase()) {
		return BRAND_NAME;
	}

	const containsBrand = /\brawkode\s+academy\b/i.test(stripped);
	const suffix = ` | ${BRAND_NAME}`;

	if (!containsBrand) {
		const dePiped = stripped.replace(/\s*\|\s*/g, " · ");
		if (dePiped.length + suffix.length <= maxLength) {
			return `${dePiped}${suffix}`;
		}
	}

	const parts = stripped.split(/\s*\|\s*/);
	if (parts.length <= 2) {
		return parts.join(" | ");
	}
	return `${parts.slice(0, -1).join(" · ")} | ${parts.at(-1)}`;
};

export const clampDescription = (
	description?: string | null | undefined,
	maxLength = META_DESCRIPTION_MAX_LENGTH,
): string => {
	const normalized = normalizeInlineText(description);
	if (!normalized || normalized.length <= maxLength) {
		return normalized;
	}
	if (maxLength < 2) {
		return stripTrailingLoneHighSurrogate(
			normalized.slice(0, Math.max(0, maxLength)),
		);
	}

	const budget = maxLength - 1;
	const window = normalized.slice(0, budget + 1);
	const lastSpace = window.lastIndexOf(" ");
	const minWordBoundary = maxLength > 60 ? 50 : 1;

	if (lastSpace >= minWordBoundary) {
		const cleaned = stripTrailingLoneHighSurrogate(
			stripTrailingLoneHighSurrogate(window.slice(0, lastSpace)).replace(
				/[,.;:\-–—\s]+$/,
				"",
			),
		);
		if (cleaned.length > 0) {
			return `${cleaned}…`;
		}
	}

	const safeSlice = stripTrailingLoneHighSurrogate(normalized.slice(0, budget));
	const hardSliced =
		stripTrailingLoneHighSurrogate(
			safeSlice.replace(/[,.;:\-–—\s]+$/, ""),
		) || safeSlice;
	return `${hardSliced}…`;
};

export const resolveCanonicalUrl = (
	canonicalUrl: URL | string | undefined,
	pathname: string,
	site?: URL | string | undefined,
): URL => {
	const defaultBase = new URL(DEFAULT_SITE_URL);
	let base: URL;
	try {
		const candidateBase = site
			? new URL(site.toString())
			: new URL(DEFAULT_SITE_URL);
		base = isSafeHttpUrl(candidateBase)
			? candidateBase
			: new URL(DEFAULT_SITE_URL);
	} catch {
		base = new URL(DEFAULT_SITE_URL);
	}
	const allowedOrigins = new Set([base.origin, defaultBase.origin]);

	const rawPathname = typeof pathname === "string" ? pathname : "/";
	const normalizedInputPath = (rawPathname || "/")
		.replace(/[\t\r\n]+/g, "")
		.replace(/\\/g, "/");
	const collapsedPath = `/${normalizedInputPath.replace(/^\/+/, "")}`;
	const safePathname =
		collapsedPath.length > 1
			? collapsedPath.replace(/\/+$/, "") || "/"
			: collapsedPath;

	let pageBase: URL;
	try {
		const candidatePage = new URL(safePathname, base);
		pageBase =
			isSafeHttpUrl(candidatePage) && candidatePage.origin === base.origin
				? candidatePage
				: new URL("/", base);
	} catch {
		pageBase = new URL("/", base);
	}

	let resolved: URL;
	if (canonicalUrl instanceof URL) {
		try {
			resolved = new URL(canonicalUrl.href);
		} catch {
			resolved = new URL(pageBase.href);
		}
	} else if (typeof canonicalUrl === "string") {
		const sanitized = canonicalUrl.replace(/[\t\r\n]+/g, "").trim();
		if (sanitized.length === 0) {
			resolved = new URL(pageBase.href);
		} else {
			try {
				if (/^[\/\\]{2,}/.test(sanitized)) {
					const collapsedNetworkPath = `/${sanitized.replace(/\\/g, "/").replace(/^\/+/, "")}`;
					resolved = new URL(collapsedNetworkPath, base);
				} else {
					resolved = new URL(sanitized.replace(/\\/g, "/"), pageBase);
				}
			} catch {
				resolved = new URL(pageBase.href);
			}
		}
	} else {
		resolved = new URL(pageBase.href);
	}

	if (!isSafeHttpUrl(resolved) || !allowedOrigins.has(resolved.origin)) {
		resolved = new URL(pageBase.href);
	}

	resolved.hash = "";
	const normalizedResolvedPath = resolved.pathname.replace(/\\/g, "/");
	const collapsedResolvedPath = `/${normalizedResolvedPath.replace(/^\/+/, "")}`;
	resolved.pathname =
		collapsedResolvedPath.length > 1
			? collapsedResolvedPath.replace(/\/+$/, "") || "/"
			: collapsedResolvedPath;
	return resolved;
};

export const serializeJsonLd = (value: unknown): string =>
	JSON.stringify(value)
		.replace(/</g, "\\u003c")
		.replace(/\u2028/g, "\\u2028")
		.replace(/\u2029/g, "\\u2029");

export const normalizeTwitterHandle = (
	value?: string | null | undefined,
): string | undefined => {
	if (typeof value !== "string") {
		return undefined;
	}
	const trimmed = value.trim();
	if (!trimmed) {
		return undefined;
	}

	const urlMatch = trimmed.match(
		/^https?:\/\/(?:www\.)?(?:x|twitter)\.com\/([^/?#]+)/i,
	);
	const candidate = (urlMatch?.[1] ?? trimmed).replace(/^@+/, "").trim();
	if (!candidate || /[\s/]/.test(candidate)) {
		return undefined;
	}
	return `@${candidate}`;
};

const positiveDimension = (value: number | undefined): number | undefined => {
	if (typeof value !== "number" || !Number.isFinite(value)) {
		return undefined;
	}
	const rounded = Math.round(value);
	return rounded >= 1 ? rounded : undefined;
};

export const resolveOpenGraphImage = ({
	title,
	ogTitle,
	subtitle,
	description,
	image,
	pageUrl,
	useImageDirectly = false,
}: OpenGraphImageInput): ResolvedOpenGraphImage => {
	const normalizedTitle = normalizeInlineText(title) || BRAND_NAME;
	const normalizedOgTitle = normalizeInlineText(ogTitle);
	const effectiveTitle = normalizedOgTitle || normalizedTitle;
	const normalizedAlt = normalizeInlineText(image?.alt);
	const resolvedAlt = normalizedAlt || effectiveTitle;
	const directImageUrl = imageUrlFromValue(image?.image, pageUrl);
	const isHttpDirectImage =
		directImageUrl !== undefined && /^https?:\/\//i.test(directImageUrl);
	const inferredMime = directImageUrl
		? inferImageMimeType(directImageUrl, image?.mimeType, image?.format)
		: undefined;
	const isSvg =
		image?.format?.trim().toLowerCase() === "svg" ||
		inferredMime === "image/svg+xml" ||
		(directImageUrl !== undefined && isSvgImageUrl(directImageUrl));

	if (useImageDirectly && isHttpDirectImage && !isSvg) {
		const isR2VideoThumbnail = R2_VIDEO_THUMBNAIL_PATTERN.test(directImageUrl);
		const width =
			positiveDimension(image?.width) ??
			(isR2VideoThumbnail ? 1280 : undefined);
		const height =
			positiveDimension(image?.height) ??
			(isR2VideoThumbnail ? 720 : undefined);

		return {
			url: directImageUrl,
			alt: resolvedAlt,
			...(inferredMime ? { type: inferredMime } : {}),
			...(width !== undefined ? { width } : {}),
			...(height !== undefined ? { height } : {}),
		};
	}

	const payloadImageUrl = isHttpDirectImage ? directImageUrl : undefined;

	const payload: ImageServicePayload = {
		format: "png",
		...(payloadImageUrl !== undefined ? { image: payloadImageUrl } : {}),
		text: image?.text ?? description ?? subtitle ?? DEFAULT_DESCRIPTION,
		title: effectiveTitle,
		...(subtitle !== undefined ? { subtitle } : {}),
		template: image?.template ?? "gradient",
	};

	const url = new URL(IMAGE_SERVICE_URL);
	url.searchParams.set("v", IMAGE_SERVICE_TEMPLATE_VERSION);
	url.searchParams.set("payload", encodeImageServicePayload(payload));

	return {
		url: url.href,
		alt: resolvedAlt,
		type: "image/png",
		width: OPEN_GRAPH_IMAGE_WIDTH,
		height: OPEN_GRAPH_IMAGE_HEIGHT,
	};
};
