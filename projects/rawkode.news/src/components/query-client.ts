import { QueryClient } from "@tanstack/react-query";
import type {
  ApiComment,
  ApiPost,
  ApiTag,
  FeedCategory,
  Paginated,
} from "@/components/app-data";
import { normalizeTagSlugs } from "@/lib/tags";

export const persistMaxAge = 1000 * 60 * 60 * 24;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: 1,
      gcTime: persistMaxAge,
    },
  },
});

export const parsePage = (value: string | null) => {
  const parsed = Number(value ?? "1");
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return Math.floor(parsed);
};

export const getPageFromRequest = (request: Request) => {
  const url = new URL(request.url);
  return parsePage(url.searchParams.get("page"));
};

export const parseTagsFromSearch = (value: string | null) => parseTagsParam(value);

const parseTagsParam = (value: string | null) => {
  if (!value) return [] as string[];
  return normalizeTagSlugs(value.split(","));
};

const buildPostsUrl = ({
  feed,
  tags,
  page,
  mine,
}: {
  feed?: FeedCategory;
  tags?: string[];
  page: number;
  mine?: boolean;
}) => {
  const params = new URLSearchParams();

  if (mine) {
    params.set("mine", "1");
  } else if (feed) {
    params.set("feed", feed);
  }

  const selectedTags = normalizeTagSlugs(tags ?? []);
  if (selectedTags.length > 0) {
    params.set("tags", selectedTags.join(","));
  }

  params.set("page", String(page));
  return `/api/posts?${params.toString()}`;
};

const fetchPosts = async ({
  feed,
  tags,
  page,
  mine,
}: {
  feed?: FeedCategory;
  tags?: string[];
  page: number;
  mine?: boolean;
}) => {
  const response = await fetch(buildPostsUrl({ feed, tags, page, mine }));
  if (!response.ok) {
    throw new Error("Failed to load posts");
  }
  return (await response.json()) as Paginated<ApiPost>;
};

export const postsQueryOptions = ({
  feed,
  tags,
  page,
  mine,
}: {
  feed?: FeedCategory;
  tags?: string[];
  page: number;
  mine?: boolean;
}) => {
  const normalizedTags = normalizeTagSlugs(tags ?? []);
  const tagsKey = normalizedTags.join(",") || "all";

  return {
    queryKey: ["posts", mine ? "mine" : feed, page, tagsKey],
    queryFn: () => fetchPosts({ feed, tags: normalizedTags, page, mine }),
  };
};

const fetchPost = async (postId: string) => {
  const response = await fetch(`/api/posts/${postId}`);
  if (!response.ok) {
    throw new Error("Failed to load post");
  }
  return (await response.json()) as ApiPost;
};

export const postQueryOptions = (postId: string) => ({
  queryKey: ["post", postId],
  queryFn: () => fetchPost(postId),
});

const fetchComments = async (postId: string) => {
  const response = await fetch(`/api/posts/${postId}/comments`);
  if (!response.ok) {
    throw new Error("Failed to load comments");
  }
  return (await response.json()) as ApiComment[];
};

export const commentsQueryOptions = (postId: string) => ({
  queryKey: ["comments", postId],
  queryFn: () => fetchComments(postId),
});

const fetchTags = async (kind?: "mandatory" | "optional") => {
  const params = new URLSearchParams();
  if (kind) {
    params.set("kind", kind);
  }

  const query = params.toString();
  const response = await fetch(query ? `/api/tags?${query}` : "/api/tags");
  if (!response.ok) {
    throw new Error("Failed to load tags");
  }

  return (await response.json()) as ApiTag[];
};

export const tagsQueryOptions = (kind?: "mandatory" | "optional") => ({
  queryKey: ["tags", kind ?? "all"],
  queryFn: () => fetchTags(kind),
  staleTime: 60_000,
});
