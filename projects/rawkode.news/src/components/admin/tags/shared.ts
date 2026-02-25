import type { ApiTag } from "@/lib/contracts";

export type EditState = {
  id: string;
  originalSlug: string;
  name: string;
  slug: string;
  description: string;
  slugManuallyEdited: boolean;
};

export type PageItem = number | "ellipsis-start" | "ellipsis-end";

const mandatoryDisplayNames: Record<string, string> = {
  rka: "RKA",
  news: "News",
  show: "Show",
  ask: "Ask",
};

export const normalizeSlug = (value: string | null | undefined) => {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  return normalized.length ? normalized : null;
};

export const parsePageValue = (value: string | null) => {
  const parsed = Number(value ?? "1");
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return Math.floor(parsed);
};

export const sortTags = (items: ApiTag[]) =>
  [...items].sort((left, right) => {
    if (left.kind !== right.kind) {
      return left.kind === "mandatory" ? -1 : 1;
    }
    return left.slug.localeCompare(right.slug);
  });

export const getTagDisplayName = (tag: ApiTag) =>
  tag.kind === "mandatory"
    ? mandatoryDisplayNames[tag.slug] ?? tag.name ?? tag.slug
    : tag.name || tag.slug;

export const toEditState = (tag: ApiTag): EditState => ({
  id: tag.id,
  originalSlug: tag.slug,
  name: tag.name,
  slug: tag.slug,
  description: tag.description ?? "",
  slugManuallyEdited: false,
});

export const rowAnchor = (tagId: string) => `tag-row-${tagId}`;

export const buildPageItems = (currentPage: number, pageCount: number): PageItem[] => {
  const windowSize = 5;
  const halfWindow = Math.floor(windowSize / 2);
  let start = Math.max(1, currentPage - halfWindow);
  let end = Math.min(pageCount, currentPage + halfWindow);

  if (end - start + 1 < windowSize) {
    if (start === 1) {
      end = Math.min(pageCount, start + windowSize - 1);
    } else if (end === pageCount) {
      start = Math.max(1, end - windowSize + 1);
    }
  }

  const items: PageItem[] = [];
  if (start > 1) {
    items.push(1);
    if (start > 2) {
      items.push("ellipsis-start");
    }
  }

  for (let i = start; i <= end; i += 1) {
    items.push(i);
  }

  if (end < pageCount) {
    if (end < pageCount - 1) {
      items.push("ellipsis-end");
    }
    items.push(pageCount);
  }

  return items;
};
