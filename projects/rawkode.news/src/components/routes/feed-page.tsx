import * as React from "react";
import { useSearchParams } from "react-router-dom";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { PaginationControls } from "@/components/pagination-controls";
import { PostRow } from "@/components/post-row";
import type { FeedCategory } from "@/components/app-data";
import { postsQueryOptions, parsePage } from "@/components/query-client";

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

  React.useEffect(() => {
    if (!hasMore || (totalPages && page >= totalPages)) return;
    void queryClient.prefetchQuery(postsQueryOptions({ category: type, page: page + 1 }));
  }, [hasMore, page, queryClient, totalPages, type]);

  return (
    <main className="flex w-full flex-col gap-6 py-6">
      <header className="flex flex-col">
        <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {type}
        </p>
      </header>
      <Card>
        <CardContent className="space-y-3">
          {postsQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading posts…</p>
          ) : null}
          {postsQuery.isError ? (
            <p className="text-sm text-muted-foreground">
              Could not load posts yet. Try again shortly.
            </p>
          ) : null}
          {!postsQuery.isLoading && posts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No posts yet. Be the first to submit.
            </p>
          ) : null}
          {posts.map((post, index) => (
            <React.Fragment key={post.id}>
              <PostRow post={post} rank={index + 1} showCategoryBadge={type === "new"} />
              {index < posts.length - 1 ? <Separator /> : null}
            </React.Fragment>
          ))}
        </CardContent>
      </Card>
      <PaginationControls
        page={page}
        totalPages={totalPages}
        hasMore={hasMore}
        isLoading={postsQuery.isLoading}
        searchParams={searchParams}
      />
    </main>
  );
}
