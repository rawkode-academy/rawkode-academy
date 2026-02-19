import type { APIRoute, AstroCookies } from "astro";

import { SESSION_COOKIE_NAME, type StoredSession } from "@/lib/auth";
import type { TypedEnv } from "@/types/service-bindings";

const MIN_QUERY_LENGTH = 2;
const MAX_QUERY_LENGTH = 200;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 20;
const DEFAULT_AI_SEARCH_INSTANCE = "rawkode-news";
const VALID_CATEGORIES = new Set(["new", "rka", "show", "ask"]);

type SearchResultItem = {
  id: string;
  title: string;
  url: string;
  parsed: ParsedSearchContent | null;
  source: string | null;
};

type SearchResult = {
  items: SearchResultItem[];
  total: number;
  nextCursor: string | null;
};

type ParsedSearchContent = {
  id: string | null;
  title: string | null;
  author: string | null;
  content: string | null;
  source: string | null;
  category: string | null;
  publishedAt: string | null;
  comments: number | null;
};

const parseLimit = (value: string | null) => {
  if (!value) {
    return DEFAULT_LIMIT;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return DEFAULT_LIMIT;
  }

  return Math.min(MAX_LIMIT, Math.floor(parsed));
};

type AutoRagSearchDataItem = Awaited<
  ReturnType<ReturnType<Ai["autorag"]>["search"]>
>["data"][number];

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
};

const asString = (value: unknown) => {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeUrl = (value: unknown) => {
  const candidate = asString(value);
  if (!candidate) {
    return null;
  }

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.toString();
    }
    return null;
  } catch {
    return null;
  }
};

const parseDate = (value: unknown) => {
  const candidate = asString(value);
  if (!candidate) {
    return null;
  }

  const timestamp = Date.parse(candidate);
  if (!Number.isFinite(timestamp)) {
    return null;
  }

  return new Date(timestamp).toISOString();
};

const parseNumber = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }

  if (typeof value === "string") {
    const match = value.match(/-?\d+/);
    if (!match) {
      return null;
    }
    const parsed = Number(match[0]);
    return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
  }

  return null;
};

const parseCategory = (value: unknown) => {
  const candidate = asString(value);
  if (!candidate) {
    return null;
  }

  const normalized = candidate.toLowerCase();
  return VALID_CATEGORIES.has(normalized) ? normalized : null;
};

const hostnameFromUrl = (value: string) => {
  try {
    const parsed = new URL(value);
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
};

const contentSnippet = (value: AutoRagSearchDataItem) => {
  const content = value.content;
  if (!Array.isArray(content)) {
    return null;
  }

  const parts: string[] = [];
  for (const chunk of content) {
    const text = asString(chunk?.text);
    if (text) {
      parts.push(text);
    }
  }

  if (parts.length === 0) {
    return null;
  }

  return parts
    .join("")
    .replace(/\r\n?/g, "\n")
    .trim();
};

const FRONTMATTER_START = "---\n";
const FRONTMATTER_END = "\n---";

const parseFrontmatterValue = (rawValue: string) => {
  const value = rawValue.trim();
  if (!value) {
    return null;
  }

  if (
    (value.startsWith("\"") && value.endsWith("\"")) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    if (value.startsWith("'")) {
      return value.slice(1, -1);
    }
    try {
      return JSON.parse(value);
    } catch {
      return value.slice(1, -1);
    }
  }

  if (/^-?\d+(?:\.\d+)?$/.test(value)) {
    return Number(value);
  }

  if (value === "true") return true;
  if (value === "false") return false;
  if (value === "null") return null;

  return value;
};

const parseFrontmatterMarkdown = (value: string) => {
  const normalized = value.replace(/\r\n?/g, "\n").trim();
  if (!normalized.startsWith(FRONTMATTER_START)) {
    return null;
  }

  const endIndex = normalized.indexOf(FRONTMATTER_END, FRONTMATTER_START.length);
  if (endIndex < 0) {
    return null;
  }

  const metaSection = normalized.slice(FRONTMATTER_START.length, endIndex);
  const bodySection = normalized
    .slice(endIndex + FRONTMATTER_END.length)
    .replace(/^\n/, "");

  const metadata: Record<string, unknown> = {};
  for (const line of metaSection.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf(":");
    if (separatorIndex < 0) {
      return null;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1);
    if (!key) {
      return null;
    }

    metadata[key] = parseFrontmatterValue(rawValue);
  }

  return {
    metadata,
    body: bodySection.trim(),
  };
};

const parseSearchContent = (value: string | null): ParsedSearchContent | null => {
  if (!value) {
    return null;
  }

  const parsedDocument = parseFrontmatterMarkdown(value);
  if (!parsedDocument) {
    return null;
  }

  const title = asString(parsedDocument.metadata.title);
  const id = asString(parsedDocument.metadata.id);
  const author = asString(parsedDocument.metadata.author);
  const category = parseCategory(parsedDocument.metadata.category);
  const publishedAt = parseDate(parsedDocument.metadata.publishedAt);
  const comments = parseNumber(parsedDocument.metadata.commentCount);

  if (!id || !title || !author || !category || !publishedAt || comments === null) {
    return null;
  }

  return {
    id,
    title,
    author,
    content: asString(parsedDocument.body),
    source: normalizeUrl(parsedDocument.metadata.source),
    category,
    publishedAt,
    comments,
  };
};

const normalizeResult = (
  raw: AutoRagSearchDataItem,
  index: number,
): SearchResultItem | null => {
  const attributes = asRecord(raw.attributes);
  const url =
    normalizeUrl(raw.filename) ??
    normalizeUrl(attributes?.url) ??
    normalizeUrl(attributes?.source_url);

  if (!url) {
    return null;
  }

  const fallbackHost = hostnameFromUrl(url);
  const plainContent = contentSnippet(raw);
  const parsed = parseSearchContent(plainContent);
  const parsedSourceHost = parsed?.source ? hostnameFromUrl(parsed.source) : null;
  const title =
    asString(attributes?.title) ??
    asString(attributes?.name) ??
    parsed?.title ??
    asString(raw.filename) ??
    fallbackHost ??
    "Untitled result";

  const source =
    asString(attributes?.source) ??
    asString(attributes?.site) ??
    asString(attributes?.host) ??
    parsedSourceHost ??
    fallbackHost;

  return {
    id: `${url}#${index}`,
    title,
    url,
    parsed,
    source,
  };
};

const getSession = async (
  env: TypedEnv,
  cookies: AstroCookies,
) => {
  const sessionId = cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionId) {
    return null;
  }

  const session = (await env.SESSION.get(
    `session:${sessionId}`,
    "json",
  )) as StoredSession | null;

  if (!session) {
    return null;
  }

  if (session.expiresAt <= Date.now()) {
    await env.SESSION.delete(`session:${sessionId}`);
    cookies.delete(SESSION_COOKIE_NAME, { path: "/" });
    return null;
  }

  return session;
};

const json = (body: SearchResult, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });

export const GET: APIRoute = async ({ request, locals, cookies }) => {
  const env = locals.runtime.env as TypedEnv;
  const session = await getSession(env, cookies);
  if (!session) {
    return new Response("Sign in required", { status: 401 });
  }

  if (!env.AI) {
    return new Response("AI binding is not configured", { status: 503 });
  }

  const url = new URL(request.url);
  const rawQuery = url.searchParams.get("q") ?? "";
  const query = rawQuery.trim().slice(0, MAX_QUERY_LENGTH);
  if (query.length < MIN_QUERY_LENGTH) {
    return new Response(`Query must be at least ${MIN_QUERY_LENGTH} characters`, {
      status: 400,
    });
  }

  const limit = parseLimit(url.searchParams.get("limit"));
  const aiSearchInstance =
    env.AI_SEARCH_INSTANCE?.trim() || DEFAULT_AI_SEARCH_INSTANCE;
  const aiSearchRequest = {
    query,
    max_num_results: limit,
  };

  try {
    const result = await env.AI.autorag(aiSearchInstance).search(aiSearchRequest);

    const items = result.data
      .map((entry, index) => normalizeResult(entry, index))
      .filter((entry): entry is SearchResultItem => Boolean(entry));

    const responseBody: SearchResult = {
      items,
      total: result.data.length,
      nextCursor: result.next_page,
    };

    return json(responseBody);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const lowered = message.toLowerCase();
    if (lowered.includes("rate") || lowered.includes("429")) {
      return new Response("Search provider is rate-limited", { status: 429 });
    }
    if (lowered.includes("not found")) {
      return new Response("AI search instance was not found", { status: 502 });
    }
    if (lowered.includes("timeout") || lowered.includes("timed out")) {
      return new Response("Search provider timed out", { status: 504 });
    }

    return new Response("Search provider unavailable", { status: 502 });
  }
};
