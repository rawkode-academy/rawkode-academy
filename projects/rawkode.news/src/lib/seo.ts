const normalizeWhitespace = (value: string) => value.replace(/\s+/g, " ").trim();

export const stripMarkdownToText = (input: string) =>
  normalizeWhitespace(
    input
      .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
      .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
      .replace(/`{1,3}[^`]*`{1,3}/g, " ")
      .replace(/[#>*_~|-]/g, " ")
  );

export const truncateDescription = (input: string, max = 160) => {
  const normalized = normalizeWhitespace(input);
  if (normalized.length <= max) {
    return normalized;
  }

  return `${normalized.slice(0, max - 1).trimEnd()}…`;
};

export const buildCanonicalPath = (
  pathname: string,
  searchParams?: URLSearchParams,
  includeKeys: string[] = []
) => {
  if (!searchParams || includeKeys.length === 0) {
    return pathname;
  }

  const canonicalParams = new URLSearchParams();
  for (const key of includeKeys) {
    const value = searchParams.get(key);
    if (!value) continue;

    if (key === "page") {
      const page = Number(value);
      if (!Number.isFinite(page) || page <= 1) {
        continue;
      }
      canonicalParams.set("page", String(Math.floor(page)));
      continue;
    }

    canonicalParams.set(key, value);
  }

  const query = canonicalParams.toString();
  return query ? `${pathname}?${query}` : pathname;
};
