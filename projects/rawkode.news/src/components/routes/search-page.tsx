import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { useLocation, useSearchParams } from "react-router-dom";
import { feedCategories, formatRelativeTime, type FeedCategory } from "@/components/app-data";
import { getCategoryTextClass } from "@/components/category-styles";
import { useSession } from "@/components/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const SEARCH_DEBOUNCE_MS = 350;
const MIN_QUERY_LENGTH = 2;
const MAX_QUERY_LENGTH = 200;
const SEARCH_RESULT_LIMIT = 20;

type ParsedSearchContent = {
  id: string | null;
  title: string | null;
  author: string | null;
  content: string | null;
  source: string | null;
  category: string | null;
  publishedAt: string | null;
  comments: number | null;
};

type SearchResultItem = {
  id: string;
  title: string;
  url: string;
  parsed: ParsedSearchContent | null;
  source: string | null;
};

type SearchResponse = {
  items: SearchResultItem[];
  total: number;
  nextCursor: string | null;
};

class SearchRequestError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const normalizeSearchQuery = (value: string) =>
  value.trim().slice(0, MAX_QUERY_LENGTH);

const fetchSearchResults = async (query: string, signal?: AbortSignal) => {
  const params = new URLSearchParams({
    q: query,
    limit: String(SEARCH_RESULT_LIMIT),
  });
  const response = await fetch(`/api/ai/search?${params.toString()}`, { signal });
  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new SearchRequestError(statusToErrorCode(response.status), message || "Search failed");
  }
  return (await response.json()) as SearchResponse;
};

const statusToErrorCode = (status: number) => {
  if (status === 401) return 401;
  if (status === 429) return 429;
  if (status === 504) return 504;
  return 502;
};

const errorMessage = (error: unknown) => {
  if (!(error instanceof SearchRequestError)) {
    return "Search is unavailable right now. Try again shortly.";
  }

  if (error.status === 401) {
    return "Sign in is required to use search.";
  }
  if (error.status === 429) {
    return "Search is temporarily rate-limited. Please retry in a moment.";
  }
  if (error.status === 504) {
    return "Search timed out. Please try a shorter query.";
  }

  return "Search is unavailable right now. Try again shortly.";
};

const formatCommentCount = (count: number) =>
  `${count} comment${count === 1 ? "" : "s"}`;

const asFeedCategory = (value: string | null) => {
  if (!value) {
    return null;
  }

  return feedCategories.includes(value as FeedCategory)
    ? (value as FeedCategory)
    : null;
};

export function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const sessionQuery = useSession();
  const user = sessionQuery.data?.user ?? null;
  const queryFromUrl = normalizeSearchQuery(searchParams.get("q") ?? "");
  const [draftQuery, setDraftQuery] = React.useState(queryFromUrl);
  const [debouncedQuery, setDebouncedQuery] = React.useState(queryFromUrl);
  const searchParamsKey = searchParams.toString();

  React.useEffect(() => {
    setDraftQuery(queryFromUrl);
    setDebouncedQuery(queryFromUrl);
  }, [queryFromUrl]);

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(normalizeSearchQuery(draftQuery));
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [draftQuery]);

  React.useEffect(() => {
    const next = new URLSearchParams(searchParamsKey);
    if (debouncedQuery) {
      next.set("q", debouncedQuery);
    } else {
      next.delete("q");
    }

    const nextKey = next.toString();
    if (nextKey !== searchParamsKey) {
      setSearchParams(next, { replace: true });
    }
  }, [debouncedQuery, searchParamsKey, setSearchParams]);

  const hasQuery = debouncedQuery.length > 0;
  const canSearch = Boolean(user) && debouncedQuery.length >= MIN_QUERY_LENGTH;

  const searchResultsQuery = useQuery({
    queryKey: ["ai-search", debouncedQuery],
    queryFn: ({ signal }) => fetchSearchResults(debouncedQuery, signal),
    enabled: canSearch,
    staleTime: 30_000,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const signInUrl = React.useMemo(() => {
    const next = `${location.pathname}${location.search}${location.hash}`;
    const returnTo = next.startsWith("/") ? next : "/search";
    return `/api/auth/sign-in?returnTo=${encodeURIComponent(returnTo)}`;
  }, [location.pathname, location.search, location.hash]);

  const results = React.useMemo(
    () => searchResultsQuery.data?.items ?? [],
    [searchResultsQuery.data?.items],
  );

  return (
    <main className="space-y-4 py-7">
      <section className="space-y-4">
        <header className="space-y-2">
          <p className="rkn-kicker">Search</p>
          <h1 className="rkn-page-title">Find posts across Rawkode News</h1>
          <p className="max-w-[70ch] text-sm text-muted-foreground">
            Link-first search across indexed content from Rawkode News.
          </p>
        </header>

        <div className="rkn-panel space-y-3 p-5">
          <div className="space-y-2">
            <label htmlFor="search-posts-input" className="text-sm font-semibold text-foreground">
              Query
            </label>
            <Input
              id="search-posts-input"
              value={draftQuery}
              onChange={(event) => setDraftQuery(event.target.value)}
              placeholder="Search by title, topic, or source"
              disabled={!user}
            />
          </div>

          {sessionQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">
              Checking sign-in status...
            </p>
          ) : null}

          {!sessionQuery.isLoading && !user ? (
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm text-muted-foreground">
                Sign in to use AI-powered search.
              </p>
              <Button size="sm" variant="secondary" asChild>
                <a href={signInUrl}>Sign in</a>
              </Button>
            </div>
          ) : null}
        </div>

        {!user ? null : !hasQuery ? (
          <p className="text-sm text-muted-foreground">Type a query to start searching.</p>
        ) : null}

        {user && hasQuery && !canSearch ? (
          <p className="text-sm text-muted-foreground">
            Type at least {MIN_QUERY_LENGTH} characters to search.
          </p>
        ) : null}

        {user && canSearch ? (
          <div className="rkn-panel overflow-hidden">
            {searchResultsQuery.isLoading ? (
              <p className="px-5 py-6 text-sm text-muted-foreground">Searching...</p>
            ) : null}

            {searchResultsQuery.isError ? (
              <p className="px-5 py-6 text-sm text-muted-foreground">
                {errorMessage(searchResultsQuery.error)}
              </p>
            ) : null}

            {!searchResultsQuery.isLoading && !searchResultsQuery.isError && results.length === 0 ? (
              <p className="px-5 py-6 text-sm text-muted-foreground">
                No matches for “{debouncedQuery}”.
              </p>
            ) : null}

            {results.map((result, index) => {
              const parsed = result.parsed;
              const category = asFeedCategory(parsed?.category ?? null);
              const hasCategory = Boolean(category);
              const hasPublishedAt = Boolean(parsed?.publishedAt);
              const hasComments = parsed?.comments !== null && parsed?.comments !== undefined;
              const hasMeta = hasCategory || hasPublishedAt || hasComments;

              return (
                <React.Fragment key={result.id}>
                  <article className="px-5 py-4">
                    <a
                      href={result.url}
                      className="group block space-y-1.5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <h2 className="text-[0.96rem] leading-6 font-semibold text-foreground transition-colors group-hover:text-primary">
                          {result.title}
                        </h2>
                        <ExternalLink className="mt-1 h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary" />
                      </div>
                      {hasMeta ? (
                        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                          {hasCategory ? (
                            <span className={`font-semibold uppercase ${getCategoryTextClass(category!)}`}>
                              {category}
                            </span>
                          ) : null}
                          {hasCategory && (hasPublishedAt || hasComments) ? (
                            <span>•</span>
                          ) : null}
                          {hasPublishedAt ? (
                            <span>{formatRelativeTime(parsed?.publishedAt ?? "")}</span>
                          ) : null}
                          {hasPublishedAt && hasComments ? <span>•</span> : null}
                          {hasComments ? (
                            <span>{formatCommentCount(parsed?.comments ?? 0)}</span>
                          ) : null}
                        </div>
                      ) : null}
                      {parsed?.content ? (
                        <p className="text-sm text-muted-foreground">{parsed.content}</p>
                      ) : null}
                    </a>
                  </article>
                  {index < results.length - 1 ? <hr className="border-border/75" /> : null}
                </React.Fragment>
              );
            })}
          </div>
        ) : null}
      </section>
    </main>
  );
}
