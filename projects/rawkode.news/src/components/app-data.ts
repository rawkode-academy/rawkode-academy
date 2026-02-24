import {
  coreTagSlugs,
  feedTypes,
  type CoreTagSlug,
  type FeedType,
  type TagKind,
} from "@/lib/tags";

export const feedCategories = feedTypes;
export const mandatoryTagSlugs = coreTagSlugs;

export type FeedCategory = FeedType;
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

export const postPath = (post: { id: string }) => `/item/${post.id}`;

export const commentAnchor = (comment: ApiComment) => `c-${comment.id}`;

export const formatRelativeTime = (value: string | number) => {
  const timestamp = typeof value === "string" ? Date.parse(value) : Number(value);
  if (!Number.isFinite(timestamp)) {
    return "just now";
  }
  const diff = Date.now() - timestamp;
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < minute) return "just now";
  if (diff < hour) return `${Math.floor(diff / minute)}m ago`;
  if (diff < day) return `${Math.floor(diff / hour)}h ago`;
  return `${Math.floor(diff / day)}d ago`;
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
