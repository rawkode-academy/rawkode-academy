import * as React from "react";
import { useSearchParams } from "react-router-dom";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { PaginationControls } from "@/components/pagination-controls";
import { PostRow } from "@/components/post-row";
import type { FeedCategory } from "@/components/app-data";
import { postsQueryOptions, parsePage } from "@/components/query-client";

const feedMeta: Record<FeedCategory, { title: string; strapline: string; detail: string }> = {
  new: {
    title: "New",
    strapline: "Latest signals from the community",
    detail: "Fresh links and ideas ordered by recency.",
  },
  rka: {
    title: "RKA",
    strapline: "Rawkode Academy submissions",
    detail: "Deep engineering topics curated by the academy community.",
  },
  show: {
    title: "Show",
    strapline: "What people are building",
    detail: "Things built by community members: projects, releases, demos, and implementation notes.",
  },
  ask: {
    title: "Ask",
    strapline: "Questions for experienced builders",
    detail: "Practical questions with discussion from engineers in the field.",
  },
  announce: {
    title: "Announce",
    strapline: "Community updates and notices",
    detail: "Share updates, launches, events, and announcements that the community should see.",
  },
  links: {
    title: "Links",
    strapline: "Interesting things worth sharing",
    detail: "Drop useful articles, tools, and references with context on why they matter.",
  },
};

export function FeedPage({ type }: { type: FeedCategory }) {
  const [searchParams] = useSearchParams();
  const page = parsePage(searchParams.get("page"));
  const queryClient = useQueryClient();

  const postsQuery = useQuery({
    ...postsQueryOptions({ category: type, page }),
    placeholderData: keepPreviousData,
  });

  const posts = postsQuery.data?.items ?? [];
  const hasMore = postsQuery.data?.hasMore ?? false;
  const totalPages = postsQuery.data?.totalPages ?? 0;
  const meta = feedMeta[type];

  React.useEffect(() => {
    if (!hasMore || (totalPages && page >= totalPages)) return;
    void queryClient.prefetchQuery(postsQueryOptions({ category: type, page: page + 1 }));
  }, [hasMore, page, queryClient, totalPages, type]);

  return (
    <main className="space-y-4 py-7">
      <section className="space-y-4">
        <header className="space-y-2">
          <p className="rkn-kicker">{meta.title}</p>
          <h1 className="rkn-page-title">{meta.strapline}</h1>
          <p className="max-w-[70ch] text-sm text-muted-foreground">{meta.detail}</p>
        </header>

        <div className="rkn-panel overflow-hidden">
          {postsQuery.isLoading ? (
            <p className="px-5 py-6 text-sm text-muted-foreground">Loading posts…</p>
          ) : null}
          {postsQuery.isError ? (
            <p className="px-5 py-6 text-sm text-muted-foreground">
              Could not load posts yet. Try again shortly.
            </p>
          ) : null}
          {!postsQuery.isLoading && posts.length === 0 ? (
            <p className="px-5 py-6 text-sm text-muted-foreground">
              No posts yet. Be the first to share something useful.
            </p>
          ) : null}

          {posts.map((post, index) => (
            <React.Fragment key={post.id}>
              <PostRow post={post} showCategoryBadge={type === "new"} />
              {index < posts.length - 1 ? <hr className="border-border/75" /> : null}
            </React.Fragment>
          ))}
        </div>

        <PaginationControls
          page={page}
          totalPages={totalPages}
          hasMore={hasMore}
          isLoading={postsQuery.isLoading}
          searchParams={searchParams}
        />
      </section>
    </main>
  );
}
