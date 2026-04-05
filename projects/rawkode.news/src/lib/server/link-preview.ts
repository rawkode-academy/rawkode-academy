import { launch } from "@cloudflare/playwright";
import { POST_URL_MAX_LENGTH } from "@/lib/input-limits";
import { RequestError } from "@/lib/server/errors";

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);
const DISALLOWED_HOST_SUFFIXES = [".internal", ".local", ".localdomain", ".home.arpa"];
const MAX_HTML_LENGTH = 512_000;
const HTML_CONTENT_TYPES = ["text/html", "application/xhtml+xml"];
const BOT_CHALLENGE_PATTERNS = [
  /AwsWafIntegration/i,
  /window\.gokuProps/i,
  /id=["']challenge-container["']/i,
  /verify that you'?re not a robot/i,
  /This requires JavaScript\. Enable JavaScript and then reload the page\./i,
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
const isBotChallengeDocument = (documentHtml: string) =>
  BOT_CHALLENGE_PATTERNS.some((pattern) => pattern.test(documentHtml));

export const fetchLinkPreview = async (value: string, browserBinding: Env["BROWSER"]) => {
  const requestedUrl = normalizeLookupUrl(value);
  const browser = await launch({
    fetch: browserBinding.fetch.bind(browserBinding) as typeof fetch,
  });

  try {
    const page = await browser.newPage();
    const response = await page.goto(requestedUrl, {
      waitUntil: "domcontentloaded",
      timeout: 15_000,
    });

    if (!response) {
      throw new RequestError("Source did not return an HTML document", 422);
    }

    if (!response.ok()) {
      throw new RequestError(
        `Source returned ${response.status()}`,
        response.status() >= 500 ? 502 : 422,
      );
    }

    const contentType = response.headers()["content-type"]?.toLowerCase() ?? "";
    if (
      contentType &&
      !HTML_CONTENT_TYPES.some((allowedType) => contentType.includes(allowedType))
    ) {
      throw new RequestError("Source did not return an HTML document", 422);
    }

    await page
      .waitForFunction(
        () => {
          const meta =
            document.querySelector('meta[property="og:title"]') ??
            document.querySelector('meta[name="og:title"]') ??
            document.querySelector('meta[property="twitter:title"]') ??
            document.querySelector('meta[name="twitter:title"]');

          return Boolean(document.title.trim() || meta?.getAttribute("content")?.trim());
        },
        { timeout: 2_500 },
      )
      .catch(() => {});

    const documentHtml = (await page.content()).slice(0, MAX_HTML_LENGTH);
    if (isBotChallengeDocument(documentHtml)) {
      throw new RequestError("Source blocked automated title lookup", 422);
    }

    const title = await page.evaluate(() => {
      const selectors = [
        'meta[property="og:title"]',
        'meta[name="og:title"]',
        'meta[property="twitter:title"]',
        'meta[name="twitter:title"]',
      ];

      for (const selector of selectors) {
        const content = document.querySelector(selector)?.getAttribute("content")?.trim();
        if (content) {
          return content;
        }
      }

      const fallbackTitle = document.title.trim();
      return fallbackTitle || null;
    });

    return {
      title: title ? collapseWhitespace(title) : null,
      url: normalizeLookupUrl(page.url() || requestedUrl),
    };
  } catch (error) {
    if (error instanceof RequestError) {
      throw error;
    }
    if (error instanceof Error && /timeout/i.test(error.message)) {
      throw new RequestError("Source timed out during title lookup", 504);
    }
    throw new RequestError("Could not load page title", 502);
  } finally {
    await browser.close();
  }
};
