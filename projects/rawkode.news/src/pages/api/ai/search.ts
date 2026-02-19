import type { APIRoute, AstroCookies } from "astro";

import { SESSION_COOKIE_NAME, type StoredSession } from "@/lib/auth";
import type { TypedEnv } from "@/types/service-bindings";

const MIN_QUERY_LENGTH = 2;
const MAX_QUERY_LENGTH = 200;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 20;
const DEFAULT_AI_SEARCH_INSTANCE = "rawkode-news";

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
  title: string | null;
  content: string | null;
  source: string | null;
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
    .join("\n\n")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};

const parseJsonCandidate = (value: string) => {
  try {
    return asRecord(JSON.parse(value));
  } catch {
    return null;
  }
};

const extractJsonObject = (value: string) => {
  const direct = parseJsonCandidate(value);
  if (direct) {
    return direct;
  }

  const start = value.indexOf("{");
  const end = value.lastIndexOf("}");
  if (start < 0 || end <= start) {
    return null;
  }

  return parseJsonCandidate(value.slice(start, end + 1));
};

const parseSearchContent = (value: string | null): ParsedSearchContent | null => {
  if (!value) {
    return null;
  }

  const normalized = value
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!normalized) {
    return null;
  }

  const parsedObject = extractJsonObject(normalized);
  if (!parsedObject) {
    return {
      title: null,
      content: normalized,
      source: null,
    };
  }

  return {
    title: asString(parsedObject.title) ?? null,
    content:
      asString(parsedObject.body) ??
      asString(parsedObject.content) ??
      asString(parsedObject.description) ??
      null,
    source:
      normalizeUrl(parsedObject.url) ??
      normalizeUrl(parsedObject.source) ??
      normalizeUrl(parsedObject.source_url),
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
