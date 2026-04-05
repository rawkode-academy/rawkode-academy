import { POST_URL_MAX_LENGTH } from "@/lib/input-limits";
import { RequestError } from "@/lib/server/errors";

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);
const DISALLOWED_HOST_SUFFIXES = [".internal", ".local", ".localdomain", ".home.arpa"];
const MAX_HTML_LENGTH = 512_000;
const HTML_CONTENT_TYPES = ["text/html", "application/xhtml+xml"];
const PRIMARY_META_TITLE_NAMES = new Set(["og:title", "twitter:title"]);
const BOT_CHALLENGE_PATTERNS = [
  /AwsWafIntegration/i,
  /window\.gokuProps/i,
  /id=["']challenge-container["']/i,
  /verify that you'?re not a robot/i,
  /This requires JavaScript\. Enable JavaScript and then reload the page\./i,
] as const;
const NAMED_HTML_ENTITIES = new Map<string, string>([
  ["amp", "&"],
  ["apos", "'"],
  ["gt", ">"],
  ["lt", "<"],
  ["nbsp", " "],
  ["quot", "\""],
]);
const BROWSER_HEADER_PROFILES = [
  {
    secChUa: "\"Chromium\";v=\"147\", \"Google Chrome\";v=\"147\", \"Not.A/Brand\";v=\"99\"",
    secChUaPlatform: "\"macOS\"",
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.7727.50 Safari/537.36",
  },
  {
    secChUa: "\"Chromium\";v=\"147\", \"Google Chrome\";v=\"147\", \"Not.A/Brand\";v=\"99\"",
    secChUaPlatform: "\"Windows\"",
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.7727.50 Safari/537.36",
  },
] as const;

const collapseWhitespace = (value: string) => value.replace(/\s+/g, " ").trim();

const parseIpv4Octets = (hostname: string) => {
  const match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!match) {
    return null;
  }

  const octets = match.slice(1).map((part) => Number.parseInt(part, 10));
  if (octets.some((part) => Number.isNaN(part) || part < 0 || part > 255)) {
    return null;
  }

  return octets;
};

const isPrivateIpv4Address = (hostname: string) => {
  const octets = parseIpv4Octets(hostname);
  if (!octets) {
    return false;
  }

  const [first, second] = octets;
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  );
};

const stripIpv6Brackets = (hostname: string) => {
  if (hostname.startsWith("[") && hostname.endsWith("]")) {
    return hostname.slice(1, -1);
  }
  return hostname;
};

const isPrivateIpv6Address = (hostname: string) => {
  const normalized = stripIpv6Brackets(hostname).toLowerCase();
  if (!normalized.includes(":")) {
    return false;
  }

  const mappedIpv4 = normalized.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (mappedIpv4?.[1]) {
    return isPrivateIpv4Address(mappedIpv4[1]);
  }

  if (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("::ffff:")
  ) {
    return false;
  }

  const firstSegment = normalized.split(":")[0];
  if (!firstSegment) {
    return false;
  }

  const value = Number.parseInt(firstSegment, 16);
  if (!Number.isFinite(value)) {
    return false;
  }

  return (value & 0xfe00) === 0xfc00 || (value & 0xffc0) === 0xfe80;
};

const isDisallowedHost = (hostname: string) => {
  const normalized = stripIpv6Brackets(hostname).toLowerCase();
  if (!normalized) {
    return true;
  }

  if (
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    DISALLOWED_HOST_SUFFIXES.some((suffix) => normalized.endsWith(suffix))
  ) {
    return true;
  }

  if (!normalized.includes(".") && !normalized.includes(":")) {
    return true;
  }

  return isPrivateIpv4Address(normalized) || isPrivateIpv6Address(normalized);
};

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

  if (isDisallowedHost(parsed.hostname)) {
    throw new RequestError("URL must point to a public host", 400);
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

const isBotChallengeDocument = (documentHtml: string) =>
  BOT_CHALLENGE_PATTERNS.some((pattern) => pattern.test(documentHtml));

const extractMetaTitle = (documentHtml: string) => {
  for (const match of documentHtml.matchAll(/<meta\b[^>]*>/gi)) {
    const attributes = parseHtmlAttributes(match[0]);
    const property = (attributes.get("property") ?? attributes.get("name") ?? "")
      .trim()
      .toLowerCase();

    if (!PRIMARY_META_TITLE_NAMES.has(property)) {
      continue;
    }

    const content = collapseWhitespace(
      decodeHtmlEntities(attributes.get("content") ?? ""),
    );
    if (content) {
      return content;
    }
  }

  return null;
};

const extractDocumentTitle = (documentHtml: string) => {
  const metaTitle = extractMetaTitle(documentHtml);
  if (metaTitle) {
    return metaTitle;
  }

  const titleMatch = documentHtml.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  if (!titleMatch?.[1]) {
    return null;
  }

  const rawTitleText = titleMatch[1]
    .replace(/<[^>]+>/g, "")
    .replace(/[<>]/g, "");
  const value = collapseWhitespace(decodeHtmlEntities(rawTitleText));
  return value || null;
};

const hashHostname = (hostname: string) => {
  let value = 0;

  for (const character of hostname) {
    value = (value * 33 + character.charCodeAt(0)) >>> 0;
  }

  return value;
};

const getBrowserProfileSequence = (hostname: string) => {
  const primaryIndex = hashHostname(hostname) % BROWSER_HEADER_PROFILES.length;
  return BROWSER_HEADER_PROFILES.map((_, offset) =>
    BROWSER_HEADER_PROFILES[(primaryIndex + offset) % BROWSER_HEADER_PROFILES.length],
  );
};

const buildBrowserLikeHeaders = (
  profile: (typeof BROWSER_HEADER_PROFILES)[number],
) =>
  new Headers({
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Cache-Control": "max-age=0",
    Pragma: "no-cache",
    Priority: "u=0, i",
    "Sec-CH-UA": profile.secChUa,
    "Sec-CH-UA-Mobile": "?0",
    "Sec-CH-UA-Platform": profile.secChUaPlatform,
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Upgrade-Insecure-Requests": "1",
    "User-Agent": profile.userAgent,
  });

const shouldRetryWithNextProfile = (error: RequestError) =>
  error.status === 403 ||
  error.status === 429 ||
  error.message === "Source blocked automated title lookup";

const fetchPreviewWithProfile = async (
  requestedUrl: string,
  profile: (typeof BROWSER_HEADER_PROFILES)[number],
) => {
  const response = await fetch(requestedUrl, {
    headers: buildBrowserLikeHeaders(profile),
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
  console.log(documentHtml);
  if (isBotChallengeDocument(documentHtml)) {
    throw new RequestError("Source blocked automated title lookup", 422);
  }

  return {
    title: extractDocumentTitle(documentHtml),
    url: finalUrl,
  };
};

export const fetchLinkPreview = async (value: string) => {
  const requestedUrl = normalizeLookupUrl(value);
  const profiles = getBrowserProfileSequence(new URL(requestedUrl).hostname);
  let lastError: RequestError | null = null;

  for (const [index, profile] of profiles.entries()) {
    try {
      return await fetchPreviewWithProfile(requestedUrl, profile);
    } catch (error) {
      const requestError = error instanceof RequestError
        ? error
        : error instanceof Error && /timeout/i.test(error.message)
          ? new RequestError("Source timed out during title lookup", 504)
          : new RequestError("Could not load page title", 502);

      lastError = requestError;
      if (index === profiles.length - 1 || !shouldRetryWithNextProfile(requestError)) {
        throw requestError;
      }
    }
  }

  throw lastError ?? new RequestError("Could not load page title", 502);
};
