import {
  coreTagSlugs,
  feedTypes,
  tagKinds,
  type CoreTagSlug,
  type FeedType as BaseFeedType,
  type TagKind,
} from "@/lib/tags";

export const feedCategories = feedTypes;
export const mandatoryTagSlugs = coreTagSlugs;

export type FeedType = BaseFeedType;
export type FeedCategory = BaseFeedType;
export type MandatoryTagSlug = CoreTagSlug;

export type ApiTag = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  kind: TagKind;
  usageCount?: number;
};

export type ApiPost = {
  id: string;
  title: string;
  url: string | null;
  body: string | null;
  author: string;
  commentCount: number;
  createdAt: string;
  tags: ApiTag[];
};

export type ApiComment = {
  id: string;
  postId: string;
  parentId: string | null;
  author: string;
  body: string;
  createdAt: string;
};

export type Paginated<T> = {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasMore: boolean;
};

export type CommentNode = ApiComment & { replies: CommentNode[] };

export type ApiSession = {
  user: {
    id: string;
    email: string;
    name: string;
    image: string | null;
    identity?: unknown;
  };
  permissions?: {
    isAdmin: boolean;
    canSubmitRka: boolean;
    allowedMandatoryTags: MandatoryTagSlug[];
  };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object");

const hasOwn = (value: Record<string, unknown>, key: string) =>
  Object.prototype.hasOwnProperty.call(value, key);

export const isApiTag = (value: unknown): value is ApiTag => {
  if (!isRecord(value)) return false;
  if (typeof value.id !== "string") return false;
  if (typeof value.slug !== "string") return false;
  if (typeof value.name !== "string") return false;
  if (!(value.description === null || typeof value.description === "string")) return false;
  if (typeof value.kind !== "string") return false;
  if (!tagKinds.includes(value.kind as TagKind)) return false;
  if (hasOwn(value, "usageCount") && value.usageCount !== undefined && typeof value.usageCount !== "number") {
    return false;
  }
  return true;
};

export const isApiPost = (value: unknown): value is ApiPost => {
  if (!isRecord(value)) return false;
  if (typeof value.id !== "string") return false;
  if (typeof value.title !== "string") return false;
  if (!(value.url === null || typeof value.url === "string")) return false;
  if (!(value.body === null || typeof value.body === "string")) return false;
  if (typeof value.author !== "string") return false;
  if (typeof value.commentCount !== "number") return false;
  if (typeof value.createdAt !== "string") return false;
  if (!Array.isArray(value.tags)) return false;
  if (!value.tags.every((tag) => isApiTag(tag))) return false;
  return true;
};

export const parseApiPostList = (value: unknown): ApiPost[] | null => {
  if (!Array.isArray(value)) return null;
  if (!value.every((item) => isApiPost(item))) return null;
  return value;
};

export const postPath = (post: { id: string }) => `/item/${post.id}`;

export const commentAnchor = (comment: ApiComment) => `c-${comment.id}`;

const numberFormatters = new Map<string, Intl.NumberFormat>();
const relativeTimeFormatters = new Map<string, Intl.RelativeTimeFormat>();

const getNumberFormatter = (locale?: string) => {
  const key = locale || "default";
  if (!numberFormatters.has(key)) {
    numberFormatters.set(key, new Intl.NumberFormat(locale));
  }
  return numberFormatters.get(key)!;
};

const getRelativeTimeFormatter = (locale?: string) => {
  const key = locale || "default";
  if (!relativeTimeFormatters.has(key)) {
    relativeTimeFormatters.set(
      key,
      new Intl.RelativeTimeFormat(locale, { numeric: "auto" }),
    );
  }
  return relativeTimeFormatters.get(key)!;
};

const normalizeCount = (value: number) => {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.floor(value));
};

export const formatInteger = (value: number, locale?: string) =>
  getNumberFormatter(locale).format(normalizeCount(value));

export const formatCountLabel = (
  value: number,
  singular: string,
  plural: string,
  locale?: string,
) => {
  const count = normalizeCount(value);
  const word = count === 1 ? singular : plural;
  return `${formatInteger(count, locale)} ${word}`;
};

export const formatRelativeTime = (value: string | number, locale?: string) => {
  const timestamp = typeof value === "string" ? Date.parse(value) : Number(value);
  if (!Number.isFinite(timestamp)) {
    return "just now";
  }

  const deltaMs = timestamp - Date.now();
  const absDeltaMs = Math.abs(deltaMs);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  const formatter = getRelativeTimeFormatter(locale);

  if (absDeltaMs < minute) {
    return formatter.format(0, "second");
  }

  if (absDeltaMs < hour) {
    return formatter.format(Math.round(deltaMs / minute), "minute");
  }

  if (absDeltaMs < day) {
    return formatter.format(Math.round(deltaMs / hour), "hour");
  }

  return formatter.format(Math.round(deltaMs / day), "day");
};

export const buildCommentTree = (items: ApiComment[]): CommentNode[] => {
  const byId = new Map<string, CommentNode>();
  const roots: CommentNode[] = [];

  items.forEach((comment) => {
    byId.set(comment.id, { ...comment, replies: [] });
  });

  byId.forEach((comment) => {
    if (comment.parentId && byId.has(comment.parentId)) {
      byId.get(comment.parentId)!.replies.push(comment);
    } else {
      roots.push(comment);
    }
  });

  return roots;
};
