import { tryNormalizeExternalUrl } from "@/shared/urls/normalization";

export const findMatchingPostByNormalizedUrl = <
  T extends { url: string | null | undefined },
>(
  rows: T[],
  normalizedUrl: string,
) =>
  rows.find((row) => {
    const rowUrl = tryNormalizeExternalUrl(row.url);
    return rowUrl === normalizedUrl;
  }) ?? null;
