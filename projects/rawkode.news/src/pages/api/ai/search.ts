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
  snippet: string | null;
  source: string | null;
};

type SearchResult = {
  items: SearchResultItem[];
  total: number;
  nextCursor: string | null;
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

  return parts.join(" ").replace(/\s+/g, " ").trim();
};

const excerpt = (value: string | null, maxLength = 280) => {
  if (!value) {
    return null;
  }

  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return null;
  }

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1).trim()}…`;
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
  const title =
    asString(attributes?.title) ??
    asString(attributes?.name) ??
    asString(raw.filename) ??
    fallbackHost ??
    "Untitled result";

  const snippet = excerpt(contentSnippet(raw));

  const source =
    asString(attributes?.source) ??
    asString(attributes?.site) ??
    asString(attributes?.host) ??
    fallbackHost;

  return {
    id: `${url}#${index}`,
    title,
    url,
    snippet,
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

  try {
    const result = await env.AI.autorag(aiSearchInstance).search({
      query,
      max_num_results: limit,
    });

    const items = result.data
      .map((entry, index) => normalizeResult(entry, index))
      .filter((entry): entry is SearchResultItem => Boolean(entry));

    return json({
      items,
      total: result.data.length,
      nextCursor: result.next_page,
    });
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

    console.error("[ai-search] request failed", error);
    return new Response("Search provider unavailable", { status: 502 });
  }
};
