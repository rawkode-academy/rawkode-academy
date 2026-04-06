import { NodeHtmlMarkdown } from "node-html-markdown";
import type { NewsSourceType } from "@/domains/news-ingest/contracts";
import {
  NEWS_SOURCE_LOCATOR_MAX_LENGTH,
  NEWS_SOURCE_NAME_MAX_LENGTH,
  NEWS_SOURCE_STATUS_MAX_LENGTH,
} from "@/domains/news-ingest/input-limits";
import { POST_BODY_MAX_LENGTH, POST_TITLE_MAX_LENGTH } from "@/shared/input-limits";
import { RequestError } from "@/server/errors";
import { normalizeExternalUrl } from "@/shared/urls/normalization";

export const NEWS_PULL_ITEM_LIMIT = 20;

export type PulledNewsItem = {
  normalizedUrl: string;
  originalUrl: string;
  sourceItemUrl: string;
  sourceItemId: string | null;
  title: string;
  excerpt: string | null;
  authorName: string | null;
  publishedAt: Date | null;
};

const BLUESKY_PROFILE_URL_RE = /^https?:\/\/(?:www\.)?bsky\.app\/profile\/([^/?#]+)/iu;
const BLUESKY_DID_RE = /^did:[a-z0-9]+:[a-z0-9._:%-]+$/iu;
const BLUESKY_HANDLE_RE =
  /^(?!.*\.\.)(?=.{3,253}$)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/iu;
const NAMED_HTML_ENTITIES = new Map<string, string>([
  ["amp", "&"],
  ["apos", "'"],
  ["gt", ">"],
  ["lt", "<"],
  ["nbsp", " "],
  ["quot", "\""],
]);
const CONTROL_CHARS_RE = /[\u0000-\u001f\u007f]+/gu;
const HTML_FRAGMENT_RE = /<\/?[a-z][^>]*>/iu;
const htmlToMarkdown = new NodeHtmlMarkdown({
  bulletMarker: "-",
  codeBlockStyle: "fenced",
  emDelimiter: "*",
  strongDelimiter: "**",
  ignore: ["script", "style", "noscript"],
});

export const collapseWhitespace = (value: string) => value.replace(/\s+/gu, " ").trim();

export const truncateText = (value: string, maxLength: number) => {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
};

export const decodeHtmlEntities = (value: string) =>
  value.replace(/&(#x?[0-9a-f]+|[a-z][a-z0-9]+);/giu, (match, entity: string) => {
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

export const stripHtml = (value: string) =>
  value
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/giu, " ")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/giu, " ")
    .replace(/<[^>]+>/gu, " ");

const normalizeMarkdownWhitespace = (value: string) =>
  value
    .replace(/\r\n?/gu, "\n")
    .replace(/\u00a0/gu, " ")
    .replace(/[ \t]+\n/gu, "\n")
    .replace(/\n{3,}/gu, "\n\n")
    .replace(/[ \t]{2,}/gu, " ")
    .trim();

export const summarizeText = (value: string | null | undefined, maxLength = POST_BODY_MAX_LENGTH) => {
  if (!value) {
    return null;
  }

  const normalized = collapseWhitespace(
    decodeHtmlEntities(
      stripHtml(value).replace(CONTROL_CHARS_RE, " "),
    ),
  ).replace(/\s+([,.;!?])/gu, "$1");

  if (!normalized) {
    return null;
  }

  return truncateText(normalized, maxLength);
};

export const normalizeRichTextToMarkdown = (
  value: string | null | undefined,
  maxLength = POST_BODY_MAX_LENGTH,
) => {
  if (!value) {
    return null;
  }

  const normalizedInput = value.replace(CONTROL_CHARS_RE, " ").trim();
  if (!normalizedInput) {
    return null;
  }

  const decodedInput = decodeHtmlEntities(normalizedInput);
  const markdown = HTML_FRAGMENT_RE.test(decodedInput)
    ? htmlToMarkdown.translate(decodedInput)
    : decodedInput;
  const normalized = normalizeMarkdownWhitespace(markdown);

  if (!normalized) {
    return null;
  }

  return truncateText(normalized, maxLength);
};

export const normalizeCandidateTitle = (value: string | null | undefined, fallback = "Untitled source") => {
  const normalized = summarizeText(value, POST_TITLE_MAX_LENGTH);
  if (!normalized) {
    return fallback;
  }
  return normalized;
};

export const coerceDate = (value: unknown) => {
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value : null;
  }
  if (typeof value !== "string" && typeof value !== "number") {
    return null;
  }

  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
};

export const normalizeSourceName = (value: string) => {
  const normalized = collapseWhitespace(value);
  if (!normalized) {
    throw new RequestError("Source name is required", 400);
  }
  if (normalized.length > NEWS_SOURCE_NAME_MAX_LENGTH) {
    throw new RequestError(
      `Source name must be ${NEWS_SOURCE_NAME_MAX_LENGTH} characters or fewer`,
      400,
    );
  }
  return normalized;
};

export const truncateStatusMessage = (value: string | null | undefined) => {
  if (!value) {
    return null;
  }

  const normalized = collapseWhitespace(value);
  if (!normalized) {
    return null;
  }

  return truncateText(normalized, NEWS_SOURCE_STATUS_MAX_LENGTH);
};

export const normalizeBlueskyLocator = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new RequestError("Bluesky account is required", 400);
  }
  if (trimmed.length > NEWS_SOURCE_LOCATOR_MAX_LENGTH) {
    throw new RequestError(
      `Source locator must be ${NEWS_SOURCE_LOCATOR_MAX_LENGTH} characters or fewer`,
      400,
    );
  }

  const profileUrlMatch = trimmed.match(BLUESKY_PROFILE_URL_RE);
  const extracted = profileUrlMatch?.[1] ?? trimmed;
  const withoutPrefix = extracted.startsWith("@") ? extracted.slice(1) : extracted;
  const normalized = withoutPrefix.trim().toLowerCase();

  if (!normalized) {
    throw new RequestError("Bluesky account is required", 400);
  }
  if (/\s/u.test(normalized)) {
    throw new RequestError("Bluesky account cannot contain spaces", 400);
  }
  if (!BLUESKY_DID_RE.test(normalized) && !BLUESKY_HANDLE_RE.test(normalized)) {
    throw new RequestError("Bluesky account must be a handle or DID", 400);
  }

  return normalized;
};

export const normalizeSourceLocator = (type: NewsSourceType, value: string) => {
  if (type === "rss") {
    return normalizeExternalUrl(value);
  }
  return normalizeBlueskyLocator(value);
};
