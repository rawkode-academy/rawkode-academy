import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import Fuse from "fuse.js";
import { useSearchParams } from "react-router-dom";
import { type ApiPost } from "@/components/app-data";
import { PostRow } from "@/components/post-row";
import { Input } from "@/components/ui/input";

const SEARCH_DEBOUNCE_MS = 350;
const MIN_QUERY_LENGTH = 2;
const MAX_QUERY_LENGTH = 200;
const SEARCH_RESULT_LIMIT = 40;
const SHORT_QUERY_MAX_LENGTH = 5;

type FuseSearchPost = ApiPost;

const normalizeSearchQuery = (value: string) =>
  value.trim().slice(0, MAX_QUERY_LENGTH);

const fetchSearchPosts = async (signal?: AbortSignal) => {
  const response = await fetch("/api/posts", { signal });
  if (!response.ok) {
    throw new Error("Failed to load search index");
  }
  const data = (await response.json()) as unknown;
  if (!Array.isArray(data)) {
    throw new Error("Invalid search index response");
  }
  return data as ApiPost[];
};

const includesQuery = (value: string | null | undefined, query: string) => {
  if (!value) return false;
  return value.toLowerCase().includes(query);
};

export function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
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
  const canSearch = debouncedQuery.length >= MIN_QUERY_LENGTH;

  const postsQuery = useQuery({
    queryKey: ["search-posts-index"],
    queryFn: ({ signal }) => fetchSearchPosts(signal),
    staleTime: 60_000,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const fuseIndexes = React.useMemo(() => {
    if (!postsQuery.data || postsQuery.data.length === 0) {
      return null;
    }

    return {
      // Short queries should be strict and avoid noisy body matches.
      short: new Fuse<FuseSearchPost>(postsQuery.data, {
        includeScore: true,
        threshold: 0.22,
        ignoreLocation: true,
        minMatchCharLength: MIN_QUERY_LENGTH,
        keys: [
          { name: "title", weight: 0.68 },
          { name: "author", weight: 0.2 },
          { name: "url", weight: 0.12 },
        ],
      }),
      // Longer queries can search body text with a looser threshold.
      full: new Fuse<FuseSearchPost>(postsQuery.data, {
        includeScore: true,
        threshold: 0.32,
        ignoreLocation: true,
        minMatchCharLength: MIN_QUERY_LENGTH,
        keys: [
          { name: "title", weight: 0.5 },
          { name: "body", weight: 0.3 },
          { name: "author", weight: 0.12 },
          { name: "url", weight: 0.08 },
        ],
      }),
    };
  }, [postsQuery.data]);

  const results = React.useMemo(() => {
    if (!fuseIndexes || !canSearch || !postsQuery.data) {
      return [] as FuseSearchPost[];
    }

    const normalizedQuery = debouncedQuery.toLowerCase();
    const useShortIndex = normalizedQuery.length <= SHORT_QUERY_MAX_LENGTH;
    const index = useShortIndex ? fuseIndexes.short : fuseIndexes.full;
    const maxScore = useShortIndex ? 0.19 : normalizedQuery.length <= 8 ? 0.28 : 0.35;

    const directMatches = postsQuery.data.filter((post) => (
      includesQuery(post.title, normalizedQuery) ||
      includesQuery(post.author, normalizedQuery) ||
      includesQuery(post.url, normalizedQuery)
    ));

    const fuzzyMatches = index
      .search(normalizedQuery, { limit: SEARCH_RESULT_LIMIT * 4 })
      .filter((entry) => (entry.score ?? 1) <= maxScore)
      .map((entry) => entry.item);

    const deduped: FuseSearchPost[] = [];
    const seenIds = new Set<string>();

    for (const post of [...directMatches, ...fuzzyMatches]) {
      if (seenIds.has(post.id)) continue;
      seenIds.add(post.id);
      deduped.push(post);
      if (deduped.length >= SEARCH_RESULT_LIMIT) break;
    }

    return deduped;
  }, [canSearch, debouncedQuery, fuseIndexes, postsQuery.data]);

  return (
    <main className="space-y-4 py-7">
      <section className="space-y-4">
        <header className="space-y-2">
          <h1 className="rkn-page-title">Find posts across Rawkode News</h1>
          <p className="max-w-[70ch] text-sm text-muted-foreground">
            Client-side fuzzy search across published posts.
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
              placeholder="Search by title, topic, author, or source"
            />
          </div>

          {postsQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">
              Loading search index...
            </p>
          ) : null}

          {postsQuery.isError ? (
            <p className="text-sm text-muted-foreground">
              Could not load search data. Try again shortly.
            </p>
          ) : null}
        </div>

        {!hasQuery ? (
          <p className="text-sm text-muted-foreground">Type a query to start searching.</p>
        ) : null}

        {hasQuery && !canSearch ? (
          <p className="text-sm text-muted-foreground">
            Type at least {MIN_QUERY_LENGTH} characters to search.
          </p>
        ) : null}

        {canSearch ? (
          <div className="rkn-panel overflow-hidden">
            {postsQuery.isLoading ? (
              <p className="px-5 py-6 text-sm text-muted-foreground">Searching...</p>
            ) : null}

            {!postsQuery.isLoading && !postsQuery.isError && results.length === 0 ? (
              <p className="px-5 py-6 text-sm text-muted-foreground">
                No matches for “{debouncedQuery}”.
              </p>
            ) : null}

            <div className="rkn-post-list">
              {results.map((post, index) => (
                <React.Fragment key={post.id}>
                  <PostRow post={post} />
                  {index < results.length - 1 ? <hr className="rkn-post-row-separator border-border/75" /> : null}
                </React.Fragment>
              ))}
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}
