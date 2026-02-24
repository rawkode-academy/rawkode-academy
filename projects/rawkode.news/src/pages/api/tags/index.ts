import type { APIRoute, AstroCookies } from "astro";
import { asc, desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { postTags, tags } from "@/db/schema";
import { SESSION_COOKIE_NAME, type StoredSession } from "@/lib/auth";
import { createEntityId } from "@/lib/ids";
import { getPermissions } from "@/lib/permissions";
import { isCoreTagSlug, isValidTagSlug, type TagKind } from "@/lib/tags";
import type { TypedEnv } from "@/types/service-bindings";

type CreateTagPayload = {
  slug?: unknown;
  name?: unknown;
  description?: unknown;
};

const normalizeTag = (value: {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  kind: TagKind;
  usageCount: number;
}) => ({
  id: value.id,
  slug: value.slug,
  name: value.name,
  description: value.description,
  kind: value.kind,
  usageCount: Number(value.usageCount || 0),
});

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
    return { error: new Response("Sign in required", { status: 401 }), session: null };
  }

  const permissions = await getPermissions(env, session.user.id);
  if (!permissions.isAdmin) {
    return { error: new Response("Admin role required", { status: 403 }), session };
  }

  return { error: null, session };
};

const listTags = async (env: TypedEnv, kind?: TagKind) => {
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
  return rows.map(normalizeTag);
};

export const GET: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime.env as TypedEnv;
  const url = new URL(request.url);
  const rawKind = url.searchParams.get("kind")?.toLowerCase();
  const kind = rawKind === "mandatory" || rawKind === "optional"
    ? rawKind
    : undefined;

  if (rawKind && !kind) {
    return new Response("Invalid kind", { status: 400 });
  }

  const items = await listTags(env, kind);
  return Response.json(items);
};

export const POST: APIRoute = async ({ request, locals, cookies }) => {
  const env = locals.runtime.env as TypedEnv;
  const auth = await requireAdmin(env, cookies);
  if (auth.error) {
    return auth.error;
  }

  const payload = (await request.json().catch(() => null)) as
    | CreateTagPayload
    | null;

  const slug = typeof payload?.slug === "string" ? payload.slug.trim().toLowerCase() : "";
  const name = typeof payload?.name === "string" ? payload.name.trim() : "";
  const description = typeof payload?.description === "string"
    ? payload.description.trim() || null
    : null;

  if (!slug || !name) {
    return new Response("Tag name and slug are required", { status: 400 });
  }

  if (!isValidTagSlug(slug)) {
    return new Response("Invalid tag slug", { status: 400 });
  }

  if (isCoreTagSlug(slug)) {
    return new Response("Core tag slugs are reserved", { status: 400 });
  }

  const db = getDb(env);

  try {
    await db.insert(tags).values({
      id: createEntityId(),
      slug,
      name,
      description,
      kind: "optional",
    });
  } catch {
    return new Response("Tag slug already exists", { status: 409 });
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
    .where(eq(tags.slug, slug))
    .orderBy(desc(tags.createdAt))
    .limit(1);

  if (!created) {
    return new Response("Failed to create tag", { status: 500 });
  }

  return Response.json(normalizeTag(created), { status: 201 });
};
