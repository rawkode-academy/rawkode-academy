import { createBrowserRouter, redirect } from "react-router-dom";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router-dom";
import type { ApiPost, FeedCategory } from "@/components/app-data";
import { postPath } from "@/components/app-data";
import { Shell } from "@/components/shell";
import { FeedPage } from "@/components/routes/feed-page";
import { ProfilePage } from "@/components/routes/profile-page";
import { PostPage } from "@/components/routes/post-page";
import SubmitPage from "@/components/submit-page";
import {
  commentsQueryOptions,
  getPageFromRequest,
  postQueryOptions,
  postsQueryOptions,
  queryClient,
} from "@/components/query-client";
import { sessionQueryOptions } from "@/components/session";

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

const postLoader = async ({ params }: LoaderFunctionArgs) => {
  const postId = Number(params.id);
  if (!Number.isFinite(postId)) {
    throw new Response("Invalid post id", { status: 400 });
  }
  await Promise.all([
    queryClient.ensureQueryData(postQueryOptions(postId)),
    queryClient.ensureQueryData(commentsQueryOptions(postId)),
  ]);
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
        element: <SubmitPage />,
      },
      { path: "item/:id", loader: postLoader, element: <PostPage /> },
    ],
  },
]);
