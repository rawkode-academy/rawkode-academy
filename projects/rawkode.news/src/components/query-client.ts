import { QueryClient } from "@tanstack/react-query";
import type {
  ApiComment,
  ApiPost,
  FeedCategory,
  Paginated,
} from "@/components/app-data";

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

const buildPostsUrl = ({
  category,
  page,
  mine,
}: {
  category?: FeedCategory;
  page: number;
  mine?: boolean;
}) => {
  const params = new URLSearchParams();
  if (mine) {
    params.set("mine", "1");
  } else if (category) {
    params.set("category", category);
  }
  params.set("page", String(page));
  return `/api/posts?${params.toString()}`;
};

const fetchPosts = async ({
  category,
  page,
  mine,
}: {
  category?: FeedCategory;
  page: number;
  mine?: boolean;
}) => {
  const response = await fetch(buildPostsUrl({ category, page, mine }));
  if (!response.ok) {
    throw new Error("Failed to load posts");
  }
  return (await response.json()) as Paginated<ApiPost>;
};

export const postsQueryOptions = ({
  category,
  page,
  mine,
}: {
  category?: FeedCategory;
  page: number;
  mine?: boolean;
}) => ({
  queryKey: ["posts", mine ? "mine" : category, page],
  queryFn: () => fetchPosts({ category, page, mine }),
});

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
