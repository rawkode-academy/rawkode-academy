import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import Fuse from "fuse.js";
import { useSearchParams } from "react-router-dom";
import { formatRelativeTime, type ApiPost } from "@/components/app-data";
import { getCategoryTextClass } from "@/components/category-styles";
import { Input } from "@/components/ui/input";

const SEARCH_DEBOUNCE_MS = 350;
const MIN_QUERY_LENGTH = 2;
const MAX_QUERY_LENGTH = 200;
const SEARCH_RESULT_LIMIT = 40;

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

const formatCommentCount = (count: number) =>
  `${count} comment${count === 1 ? "" : "s"}`;

const sourceDomain = (value: string | null) => {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
};

const stripMarkdown = (value: string) =>
  value
    .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
    .replace(/`{1,3}[^`]*`{1,3}/g, " ")
    .replace(/[#>*_~|-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const searchSnippet = (post: FuseSearchPost) => {
  const body = post.body?.trim();
  if (body) {
    const plain = stripMarkdown(body);
    if (plain) {
      return plain.slice(0, 220);
    }
  }

  return sourceDomain(post.url);
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

  const fuseIndex = React.useMemo(() => {
    if (!postsQuery.data || postsQuery.data.length === 0) {
      return null;
    }

    return new Fuse<FuseSearchPost>(postsQuery.data, {
      includeScore: true,
      threshold: 0.4,
      ignoreLocation: true,
      minMatchCharLength: MIN_QUERY_LENGTH,
      keys: [
        { name: "title", weight: 0.5 },
        { name: "body", weight: 0.3 },
        { name: "author", weight: 0.12 },
        { name: "url", weight: 0.08 },
      ],
    });
  }, [postsQuery.data]);

  const results = React.useMemo(() => {
    if (!fuseIndex || !canSearch) {
      return [] as FuseSearchPost[];
    }
    return fuseIndex
      .search(debouncedQuery, { limit: SEARCH_RESULT_LIMIT })
      .map((entry) => entry.item);
  }, [canSearch, debouncedQuery, fuseIndex]);

  return (
    <main className="space-y-4 py-7">
      <section className="space-y-4">
        <header className="space-y-2">
          <p className="rkn-kicker">Search</p>
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

            {results.map((post, index) => {
              const hasSource = Boolean(post.url);
              const source = sourceDomain(post.url);
              const snippet = searchSnippet(post);

              return (
                <React.Fragment key={post.id}>
                  <article className="px-5 py-4">
                    <a
                      href={`/item/${post.id}`}
                      className="group block space-y-1.5"
                    >
                      <h2 className="text-[0.96rem] leading-6 font-semibold text-foreground transition-colors group-hover:text-primary">
                        {post.title}
                      </h2>
                      <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                        <span className={`font-semibold uppercase ${getCategoryTextClass(post.category)}`}>
                          {post.category}
                        </span>
                        <span>•</span>
                        <span>{formatRelativeTime(post.createdAt)}</span>
                        <span>•</span>
                        <span>{formatCommentCount(post.commentCount)}</span>
                        {hasSource && source ? (
                          <>
                            <span>•</span>
                            <span className="font-mono">{source}</span>
                          </>
                        ) : null}
                      </div>
                      {snippet ? (
                        <p className="text-sm text-muted-foreground">{snippet}</p>
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
