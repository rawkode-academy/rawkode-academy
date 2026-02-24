import * as React from "react";
import { useSearchParams } from "react-router-dom";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { PaginationControls } from "@/components/pagination-controls";
import { PostRow } from "@/components/post-row";
import {
  mandatoryTagSlugs,
  type ApiTag,
  type FeedCategory,
} from "@/components/app-data";
import {
  parsePage,
  parseTagsFromSearch,
  postsQueryOptions,
  tagsQueryOptions,
} from "@/components/query-client";

const MOBILE_TAG_GRID_COLUMNS = 4;
const DESKTOP_TAG_GRID_COLUMNS = 8;
const RESERVED_FILTER_COLUMN_COUNT = 1;
const MOBILE_TAGS_PER_ROW = MOBILE_TAG_GRID_COLUMNS - RESERVED_FILTER_COLUMN_COUNT;
const DESKTOP_TAGS_PER_ROW = DESKTOP_TAG_GRID_COLUMNS - RESERVED_FILTER_COLUMN_COUNT;
const mandatoryOrder = new Map<string, number>(
  mandatoryTagSlugs.map((slug, index) => [slug, index]),
);

const feedMeta: Record<FeedCategory, { title: string; strapline: string; detail: string }> = {
  new: {
    title: "New",
    strapline: "Latest news from the community",
    detail: "",
  },
  news: {
    title: "News",
    strapline: "",
    detail: "",
  },
  rka: {
    title: "RKA",
    strapline: "",
    detail: "",
  },
  show: {
    title: "Show",
    strapline: "",
    detail: "",
  },
  ask: {
    title: "Ask",
    strapline: "",
    detail: "",
  },
};

const getTagLabel = (tag: ApiTag) => tag.name || tag.slug;

const pillBaseClass =
  "inline-flex h-9 w-full min-w-0 cursor-pointer items-center justify-center gap-1 rounded-md border px-2 text-xs font-semibold disabled:cursor-not-allowed";

type MandatoryCell = {
  key: string;
  slug: string;
  label: string;
  description: string | null;
  mandatory: boolean;
};

type FilterGridCell =
  | {
      kind: "tag";
      key: string;
      slug: string;
      label: string;
      description: string | null;
    }
  | {
      kind: "show-all";
      key: "show-all";
      label: string;
    }
  | {
      kind: "reset";
      key: "reset";
      label: string;
    };

type TagLayout = {
  rows: FilterGridCell[][];
  canExpand: boolean;
};

export function FeedPage({ type }: { type: FeedCategory }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [showMore, setShowMore] = React.useState(false);
  const previousTypeRef = React.useRef(type);
  const page = parsePage(searchParams.get("page"));
  const queryClient = useQueryClient();
  const selectedTags = React.useMemo(
    () => parseTagsFromSearch(searchParams.get("tags")),
    [searchParams],
  );

  const tagsQuery = useQuery(tagsQueryOptions());
  const tags = tagsQuery.data ?? [];
  const mandatoryTags = React.useMemo(
    () =>
      tags
        .filter((tag) => tag.kind === "mandatory")
        .sort(
          (left, right) =>
            (mandatoryOrder.get(left.slug) ?? Number.MAX_SAFE_INTEGER) -
            (mandatoryOrder.get(right.slug) ?? Number.MAX_SAFE_INTEGER),
        ),
    [tags],
  );
  const optionalTags = React.useMemo(
    () => tags.filter((tag) => tag.kind === "optional"),
    [tags],
  );
  const knownTagSlugs = React.useMemo(
    () => new Set(tags.map((tag) => tag.slug)),
    [tags],
  );
  const optionalTagSlugs = React.useMemo(
    () => new Set(optionalTags.map((tag) => tag.slug)),
    [optionalTags],
  );
  const activeSelectedTags = React.useMemo(() => {
    if (tags.length === 0) {
      return selectedTags;
    }

    const known = selectedTags.filter((slug) => knownTagSlugs.has(slug));
    if (type === "new") {
      return known;
    }

    return known.filter((slug) => optionalTagSlugs.has(slug));
  }, [knownTagSlugs, optionalTagSlugs, selectedTags, tags.length, type]);
  const filterTags = React.useMemo(() => {
    const mandatory = type === "new"
      ? mandatoryTags.map<MandatoryCell>((tag) => ({
          key: tag.id,
          slug: tag.slug,
          label: getTagLabel(tag),
          description: tag.description,
          mandatory: true,
        }))
      : [];

    const optional = optionalTags.map<MandatoryCell>((tag) => ({
      key: tag.id,
      slug: tag.slug,
      label: getTagLabel(tag),
      description: tag.description,
      mandatory: false,
    }));

    return [...mandatory, ...optional];
  }, [mandatoryTags, optionalTags, type]);
  const activeSelectedTagSet = React.useMemo(
    () => new Set(activeSelectedTags),
    [activeSelectedTags],
  );
  const buildTagLayout = React.useCallback((tagsPerRow: number): TagLayout => {
    const tagSlotsWithoutShowAll = tagsPerRow;
    const tagSlotsWithShowAll = Math.max(1, tagsPerRow - 1);
    const canExpand = filterTags.length > tagSlotsWithoutShowAll;
    const collapsedVisibleTagCount = canExpand ? tagSlotsWithShowAll : tagSlotsWithoutShowAll;
    const hiddenTagCount = Math.max(0, filterTags.length - collapsedVisibleTagCount);
    const visibleTags = showMore
      ? filterTags
      : filterTags.slice(0, collapsedVisibleTagCount);
    const tagCells: FilterGridCell[] = visibleTags.map((tag) => ({
      kind: "tag",
      key: tag.key,
      slug: tag.slug,
      label: tag.label,
      description: tag.description,
    }));
    const visibleCells: FilterGridCell[] = !canExpand
      ? tagCells
      : showMore
        ? [...tagCells, { kind: "reset" as const, key: "reset" as const, label: "Reset" }]
        : [
            ...tagCells,
            { kind: "show-all" as const, key: "show-all" as const, label: `Show all (${hiddenTagCount})` },
          ];
    const rows: FilterGridCell[][] = [];
    for (let index = 0; index < visibleCells.length; index += tagsPerRow) {
      rows.push(visibleCells.slice(index, index + tagsPerRow));
    }

    return {
      rows: rows.length > 0 ? rows : [[]],
      canExpand,
    };
  }, [filterTags, showMore]);
  const mobileTagLayout = React.useMemo(
    () => buildTagLayout(MOBILE_TAGS_PER_ROW),
    [buildTagLayout],
  );
  const desktopTagLayout = React.useMemo(
    () => buildTagLayout(DESKTOP_TAGS_PER_ROW),
    [buildTagLayout],
  );
  const canExpand = mobileTagLayout.canExpand || desktopTagLayout.canExpand;

  const postsQuery = useQuery({
    ...postsQueryOptions({ feed: type, tags: activeSelectedTags, page }),
    placeholderData: keepPreviousData,
  });

  const posts = postsQuery.data?.items ?? [];
  const hasMore = postsQuery.data?.hasMore ?? false;
  const totalPages = postsQuery.data?.totalPages ?? 0;
  const meta = feedMeta[type];
  const paginationSearchParams = React.useMemo(() => {
    const next = new URLSearchParams(searchParams);
    next.delete("tags");
    return next;
  }, [searchParams]);

  const updateSelectedTags = React.useCallback(
    (next: string[]) => {
      const params = new URLSearchParams(searchParams);
      if (next.length > 0) {
        params.set("tags", next.join(","));
      } else {
        params.delete("tags");
      }
      params.delete("page");
      setSearchParams(params);
    },
    [searchParams, setSearchParams],
  );
  const toggleTag = React.useCallback(
    (slug: string) => {
      if (activeSelectedTags.includes(slug)) {
        updateSelectedTags(activeSelectedTags.filter((item) => item !== slug));
        return;
      }

      updateSelectedTags([...activeSelectedTags, slug]);
    },
    [activeSelectedTags, updateSelectedTags],
  );
  const resetFilters = React.useCallback(() => {
    setShowMore(false);
    updateSelectedTags([]);
  }, [updateSelectedTags]);
  const renderFilterRows = React.useCallback(
    (rows: FilterGridCell[][], keyPrefix: string, gridColumnsClass: string) =>
      rows.map((row, rowIndex) => (
        <div key={`${keyPrefix}-filter-row-${rowIndex}`} className={`grid ${gridColumnsClass} gap-2`}>
          {rowIndex === 0 ? (
            <span
              aria-hidden="true"
              className="inline-flex h-9 w-full min-w-0 items-center justify-center px-2 text-xs font-bold uppercase tracking-wide text-foreground"
            >
              Filter
            </span>
          ) : (
            <span aria-hidden="true" className="h-9" />
          )}

          {row.map((cell) => {
            if (cell.kind === "tag") {
              const selected = activeSelectedTagSet.has(cell.slug);
              return (
                <button
                  key={cell.key}
                  type="button"
                  onClick={() => toggleTag(cell.slug)}
                  title={selected ? `Remove ${cell.slug}` : cell.description ?? undefined}
                  className={
                    selected
                      ? `${pillBaseClass} border-primary/40 bg-primary/10 text-foreground`
                      : `${pillBaseClass} border-border text-muted-foreground hover:bg-muted hover:text-foreground`
                  }
                >
                  <span className="min-w-0 truncate">
                    {cell.label}
                  </span>
                </button>
              );
            }

            if (cell.kind === "show-all") {
              return (
                <button
                  key={cell.key}
                  type="button"
                  onClick={() => setShowMore(true)}
                  className={`${pillBaseClass} border-border bg-card text-foreground hover:bg-muted`}
                >
                  <span className="min-w-0 truncate">{cell.label}</span>
                </button>
              );
            }

            return (
              <button
                key={cell.key}
                type="button"
                onClick={resetFilters}
                className={`${pillBaseClass} border-border bg-card text-foreground hover:bg-muted`}
              >
                <span className="min-w-0 truncate">{cell.label}</span>
              </button>
            );
          })}
        </div>
      )),
    [activeSelectedTagSet, resetFilters, toggleTag],
  );

  React.useEffect(() => {
    if (previousTypeRef.current === type) return;
    previousTypeRef.current = type;

    setShowMore(false);

    if (!searchParams.has("tags")) return;

    const params = new URLSearchParams(searchParams);
    params.delete("tags");
    params.delete("page");
    setSearchParams(params, { replace: true });
  }, [searchParams, setSearchParams, type]);

  React.useEffect(() => {
    if (!hasMore || (totalPages && page >= totalPages)) return;
    void queryClient.prefetchQuery(
      postsQueryOptions({ feed: type, tags: activeSelectedTags, page: page + 1 }),
    );
  }, [activeSelectedTags, hasMore, page, queryClient, totalPages, type]);

  React.useEffect(() => {
    if (!canExpand && showMore) {
      setShowMore(false);
    }
  }, [canExpand, showMore]);

  return (
    <main className="space-y-4 py-7">
      <section className="space-y-4">
        <header className="space-y-2">
          {type === "new" ? (
            <h1 className="rkn-page-title">{meta.strapline}</h1>
          ) : (
            <h1 className="rkn-page-title">{meta.title}</h1>
          )}
          {type === "new" && meta.detail ? (
            <p className="max-w-[70ch] text-sm text-muted-foreground">{meta.detail}</p>
          ) : null}
        </header>

        <section className="space-y-3">
          <div className="space-y-2 sm:hidden">
            {renderFilterRows(mobileTagLayout.rows, "mobile", "grid-cols-4")}
          </div>
          <div className="hidden space-y-2 sm:block">
            {renderFilterRows(desktopTagLayout.rows, "desktop", "grid-cols-8")}
          </div>
        </section>

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

          <div className="rkn-post-list">
            {posts.map((post, index) => (
              <React.Fragment key={post.id}>
                <PostRow post={post} />
                {index < posts.length - 1 ? <hr className="rkn-post-row-separator border-border/75" /> : null}
              </React.Fragment>
            ))}
          </div>
        </div>

        <PaginationControls
          page={page}
          totalPages={totalPages}
          hasMore={hasMore}
          isLoading={postsQuery.isLoading}
          searchParams={paginationSearchParams}
        />
      </section>
    </main>
  );
}
