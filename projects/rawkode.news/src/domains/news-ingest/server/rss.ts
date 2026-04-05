import { RequestError } from "@/server/errors";
import { normalizeExternalUrl } from "@/shared/urls/normalization";
import {
  NEWS_PULL_ITEM_LIMIT,
  coerceDate,
  decodeHtmlEntities,
  normalizeCandidateTitle,
  normalizeRichTextToMarkdown,
  summarizeText,
  type PulledNewsItem,
} from "./shared";

const FEED_REQUEST_HEADERS = new Headers({
  Accept: "application/rss+xml, application/atom+xml, text/xml, application/xml;q=0.9, */*;q=0.1",
  "User-Agent": "RawkodeNews/1.0 (+https://rawkode.news)",
});
const RSS_CONTENT_TYPE_HINTS = [
  "application/rss+xml",
  "application/atom+xml",
  "application/xml",
  "text/xml",
  "application/rdf+xml",
] as const;
const HTML_CONTENT_TYPE_HINTS = ["text/html", "application/xhtml+xml"] as const;
const COMMON_FEED_PATHS = [
  "/feed",
  "/feed.xml",
  "/rss",
  "/rss.xml",
  "/atom.xml",
  "/index.xml",
] as const;
type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
type LoadedRssFeed = {
  feedUrl: string;
  items: PulledNewsItem[];
};

const stripCdataWrapper = (value: string) =>
  value.replace(/^<!\[CDATA\[/u, "").replace(/\]\]>$/u, "");

const parseHtmlAttributes = (tagSource: string) => {
  const attributes = new Map<string, string>();
  const source = tagSource
    .replace(/^<link\b/i, "")
    .replace(/\/?>\s*$/i, "");
  const attributePattern =
    /([^\s=/>]+)(?:\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

  for (const match of source.matchAll(attributePattern)) {
    const name = match[1]?.toLowerCase();
    if (!name || name === "/") {
      continue;
    }

    const value = decodeHtmlEntities(match[3] ?? match[4] ?? match[5] ?? "").trim();
    attributes.set(name, value);
  }

  return attributes;
};

const looksLikeFeedContentType = (contentType: string) =>
  RSS_CONTENT_TYPE_HINTS.some((hint) => contentType.includes(hint));

const looksLikeHtmlContentType = (contentType: string) =>
  HTML_CONTENT_TYPE_HINTS.some((hint) => contentType.includes(hint));

const looksLikeFeedDocument = (body: string) =>
  /<(?:rss|feed)\b|<(?:(?:[\w-]+):)?rdf\b/iu.test(body);

const looksLikeHtmlDocument = (body: string) => /<html\b|<head\b|<body\b/iu.test(body);

const getDirectChildren = (parent: Element) => Array.from(parent.children);

const getFirstDirectChild = (parent: Element, names: string[]) =>
  getDirectChildren(parent).find((child) => names.includes(child.localName.toLowerCase())) ?? null;

const getDirectChildText = (parent: Element, names: string[]) => {
  const child = getFirstDirectChild(parent, names);
  const text = child?.textContent?.trim() ?? "";
  return text || null;
};

const getAtomLinkHref = (entry: Element) => {
  const links = getDirectChildren(entry).filter((child) => child.localName.toLowerCase() === "link");
  const preferred = links.find((link) => {
    const rel = (link.getAttribute("rel") ?? "alternate").toLowerCase();
    return rel === "alternate" || rel === "";
  }) ?? links[0];

  const href = preferred?.getAttribute("href")?.trim() ?? "";
  return href || null;
};

const toPulledNewsItem = (input: {
  url: string | null;
  sourceItemUrl?: string | null;
  sourceItemId?: string | null;
  title?: string | null;
  excerpt?: string | null;
  authorName?: string | null;
  publishedAt?: Date | null;
}) => {
  if (!input.url) {
    return null;
  }

  let normalizedUrl: string;
  let normalizedSourceItemUrl: string;

  try {
    normalizedUrl = normalizeExternalUrl(input.url);
    normalizedSourceItemUrl = normalizeExternalUrl(input.sourceItemUrl ?? input.url);
  } catch {
    return null;
  }

  return {
    normalizedUrl,
    originalUrl: input.url,
    sourceItemUrl: normalizedSourceItemUrl,
    sourceItemId: input.sourceItemId ?? null,
    title: normalizeCandidateTitle(input.title, normalizedUrl),
    excerpt: normalizeRichTextToMarkdown(input.excerpt),
    authorName: summarizeText(input.authorName, 120),
    publishedAt: input.publishedAt ?? null,
  } satisfies PulledNewsItem;
};

const parseRssItem = (item: Element) =>
  toPulledNewsItem({
    url: getDirectChildText(item, ["link"]),
    sourceItemId: getDirectChildText(item, ["guid"]),
    title: getDirectChildText(item, ["title"]),
    excerpt:
      getDirectChildText(item, ["description"]) ??
      getDirectChildText(item, ["encoded", "content"]),
    authorName:
      getDirectChildText(item, ["creator"]) ??
      getDirectChildText(item, ["author"]),
    publishedAt: coerceDate(
      getDirectChildText(item, ["pubdate"]) ??
        getDirectChildText(item, ["date"]) ??
        getDirectChildText(item, ["updated"]),
    ),
  });

const parseAtomEntry = (entry: Element) => {
  const authorElement = getFirstDirectChild(entry, ["author"]);
  return toPulledNewsItem({
    url: getAtomLinkHref(entry),
    sourceItemId: getDirectChildText(entry, ["id"]),
    title: getDirectChildText(entry, ["title"]),
    excerpt:
      getDirectChildText(entry, ["summary"]) ??
      getDirectChildText(entry, ["content"]),
    authorName: authorElement
      ? getDirectChildText(authorElement, ["name"]) ?? authorElement.textContent?.trim() ?? null
      : null,
    publishedAt: coerceDate(
      getDirectChildText(entry, ["published"]) ??
        getDirectChildText(entry, ["updated"]),
    ),
  });
};

const getXmlBlocks = (xml: string, tagName: string) =>
  Array.from(
    xml.matchAll(new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)</${tagName}>`, "giu")),
    (match) => match[0],
  );

const getXmlTagText = (block: string, names: string[]) => {
  for (const name of names) {
    const pattern = new RegExp(
      `<(?:[\\w-]+:)?${name}\\b[^>]*>([\\s\\S]*?)</(?:[\\w-]+:)?${name}>`,
      "iu",
    );
    const match = block.match(pattern);
    if (match?.[1]) {
      return stripCdataWrapper(match[1].trim());
    }
  }

  return null;
};

const getXmlTagHref = (block: string, tagName: string) => {
  const match = block.match(
    new RegExp(
      `<(?:[\\w-]+:)?${tagName}\\b[^>]*href=(["'])(.*?)\\1[^>]*>`,
      "iu",
    ),
  );

  return match?.[2]?.trim() || null;
};

const parseRssItemFromXml = (block: string) =>
  toPulledNewsItem({
    url: getXmlTagText(block, ["link"]),
    sourceItemId: getXmlTagText(block, ["guid"]),
    title: getXmlTagText(block, ["title"]),
    excerpt: getXmlTagText(block, ["description"]) ?? getXmlTagText(block, ["encoded", "content"]),
    authorName: getXmlTagText(block, ["creator", "author"]),
    publishedAt: coerceDate(
      getXmlTagText(block, ["pubdate"]) ??
        getXmlTagText(block, ["date"]) ??
        getXmlTagText(block, ["updated"]),
    ),
  });

const parseAtomEntryFromXml = (block: string) =>
  toPulledNewsItem({
    url: getXmlTagHref(block, "link"),
    sourceItemId: getXmlTagText(block, ["id"]),
    title: getXmlTagText(block, ["title"]),
    excerpt: getXmlTagText(block, ["summary"]) ?? getXmlTagText(block, ["content"]),
    authorName: getXmlTagText(block, ["name"]) ?? getXmlTagText(block, ["author"]),
    publishedAt: coerceDate(
      getXmlTagText(block, ["published"]) ??
        getXmlTagText(block, ["updated"]),
    ),
  });

const parseRssFeedWithRegex = (xml: string) => {
  const trimmed = xml.trim();
  if (!looksLikeFeedDocument(trimmed)) {
    throw new RequestError("Response was not an RSS or Atom feed", 422);
  }
  const items = /<feed\b/iu.test(trimmed)
    ? getXmlBlocks(trimmed, "entry").map(parseAtomEntryFromXml)
    : getXmlBlocks(trimmed, "item").map(parseRssItemFromXml);

  return items.filter((item): item is PulledNewsItem => Boolean(item)).slice(0, NEWS_PULL_ITEM_LIMIT);
};

export const parseRssFeed = (xml: string) => {
  if (typeof DOMParser === "undefined") {
    return parseRssFeedWithRegex(xml);
  }

  const document = new DOMParser().parseFromString(xml, "application/xml");
  if (
    document.querySelector("parsererror") ||
    document.documentElement.localName.toLowerCase() === "parsererror"
  ) {
    throw new RequestError("Feed did not return valid XML", 422);
  }

  const rootName = document.documentElement.localName.toLowerCase();
  if (rootName !== "rss" && rootName !== "feed" && rootName !== "rdf") {
    throw new RequestError("Response was not an RSS or Atom feed", 422);
  }
  const items = rootName === "feed"
    ? Array.from(document.getElementsByTagName("entry")).map(parseAtomEntry)
    : Array.from(document.getElementsByTagName("item")).map(parseRssItem);

  return items.filter((item): item is PulledNewsItem => Boolean(item)).slice(0, NEWS_PULL_ITEM_LIMIT);
};

export const discoverRssFeedUrlFromHtml = (html: string, pageUrl: string) => {
  for (const match of html.matchAll(/<link\b[^>]*>/giu)) {
    const attributes = parseHtmlAttributes(match[0]);
    const href = attributes.get("href")?.trim();
    if (!href) {
      continue;
    }

    const relTokens = (attributes.get("rel") ?? "")
      .toLowerCase()
      .split(/\s+/u)
      .filter(Boolean);
    const type = (attributes.get("type") ?? "").toLowerCase();

    if (!relTokens.includes("alternate")) {
      continue;
    }
    if (!type.includes("rss") && !type.includes("atom") && !type.includes("xml")) {
      continue;
    }

    try {
      return normalizeExternalUrl(new URL(href, pageUrl).toString());
    } catch {
      continue;
    }
  }

  return null;
};

const fetchFeedResponse = async (url: string, fetchImpl: FetchLike) => {
  let response: Response;

  try {
    response = await fetchImpl(url, {
      headers: FEED_REQUEST_HEADERS,
      redirect: "follow",
    });
  } catch (error) {
    if (error instanceof Error && /timeout/i.test(error.message)) {
      throw new RequestError("Feed timed out while loading", 504);
    }
    throw new RequestError("Could not load feed", 502);
  }

  if (!response.ok) {
    throw new RequestError(
      `Feed returned ${response.status}`,
      response.status >= 500 ? 502 : response.status,
    );
  }

  return response;
};

const tryParseFeedBody = (body: string) => {
  try {
    return {
      items: parseRssFeed(body),
      error: null,
    };
  } catch (error) {
    return {
      items: null,
      error: error instanceof RequestError ? error : new RequestError("Could not parse feed", 422),
    };
  }
};

const tryCommonFeedPaths = async (
  pageUrl: string,
  fetchImpl: FetchLike,
): Promise<LoadedRssFeed | null> => {
  const page = new URL(pageUrl);

  for (const path of COMMON_FEED_PATHS) {
    try {
      const candidateUrl = normalizeExternalUrl(new URL(path, page.origin).toString());
      if (candidateUrl === pageUrl) {
        continue;
      }

      const { feedUrl, items } = await loadRssFeed(candidateUrl, fetchImpl, false);
      return { feedUrl, items };
    } catch {
      continue;
    }
  }

  return null;
};

export const loadRssFeed = async (
  locator: string,
  fetchImpl: FetchLike = fetch,
  allowDiscovery = true,
): Promise<LoadedRssFeed> => {
  const response = await fetchFeedResponse(locator, fetchImpl);
  const responseUrl = normalizeExternalUrl(response.url || locator);
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  const body = await response.text();
  const parsed = tryParseFeedBody(body);

  if (parsed.items) {
    return {
      feedUrl: responseUrl,
      items: parsed.items,
    };
  }

  if (allowDiscovery && (looksLikeHtmlContentType(contentType) || looksLikeHtmlDocument(body) || !looksLikeFeedContentType(contentType))) {
    const discoveredUrl = discoverRssFeedUrlFromHtml(body, responseUrl);
    if (discoveredUrl && discoveredUrl !== responseUrl) {
      return await loadRssFeed(discoveredUrl, fetchImpl, false);
    }

    const commonFeed = await tryCommonFeedPaths(responseUrl, fetchImpl);
    if (commonFeed) {
      return commonFeed;
    }
  }

  throw parsed.error ?? new RequestError("Could not parse feed", 422);
};

export const fetchRssNewsItems = async (feedUrl: string) => {
  const { items } = await loadRssFeed(feedUrl);
  return items;
};
