import { asc, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { postTags, tags } from "@/db/schema";
import type { ApiTag } from "@/lib/contracts";
import { createEntityId } from "@/lib/ids";
import { RequestError } from "@/lib/server/errors";
import {
  coreTagSlugs,
  deriveTagSlug,
  isCoreTagSlug,
  isValidTagSlug,
  type TagKind,
} from "@/lib/tags";
import type { TypedEnv } from "@/types/service-bindings";

const coreTagRank = new Map<string, number>(
  coreTagSlugs.map((slug, index) => [slug, index]),
);

const normalizeTag = (value: {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  kind: TagKind;
  usageCount: number;
}): ApiTag => ({
  id: value.id,
  slug: value.slug,
  name: value.name,
  description: value.description,
  kind: value.kind,
  usageCount: Number(value.usageCount || 0),
});

export const sortTags = (items: ApiTag[]) =>
  [...items].sort((left, right) => {
    if (left.kind !== right.kind) {
      return left.kind === "mandatory" ? -1 : 1;
    }
    if (left.kind === "mandatory" && right.kind === "mandatory") {
      return (
        (coreTagRank.get(left.slug) ?? Number.MAX_SAFE_INTEGER) -
        (coreTagRank.get(right.slug) ?? Number.MAX_SAFE_INTEGER)
      );
    }
    return left.slug.localeCompare(right.slug);
  });

export const listTags = async (env: TypedEnv, kind?: TagKind) => {
  const db = getDb(env);
  const whereExpr = kind ? eq(tags.kind, kind) : undefined;

  const baseQuery = db
    .select({
      id: tags.id,
      slug: tags.slug,
      name: tags.name,
      description: tags.description,
      kind: tags.kind,
      usageCount: sql<number>`count(${postTags.postId})`,
    })
    .from(tags)
    .leftJoin(postTags, eq(postTags.tagId, tags.id))
    .groupBy(tags.id)
    .orderBy(asc(tags.kind), asc(tags.slug));

  const rows = whereExpr ? await baseQuery.where(whereExpr) : await baseQuery;
  return sortTags(rows.map(normalizeTag));
};

export const getTagsBySlugs = async (env: TypedEnv, slugs: string[]) => {
  const normalized = Array.from(
    new Set(slugs.map((slug) => slug.trim().toLowerCase()).filter(Boolean)),
  );
  if (normalized.length === 0) {
    return [];
  }

  const db = getDb(env);
  const rows = await db
    .select({
      id: tags.id,
      slug: tags.slug,
      name: tags.name,
      description: tags.description,
      kind: tags.kind,
    })
    .from(tags)
    .where(inArray(tags.slug, normalized));

  return sortTags(rows.map((row) => ({ ...row })));
};

export const getTagBySlug = async (env: TypedEnv, slug: string) => {
  const db = getDb(env);
  const normalizedSlug = slug.trim().toLowerCase();
  const [row] = await db
    .select({
      id: tags.id,
      slug: tags.slug,
      name: tags.name,
      description: tags.description,
      kind: tags.kind,
    })
    .from(tags)
    .where(eq(tags.slug, normalizedSlug))
    .limit(1);

  if (!row) {
    return null;
  }

  const [usage] = await db
    .select({ count: sql<number>`count(*)` })
    .from(postTags)
    .where(eq(postTags.tagId, row.id));

  return normalizeTag({ ...row, usageCount: Number(usage?.count || 0) });
};

export const createOptionalTag = async (
  env: TypedEnv,
  input: { name: string; description?: string | null; slug?: string | null },
) => {
  const name = input.name.trim();
  if (!name) {
    throw new RequestError("Tag name is required", 400);
  }

  const slugCandidate = input.slug?.trim()
    ? input.slug.trim().toLowerCase()
    : deriveTagSlug(name);

  if (!slugCandidate) {
    throw new RequestError("Tag slug is required", 400);
  }
  if (!isValidTagSlug(slugCandidate)) {
    throw new RequestError("Invalid tag slug", 400);
  }
  if (isCoreTagSlug(slugCandidate)) {
    throw new RequestError("Core tag slugs are reserved", 400);
  }

  const description = input.description?.trim() || null;
  const db = getDb(env);

  try {
    await db.insert(tags).values({
      id: createEntityId(),
      slug: slugCandidate,
      name,
      description,
      kind: "optional",
    });
  } catch {
    throw new RequestError("Tag slug already exists", 409);
  }

  const [created] = await db
    .select({
      id: tags.id,
      slug: tags.slug,
      name: tags.name,
      description: tags.description,
      kind: tags.kind,
      usageCount: sql<number>`0`,
    })
    .from(tags)
    .where(eq(tags.slug, slugCandidate))
    .orderBy(desc(tags.createdAt))
    .limit(1);

  if (!created) {
    throw new RequestError("Failed to create tag", 500);
  }

  return normalizeTag(created);
};

export const updateOptionalTag = async (
  env: TypedEnv,
  existingSlug: string,
  input: { name?: string | null; description?: string | null; slug?: string | null },
) => {
  const db = getDb(env);
  const normalizedExistingSlug = existingSlug.trim().toLowerCase();

  const [existing] = await db
    .select({
      id: tags.id,
      slug: tags.slug,
      kind: tags.kind,
      name: tags.name,
    })
    .from(tags)
    .where(eq(tags.slug, normalizedExistingSlug))
    .limit(1);

  if (!existing) {
    throw new RequestError("Tag not found", 404);
  }
  if (existing.kind === "mandatory") {
    throw new RequestError("Core tags are immutable", 403);
  }

  const nextName = input.name == null ? existing.name : input.name.trim();
  if (!nextName) {
    throw new RequestError("Tag name cannot be empty", 400);
  }

  const nextSlug = input.slug?.trim()
    ? input.slug.trim().toLowerCase()
    : deriveTagSlug(nextName);

  if (!nextSlug) {
    throw new RequestError("Tag slug is required", 400);
  }
  if (!isValidTagSlug(nextSlug)) {
    throw new RequestError("Invalid tag slug", 400);
  }
  if (isCoreTagSlug(nextSlug) && nextSlug !== existing.slug) {
    throw new RequestError("Core tag slugs are reserved", 400);
  }

  const nextDescription = input.description == null
    ? undefined
    : input.description.trim() || null;

  try {
    await db
      .update(tags)
      .set({
        name: nextName,
        slug: nextSlug,
        ...(nextDescription !== undefined ? { description: nextDescription } : {}),
      })
      .where(eq(tags.id, existing.id));
  } catch {
    throw new RequestError("Tag slug already exists", 409);
  }

  const updated = await getTagBySlug(env, nextSlug);
  if (!updated) {
    throw new RequestError("Tag not found", 404);
  }
  return updated;
};

export const deleteOptionalTag = async (env: TypedEnv, slug: string) => {
  const db = getDb(env);
  const normalizedSlug = slug.trim().toLowerCase();
  const [target] = await db
    .select({ id: tags.id, kind: tags.kind })
    .from(tags)
    .where(eq(tags.slug, normalizedSlug))
    .limit(1);

  if (!target) {
    throw new RequestError("Tag not found", 404);
  }
  if (target.kind === "mandatory") {
    throw new RequestError("Core tags cannot be deleted", 403);
  }

  const [usage] = await db
    .select({ count: sql<number>`count(*)` })
    .from(postTags)
    .where(eq(postTags.tagId, target.id));

  if ((usage?.count ?? 0) > 0) {
    throw new RequestError("Tag is in use and cannot be deleted", 409);
  }

  await db.delete(tags).where(eq(tags.id, target.id));
};
