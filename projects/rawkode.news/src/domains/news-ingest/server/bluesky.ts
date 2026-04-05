import { RequestError } from "@/server/errors";
import { normalizeExternalUrl } from "@/shared/urls/normalization";
import {
  NEWS_PULL_ITEM_LIMIT,
  coerceDate,
  normalizeCandidateTitle,
  summarizeText,
  type PulledNewsItem,
} from "./shared";

const BLUESKY_PUBLIC_API = "https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object");

const asString = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null);

const getRecordField = (value: unknown, key: string) =>
  isRecord(value) ? value[key] : undefined;

const buildBlueskyPostPermalink = (uri: string, actor: string) => {
  const segments = uri.split("/");
  const rkey = segments[segments.length - 1]?.trim();
  if (!rkey) {
    throw new RequestError("Bluesky post is missing its record key", 422);
  }

  return `https://bsky.app/profile/${encodeURIComponent(actor)}/post/${encodeURIComponent(rkey)}`;
};

const extractExternalFromEmbed = (embed: unknown): {
  url: string | null;
  title: string | null;
  description: string | null;
} | null => {
  if (!isRecord(embed)) {
    return null;
  }

  const type = asString(embed.$type);
  if (
    type === "app.bsky.embed.external#view" ||
    type === "app.bsky.embed.external"
  ) {
    const external = isRecord(embed.external) ? embed.external : embed;
    return {
      url: asString(external.uri),
      title: asString(external.title),
      description: asString(external.description),
    };
  }

  if (
    type === "app.bsky.embed.recordWithMedia#view" ||
    type === "app.bsky.embed.recordWithMedia"
  ) {
    return extractExternalFromEmbed(embed.media);
  }

  return null;
};

const extractFacetLink = (record: unknown) => {
  const facets = Array.isArray(getRecordField(record, "facets"))
    ? (getRecordField(record, "facets") as unknown[])
    : [];

  for (const facet of facets) {
    if (!isRecord(facet) || !Array.isArray(facet.features)) {
      continue;
    }

    for (const feature of facet.features) {
      if (!isRecord(feature)) {
        continue;
      }

      const type = asString(feature.$type);
      if (type === "app.bsky.richtext.facet#link") {
        const uri = asString(feature.uri);
        if (uri) {
          return uri;
        }
      }
    }
  }

  return null;
};

const toPulledNewsItem = (feedItem: unknown): PulledNewsItem | null => {
  if (!isRecord(feedItem) || !isRecord(feedItem.post)) {
    return null;
  }
  if (isRecord(feedItem.reason)) {
    return null;
  }

  const post = feedItem.post;
  const author = isRecord(post.author) ? post.author : null;
  const record = isRecord(post.record) ? post.record : null;
  const uri = asString(post.uri);
  const actor = asString(author?.handle) ?? asString(author?.did);

  if (!uri || !actor) {
    return null;
  }

  const external =
    extractExternalFromEmbed(post.embed) ??
    extractExternalFromEmbed(record?.embed);
  const sourceItemUrl = normalizeExternalUrl(buildBlueskyPostPermalink(uri, actor));
  const candidateUrl = external?.url ?? extractFacetLink(record) ?? sourceItemUrl;

  let normalizedUrl: string;
  try {
    normalizedUrl = normalizeExternalUrl(candidateUrl);
  } catch {
    return null;
  }

  const postText = asString(record?.text);
  const candidateTitle = external?.title ?? postText ?? sourceItemUrl;
  const excerpt = external?.description ?? postText;

  return {
    normalizedUrl,
    originalUrl: candidateUrl,
    sourceItemUrl,
    sourceItemId: uri ?? null,
    title: normalizeCandidateTitle(candidateTitle, sourceItemUrl),
    excerpt: summarizeText(excerpt),
    authorName: summarizeText(asString(author?.displayName) ?? asString(author?.handle), 120),
    publishedAt: coerceDate(asString(record?.createdAt) ?? asString(post.indexedAt)),
  };
};

export const extractBlueskyFeedItems = (payload: unknown) => {
  if (!isRecord(payload) || !Array.isArray(payload.feed)) {
    throw new RequestError("Bluesky feed payload was invalid", 502);
  }

  return payload.feed
    .map(toPulledNewsItem)
    .filter((item): item is PulledNewsItem => Boolean(item))
    .slice(0, NEWS_PULL_ITEM_LIMIT);
};

export const fetchBlueskyNewsItems = async (actor: string) => {
  const requestUrl = new URL(BLUESKY_PUBLIC_API);
  requestUrl.searchParams.set("actor", actor);
  requestUrl.searchParams.set("filter", "posts_no_replies");
  requestUrl.searchParams.set("limit", String(NEWS_PULL_ITEM_LIMIT));

  let response: Response;
  try {
    response = await fetch(requestUrl, {
      headers: {
        Accept: "application/json",
      },
    });
  } catch (error) {
    if (error instanceof Error && /timeout/i.test(error.message)) {
      throw new RequestError("Bluesky feed timed out while loading", 504);
    }
    throw new RequestError("Could not load Bluesky feed", 502);
  }

  if (!response.ok) {
    throw new RequestError(
      `Bluesky feed returned ${response.status}`,
      response.status >= 500 ? 502 : response.status,
    );
  }

  const payload = await response.json();
  return extractBlueskyFeedItems(payload);
};
