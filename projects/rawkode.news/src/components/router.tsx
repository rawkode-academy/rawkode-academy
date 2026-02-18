import { lazy, Suspense, type ReactNode } from "react";
import { createBrowserRouter, redirect } from "react-router-dom";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router-dom";
import type { ApiComment, ApiPost, FeedCategory } from "@/components/app-data";
import { postPath } from "@/components/app-data";
import { Shell } from "@/components/shell";
import { FeedPage } from "@/components/routes/feed-page";
import { NotFoundPage } from "@/components/routes/not-found-page";
import { ProfilePage } from "@/components/routes/profile-page";
import { RouteErrorPage } from "@/components/routes/route-error-page";
import {
  getPageFromRequest,
  postsQueryOptions,
  queryClient,
} from "@/components/query-client";
import { sessionQueryOptions } from "@/components/session";

const PostPage = lazy(() =>
  import("@/components/routes/post-page").then((module) => ({
    default: module.PostPage,
  }))
);

const SubmitPage = lazy(() => import("@/components/submit-page"));

const routeFallback = (
  <main className="flex w-full flex-col gap-6 py-6">
    <p className="text-sm text-muted-foreground">Loading...</p>
  </main>
);

const withSuspense = (node: ReactNode) => (
  <Suspense fallback={routeFallback}>{node}</Suspense>
);

const redirectToRoot = (request: Request) => {
  const url = new URL(request.url);
  return redirect(url.search ? `/${url.search}` : "/");
};

const feedLoader =
  (category: FeedCategory) =>
  async ({ request }: LoaderFunctionArgs) => {
    const page = getPageFromRequest(request);
    await queryClient.ensureQueryData(postsQueryOptions({ category, page }));
    return { page };
  };

const profileLoader = async ({ request }: LoaderFunctionArgs) => {
  const page = getPageFromRequest(request);
  const session = await queryClient.ensureQueryData(sessionQueryOptions());
  if (session?.user) {
    await queryClient.ensureQueryData(postsQueryOptions({ mine: true, page }));
  }
  return { page };
};

const submitLoader = async () => {
  await queryClient.ensureQueryData(sessionQueryOptions());
  return null;
};

const postLoader = async ({ params, request }: LoaderFunctionArgs) => {
  const postId = params.id?.trim();
  if (!postId) {
    throw new Response("Invalid post id", { status: 400 });
  }

  let postResponse: Response;
  try {
    postResponse = await fetch(`/api/posts/${postId}`, { signal: request.signal });
  } catch {
    throw new Response("Failed to load post", { status: 502 });
  }

  if (postResponse.status === 404) {
    throw new Response("Post not found", { status: 404 });
  }
  if (postResponse.status === 400) {
    throw new Response("Invalid post id", { status: 400 });
  }

  if (!postResponse.ok) {
    throw new Response("Failed to load post", { status: 502 });
  }

  const post = (await postResponse.json()) as ApiPost;
  queryClient.setQueryData(["post", postId], post);

  try {
    const commentsResponse = await fetch(`/api/posts/${postId}/comments`, { signal: request.signal });
    if (commentsResponse.ok) {
      const comments = (await commentsResponse.json()) as ApiComment[];
      queryClient.setQueryData(["comments", postId], comments);
    } else if (commentsResponse.status === 404) {
      queryClient.setQueryData(["comments", postId], []);
    }
  } catch {
    // Non-fatal: PostPage handles comments loading and error states.
  }

  return { postId };
};

const submitAction = async ({ request }: ActionFunctionArgs) => {
  const formData = await request.formData();
  const title = String(formData.get("title") ?? "").trim();
  const url = String(formData.get("url") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim().toLowerCase();

  const response = await fetch("/api/posts", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title,
      url: url || null,
      body: body || null,
      category,
    }),
  });

  if (response.status === 401) {
    return { error: "Sign in required" };
  }

  if (!response.ok) {
    const message = await response.text();
    return { error: message || "Failed to submit post" };
  }

  const post = (await response.json()) as ApiPost;
  queryClient.invalidateQueries({ queryKey: ["posts"] });
  return redirect(postPath(post));
};

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Shell />,
    errorElement: <RouteErrorPage scope="app" />,
    children: [
      { index: true, loader: feedLoader("new"), element: <FeedPage type="new" /> },
      { path: "new", loader: ({ request }) => redirectToRoot(request) },
      { path: "rka", loader: feedLoader("rka"), element: <FeedPage type="rka" /> },
      { path: "show", loader: feedLoader("show"), element: <FeedPage type="show" /> },
      { path: "ask", loader: feedLoader("ask"), element: <FeedPage type="ask" /> },
      { path: "profile", loader: profileLoader, element: <ProfilePage /> },
      {
        path: "submit",
        loader: submitLoader,
        action: submitAction,
        element: withSuspense(<SubmitPage />),
      },
      {
        path: "item/:id",
        loader: postLoader,
        element: withSuspense(<PostPage />),
        errorElement: <RouteErrorPage scope="post" />,
      },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);
