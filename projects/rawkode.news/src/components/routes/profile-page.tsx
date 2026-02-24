import * as React from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { PaginationControls } from "@/components/pagination-controls";
import { PostRow } from "@/components/post-row";
import { postsQueryOptions, parsePage } from "@/components/query-client";
import { useSession } from "@/components/session";

export function ProfilePage() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const page = parsePage(searchParams.get("page"));
  const queryClient = useQueryClient();
  const returnTo = React.useMemo(() => {
    const next = `${location.pathname}${location.search}${location.hash}`;
    return next.startsWith("/") ? next : "/profile";
  }, [location]);

  const signInUrl = `/api/auth/sign-in?returnTo=${encodeURIComponent(returnTo)}`;
  const sessionQuery = useSession();
  const user = sessionQuery.data?.user ?? null;
  const isLoadingSession = sessionQuery.isLoading;

  const submissionsQuery = useQuery({
    enabled: Boolean(user),
    ...postsQueryOptions({ mine: true, page }),
    placeholderData: keepPreviousData,
  });

  const submissions = submissionsQuery.data?.items ?? [];
  const hasMore = submissionsQuery.data?.hasMore ?? false;
  const totalPages = submissionsQuery.data?.totalPages ?? 0;
  const displayName = user?.name || user?.email || "Profile";

  React.useEffect(() => {
    if (!hasMore || !user || (totalPages && page >= totalPages)) return;
    void queryClient.prefetchQuery(postsQueryOptions({ mine: true, page: page + 1 }));
  }, [hasMore, page, queryClient, totalPages, user]);

  if (isLoadingSession) {
    return (
      <main className="py-7">
        <section className="rounded-none border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Checking sign-in…</p>
        </section>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="py-7">
        <section className="space-y-3 rounded-none border border-border bg-card p-5">
          <p className="rkn-kicker">Profile</p>
          <h1 className="rkn-page-title">Sign in to view your profile</h1>
          <p className="text-sm text-muted-foreground">
            Your submissions and discussion activity are available once you sign in.
          </p>
          <div>
            <Button variant="secondary" size="sm" asChild>
              <a href={signInUrl}>Sign in</a>
            </Button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="space-y-5 py-7">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="rkn-kicker">Profile</p>
          <h1 className="rkn-page-title">{displayName}</h1>
        </div>
        <Button size="sm" asChild>
          <a href="/submit">Create post</a>
        </Button>
      </header>

      <section className="rkn-panel overflow-hidden">
        <header className="border-b border-border/70 px-5 py-4">
          <h2 className="font-display text-lg font-semibold">Your submissions</h2>
          <p className="text-sm text-muted-foreground">Posts shared with the Rawkode News community.</p>
        </header>

        <div>
          {submissionsQuery.isLoading ? (
            <p className="px-5 py-6 text-sm text-muted-foreground">Loading your submissions…</p>
          ) : null}
          {submissionsQuery.isError ? (
            <p className="px-5 py-6 text-sm text-muted-foreground">
              Could not load your submissions. Please sign in again.
            </p>
          ) : null}
          {!submissionsQuery.isLoading && submissions.length === 0 ? (
            <p className="px-5 py-6 text-sm text-muted-foreground">You have not submitted anything yet.</p>
          ) : null}

          <div className="rkn-post-list">
            {submissions.map((post, index) => (
              <React.Fragment key={post.id}>
                <PostRow post={post} />
                {index < submissions.length - 1 ? <hr className="rkn-post-row-separator border-border/75" /> : null}
              </React.Fragment>
            ))}
          </div>
        </div>
      </section>

      <PaginationControls
        page={page}
        totalPages={totalPages}
        hasMore={hasMore}
        isLoading={submissionsQuery.isLoading}
        searchParams={searchParams}
      />
    </main>
  );
}
