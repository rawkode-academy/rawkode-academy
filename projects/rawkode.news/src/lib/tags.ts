export const tagKinds = ["mandatory", "optional"] as const;

export type TagKind = (typeof tagKinds)[number];

export const coreTagSlugs = ["rka", "news", "show", "ask"] as const;

export type CoreTagSlug = (typeof coreTagSlugs)[number];

export const feedTypes = ["new", ...coreTagSlugs] as const;

export type FeedType = (typeof feedTypes)[number];

export const MAX_OPTIONAL_TAGS = 4;

const tagSlugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const normalizeTagSlug = (value: string) => value.trim().toLowerCase();

export const deriveTagSlug = (value: string) =>
  normalizeTagSlug(value)
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "")
    .replace(/-{2,}/g, "-");

export const isValidTagSlug = (value: string) => tagSlugPattern.test(value);

export const isCoreTagSlug = (value: string): value is CoreTagSlug =>
  (coreTagSlugs as readonly string[]).includes(value);

export const parseTagSlugs = (value: string | null) => {
  if (!value) return [] as string[];

  const slugs = value
    .split(",")
    .map((item) => normalizeTagSlug(item))
    .filter(Boolean);

  return Array.from(new Set(slugs));
};

export const normalizeTagSlugs = (values: string[]) => {
  const normalized = values
    .map((item) => normalizeTagSlug(String(item)))
    .filter(Boolean);

  return Array.from(new Set(normalized));
};
