const normalizeWhitespace = (value: string) => value.replace(/\s+/g, " ").trim();

const POST_DESCRIPTION_MAX = 180;

export const postUnavailableMeta = {
  title: "Post unavailable | Rawkode News",
  description: "This post is not available right now. Browse the latest discussions on Rawkode News.",
  robots: "noindex, nofollow" as const,
  ogType: "website" as const,
};

export const postUnavailableCopy = {
  kicker: "Post unavailable",
  heading: "This post is unavailable",
  detail: "The link may be outdated, or the post may have been removed.",
};

export const stripMarkdownToText = (input: string) =>
  normalizeWhitespace(
    input
      .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
      .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
      .replace(/`{1,3}[^`]*`{1,3}/g, " ")
      .replace(/[#>*_~|-]/g, " ")
  );

export const truncateDescription = (input: string, max = 160) => {
  const normalized = normalizeWhitespace(input);
  if (normalized.length <= max) {
    return normalized;
  }

  return `${normalized.slice(0, max - 1).trimEnd()}…`;
};

type PostSeoInput = {
  title: string;
  author: string;
  body?: string | null;
};

export const getPostDescription = (post: PostSeoInput, max = POST_DESCRIPTION_MAX) => {
  const source = stripMarkdownToText(post.body ?? "");
  const fallback = `${post.title} — ${post.author}`;
  return truncateDescription(source || fallback, max);
};

export const getPostMeta = (post: PostSeoInput | null) => {
  if (!post) {
    return postUnavailableMeta;
  }

  return {
    title: `${post.title} | Rawkode News`,
    description: getPostDescription(post),
    robots: "index, follow" as const,
    ogType: "article" as const,
  };
};

export const buildCanonicalPath = (
  pathname: string,
  searchParams?: URLSearchParams,
  includeKeys: string[] = []
) => {
  if (!searchParams || includeKeys.length === 0) {
    return pathname;
  }

  const canonicalParams = new URLSearchParams();
  for (const key of includeKeys) {
    const value = searchParams.get(key);
    if (!value) continue;

    if (key === "page") {
      const page = Number(value);
      if (!Number.isFinite(page) || page <= 1) {
        continue;
      }
      canonicalParams.set("page", String(Math.floor(page)));
      continue;
    }

    canonicalParams.set(key, value);
  }

  const query = canonicalParams.toString();
  return query ? `${pathname}?${query}` : pathname;
};
