import { POST_URL_MAX_LENGTH } from "@/shared/input-limits";
import { RequestError } from "@/server/errors";

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);
const MAX_HTML_LENGTH = 512_000;
const HTML_CONTENT_TYPES = ["text/html", "application/xhtml+xml"];
const PRIMARY_META_TITLE_NAMES = new Set(["og:title", "twitter:title"]);
const BROWSER_PROFILE = {
  secChUa: "\"Chromium\";v=\"147\", \"Google Chrome\";v=\"147\", \"Not.A/Brand\";v=\"99\"",
  secChUaPlatform: "\"macOS\"",
  userAgent:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.7727.50 Safari/537.36",
} as const;
const NAMED_HTML_ENTITIES = new Map<string, string>([
  ["amp", "&"],
  ["apos", "'"],
  ["gt", ">"],
  ["lt", "<"],
  ["nbsp", " "],
  ["quot", "\""],
]);

const collapseWhitespace = (value: string) => value.replace(/\s+/g, " ").trim();

const normalizeLookupUrl = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new RequestError("URL is required", 400);
  }
  if (trimmed.length > POST_URL_MAX_LENGTH) {
    throw new RequestError(
      `URL must be ${POST_URL_MAX_LENGTH} characters or fewer`,
      400,
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new RequestError("URL is invalid", 400);
  }

  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    throw new RequestError("URL must use http:// or https://", 400);
  }

  return parsed.toString();
};

const decodeHtmlEntities = (value: string) =>
  value.replace(/&(#x?[0-9a-f]+|[a-z][a-z0-9]+);/gi, (match, entity: string) => {
    const normalized = entity.toLowerCase();
    if (normalized.startsWith("#x")) {
      const codePoint = Number.parseInt(normalized.slice(2), 16);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
    }
    if (normalized.startsWith("#")) {
      const codePoint = Number.parseInt(normalized.slice(1), 10);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
    }
    return NAMED_HTML_ENTITIES.get(normalized) ?? match;
  });

const parseHtmlAttributes = (tagSource: string) => {
  const attributes = new Map<string, string>();
  const source = tagSource
    .replace(/^<meta\b/i, "")
    .replace(/\/?>\s*$/i, "");
  const attributePattern =
    /([^\s=/>]+)(?:\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

  for (const match of source.matchAll(attributePattern)) {
    const name = match[1]?.toLowerCase();
    if (!name || name === "/") {
      continue;
    }

    const value = match[3] ?? match[4] ?? match[5] ?? "";
    attributes.set(name, value);
  }

  return attributes;
};

const normalizeExtractedTitle = (value: string) =>
  collapseWhitespace(
    decodeHtmlEntities(
      value
        .replace(/<[^>]+>/g, " ")
        .replace(/[\u0000-\u001f\u007f]+/g, " "),
    ),
  );

const extractMetaTitle = (documentHtml: string) => {
  for (const match of documentHtml.matchAll(/<meta\b[^>]*>/gi)) {
    const attributes = parseHtmlAttributes(match[0]);
    const property = (attributes.get("property") ?? attributes.get("name") ?? "")
      .trim()
      .toLowerCase();

    if (!PRIMARY_META_TITLE_NAMES.has(property)) {
      continue;
    }

    const content = normalizeExtractedTitle(attributes.get("content") ?? "");
    if (content) {
      return content;
    }
  }

  return null;
};

const extractTitle = (documentHtml: string) => {
  const titleMatch = documentHtml.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  if (!titleMatch?.[1]) {
    return null;
  }

  const value = normalizeExtractedTitle(titleMatch[1]);
  return value || null;
};

const buildBrowserLikeHeaders = () =>
  new Headers({
    Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.1",
    "Accept-Language": "en-US,en;q=0.9",
    "Cache-Control": "max-age=0",
    Pragma: "no-cache",
    Priority: "u=0, i",
    "Sec-CH-UA": BROWSER_PROFILE.secChUa,
    "Sec-CH-UA-Mobile": "?0",
    "Sec-CH-UA-Platform": BROWSER_PROFILE.secChUaPlatform,
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Upgrade-Insecure-Requests": "1",
    "User-Agent": BROWSER_PROFILE.userAgent,
  });

export const fetchLinkPreview = async (value: string) => {
  const requestedUrl = normalizeLookupUrl(value);
  try {
    const response = await fetch(requestedUrl, {
      headers: buildBrowserLikeHeaders(),
      redirect: "follow",
    });

    if (!response.ok) {
      throw new RequestError(
        `Source returned ${response.status}`,
        response.status >= 500 ? 502 : response.status,
      );
    }

    const finalUrl = normalizeLookupUrl(response.url || requestedUrl);
    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
    if (
      contentType &&
      !HTML_CONTENT_TYPES.some((allowedType) => contentType.includes(allowedType))
    ) {
      throw new RequestError("Source did not return an HTML document", 422);
    }

    const documentHtml = (await response.text()).slice(0, MAX_HTML_LENGTH);
    const title = extractMetaTitle(documentHtml) ?? extractTitle(documentHtml);

    if (!title) {
      throw new RequestError("Could not extract page title", 422);
    }

    return {
      title,
      url: finalUrl,
    };
  } catch (error) {
    if (error instanceof RequestError) {
      throw error;
    }

    if (error instanceof Error && /timeout/i.test(error.message)) {
      throw new RequestError("Source timed out during title lookup", 504);
    }

    throw new RequestError("Could not load page title", 502);
  }
};
