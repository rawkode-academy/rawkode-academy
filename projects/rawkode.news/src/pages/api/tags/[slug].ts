import type { APIRoute, AstroCookies } from "astro";
import { eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { postTags, tags } from "@/db/schema";
import { SESSION_COOKIE_NAME, type StoredSession } from "@/lib/auth";
import { getPermissions } from "@/lib/permissions";
import { isCoreTagSlug, isValidTagSlug } from "@/lib/tags";
import type { TypedEnv } from "@/types/service-bindings";

type UpdateTagPayload = {
  slug?: unknown;
  name?: unknown;
  description?: unknown;
};

const getSession = async (env: TypedEnv, cookies: AstroCookies) => {
  const sessionId = cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionId) {
    return null;
  }

  const session = (await env.SESSION.get(
    `session:${sessionId}`,
    "json",
  )) as StoredSession | null;

  if (!session) {
    return null;
  }

  if (session.expiresAt <= Date.now()) {
    await env.SESSION.delete(`session:${sessionId}`);
    cookies.delete(SESSION_COOKIE_NAME, { path: "/" });
    return null;
  }

  return session;
};

const requireAdmin = async (env: TypedEnv, cookies: AstroCookies) => {
  const session = await getSession(env, cookies);
  if (!session) {
    return new Response("Sign in required", { status: 401 });
  }

  const permissions = await getPermissions(env, session.user.id);
  if (!permissions.isAdmin) {
    return new Response("Admin role required", { status: 403 });
  }

  return null;
};

const normalizeSlugParam = (value: string | undefined) =>
  decodeURIComponent(value ?? "").trim().toLowerCase();

export const PATCH: APIRoute = async ({ params, request, locals, cookies }) => {
  const env = locals.runtime.env as TypedEnv;
  const authError = await requireAdmin(env, cookies);
  if (authError) {
    return authError;
  }

  const existingSlug = normalizeSlugParam(params.slug);
  if (!existingSlug) {
    return new Response("Invalid slug", { status: 400 });
  }

  const db = getDb(env);
  const [existing] = await db
    .select({
      id: tags.id,
      slug: tags.slug,
      kind: tags.kind,
    })
    .from(tags)
    .where(eq(tags.slug, existingSlug))
    .limit(1);

  if (!existing) {
    return new Response("Tag not found", { status: 404 });
  }

  if (existing.kind === "mandatory") {
    return new Response("Core tags are immutable", { status: 403 });
  }

  const payload = (await request.json().catch(() => null)) as
    | UpdateTagPayload
    | null;

  const nextSlug = typeof payload?.slug === "string"
    ? payload.slug.trim().toLowerCase()
    : existing.slug;
  const nextName = typeof payload?.name === "string"
    ? payload.name.trim()
    : undefined;
  const nextDescription = typeof payload?.description === "string"
    ? payload.description.trim() || null
    : undefined;

  if (!nextSlug) {
    return new Response("Tag slug is required", { status: 400 });
  }

  if (!isValidTagSlug(nextSlug)) {
    return new Response("Invalid tag slug", { status: 400 });
  }

  if (isCoreTagSlug(nextSlug) && nextSlug !== existing.slug) {
    return new Response("Core tag slugs are reserved", { status: 400 });
  }

  if (nextName !== undefined && !nextName) {
    return new Response("Tag name cannot be empty", { status: 400 });
  }

  const updatePayload: Partial<typeof tags.$inferInsert> = {
    slug: nextSlug,
  };

  if (nextName !== undefined) {
    updatePayload.name = nextName;
  }

  if (nextDescription !== undefined) {
    updatePayload.description = nextDescription;
  }

  try {
    await db
      .update(tags)
      .set(updatePayload)
      .where(eq(tags.id, existing.id));
  } catch {
    return new Response("Tag slug already exists", { status: 409 });
  }

  const [updated] = await db
    .select({
      id: tags.id,
      slug: tags.slug,
      name: tags.name,
      description: tags.description,
      kind: tags.kind,
    })
    .from(tags)
    .where(eq(tags.id, existing.id))
    .limit(1);

  if (!updated) {
    return new Response("Tag not found", { status: 404 });
  }

  const [usage] = await db
    .select({ count: sql<number>`count(*)` })
    .from(postTags)
    .where(eq(postTags.tagId, existing.id));

  return Response.json({
    ...updated,
    usageCount: Number(usage?.count || 0),
  });
};

export const DELETE: APIRoute = async ({ params, locals, cookies }) => {
  const env = locals.runtime.env as TypedEnv;
  const authError = await requireAdmin(env, cookies);
  if (authError) {
    return authError;
  }

  const slug = normalizeSlugParam(params.slug);
  if (!slug) {
    return new Response("Invalid slug", { status: 400 });
  }

  const db = getDb(env);

  const [target] = await db
    .select({ id: tags.id, slug: tags.slug, kind: tags.kind })
    .from(tags)
    .where(eq(tags.slug, slug))
    .limit(1);

  if (!target) {
    return new Response("Tag not found", { status: 404 });
  }

  if (target.kind === "mandatory") {
    return new Response("Core tags cannot be deleted", { status: 403 });
  }

  const [usage] = await db
    .select({ count: sql<number>`count(*)` })
    .from(postTags)
    .where(eq(postTags.tagId, target.id));

  if ((usage?.count ?? 0) > 0) {
    return new Response("Tag is in use and cannot be deleted", { status: 409 });
  }

  await db.delete(tags).where(eq(tags.id, target.id));
  return new Response(null, { status: 204 });
};
