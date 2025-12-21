export const feedCategories = ["new", "rka", "show", "ask"] as const;
export const postCategories = ["rka", "show", "ask"] as const;

export type FeedCategory = (typeof feedCategories)[number];
export type PostCategory = (typeof postCategories)[number];

export type ApiPost = {
  id: number;
  title: string;
  category: FeedCategory;
  url: string | null;
  body: string | null;
  author: string;
  commentCount: number;
  createdAt: string;
};

export type ApiComment = {
  id: number;
  postId: number;
  parentId: number | null;
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
  };
  permissions?: {
    canSubmitRka: boolean;
    allowedCategories: PostCategory[];
  };
};

export const postPath = (post: { id: number }) => `/item/${post.id}`;

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
  const byId = new Map<number, CommentNode>();
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
