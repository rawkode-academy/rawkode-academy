import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const buildPageSearch = (searchParams: URLSearchParams, nextPage: number) => {
  const next = new URLSearchParams(searchParams);
  if (nextPage <= 1) {
    next.delete("page");
  } else {
    next.set("page", String(nextPage));
  }
  const query = next.toString();
  return query ? `?${query}` : "";
};

export function PaginationControls({
  page,
  totalPages,
  hasMore,
  isLoading,
  searchParams,
}: {
  page: number;
  totalPages: number;
  hasMore: boolean;
  isLoading: boolean;
  searchParams: URLSearchParams;
}) {
  const pageCount = totalPages || (hasMore ? page + 1 : page);

  if (pageCount <= 1) {
    return null;
  }

  const prevDisabled = page <= 1 || isLoading;
  const nextDisabled = page >= pageCount || isLoading;
  const prevTo = { search: buildPageSearch(searchParams, page - 1) };
  const nextTo = { search: buildPageSearch(searchParams, page + 1) };

  const windowSize = 5;
  const halfWindow = Math.floor(windowSize / 2);
  let start = Math.max(1, page - halfWindow);
  let end = Math.min(pageCount, page + halfWindow);
  if (end - start + 1 < windowSize) {
    if (start === 1) {
      end = Math.min(pageCount, start + windowSize - 1);
    } else if (end === pageCount) {
      start = Math.max(1, end - windowSize + 1);
    }
  }

  const pageItems: Array<number | "ellipsis-start" | "ellipsis-end"> = [];
  if (start > 1) {
    pageItems.push(1);
    if (start > 2) {
      pageItems.push("ellipsis-start");
    }
  }
  for (let i = start; i <= end; i += 1) {
    pageItems.push(i);
  }
  if (end < pageCount) {
    if (end < pageCount - 1) {
      pageItems.push("ellipsis-end");
    }
    pageItems.push(pageCount);
  }

  return (
    <nav
      aria-label="Pagination"
      className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground"
    >
      <div className="flex flex-wrap items-center gap-2">
        {prevDisabled ? (
          <Button variant="ghost" size="sm" disabled>
            Previous
          </Button>
        ) : (
          <Button variant="ghost" size="sm" asChild>
            <Link to={prevTo} rel="prev">
              Previous
            </Link>
          </Button>
        )}
        {pageItems.map((item) => {
          if (typeof item !== "number") {
            return (
              <span key={item} aria-hidden className="px-1 text-muted-foreground/70">
                …
              </span>
            );
          }
          const to = { search: buildPageSearch(searchParams, item) };
          const isActive = item === page;
          return (
            <Button
              key={item}
              variant={isActive ? "secondary" : "ghost"}
              size="sm"
              asChild={!isActive}
              disabled={isActive}
            >
              {isActive ? <span>{item}</span> : <Link to={to}>{item}</Link>}
            </Button>
          );
        })}
        {nextDisabled ? (
          <Button variant="ghost" size="sm" disabled>
            Next
          </Button>
        ) : (
          <Button variant="ghost" size="sm" asChild>
            <Link to={nextTo} rel="next">
              Next
            </Link>
          </Button>
        )}
      </div>
      <span>
        Page {page} of {pageCount}
      </span>
    </nav>
  );
}
