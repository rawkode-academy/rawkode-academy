import * as React from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
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
      <main className="flex w-full flex-col gap-6 py-6">
        <Card>
          <CardContent className="py-6">
            <p className="text-sm text-muted-foreground">Checking sign-in…</p>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="flex w-full flex-col gap-6 py-6">
        <Card>
          <CardContent className="flex flex-col gap-3 py-6">
            <p className="text-sm text-muted-foreground">
              Sign in to view your profile.
            </p>
            <div>
              <Button variant="secondary" size="sm" asChild>
                <a href={signInUrl}>Sign in</a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex w-full flex-col gap-6 py-6">
      <header className="flex flex-col gap-1">
        <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Profile
        </p>
        <p className="text-sm text-muted-foreground">
          Signed in as {displayName}
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Your submissions</CardTitle>
          <CardDescription>
            Posts you have shared with the Rawkode News community.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {submissionsQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">
              Loading your submissions…
            </p>
          ) : null}
          {submissionsQuery.isError ? (
            <p className="text-sm text-muted-foreground">
              Could not load your submissions. Please sign in again.
            </p>
          ) : null}
          {!submissionsQuery.isLoading && submissions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              You have not submitted anything yet.
            </p>
          ) : null}
          {submissions.map((post, index) => (
            <React.Fragment key={post.id}>
              <PostRow post={post} rank={index + 1} />
              {index < submissions.length - 1 ? <Separator /> : null}
            </React.Fragment>
          ))}
        </CardContent>
      </Card>
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
