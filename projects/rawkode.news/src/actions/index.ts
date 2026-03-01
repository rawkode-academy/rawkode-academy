import { type ActionAPIContext, ActionError, defineAction } from "astro:actions";
import { z } from "astro:schema";
import { commentAnchor, postPath } from "@/lib/contracts";
import { parseEntityId } from "@/lib/ids";
import {
  COMMENT_BODY_MAX_LENGTH,
  POST_BODY_MAX_LENGTH,
  POST_TITLE_MAX_LENGTH,
  POST_URL_MAX_LENGTH,
  TAG_DESCRIPTION_MAX_LENGTH,
  TAG_NAME_MAX_LENGTH,
  TAG_SLUG_MAX_LENGTH,
} from "@/lib/input-limits";
import { createComment, createPost } from "@/lib/server/posts";
import { asRequestError, RequestError } from "@/lib/server/errors";
import { getSessionWithPermissions } from "@/lib/server/session";
import {
  createOptionalTag,
  deleteOptionalTag,
  updateOptionalTag,
} from "@/lib/server/tags";
import { MAX_OPTIONAL_TAGS, normalizeTagSlugs } from "@/lib/tags";
import type { TypedEnv } from "@/types/service-bindings";

const raiseActionError = (error: unknown): never => {
  const requestError = asRequestError(error);
  throw new ActionError({
    code: ActionError.statusToCode(requestError.status),
    message: requestError.message,
  });
};

const requireSession = async (context: ActionAPIContext) => {
  const env = context.locals.runtime.env as TypedEnv;
  const { session, permissions } = await getSessionWithPermissions(env, context.cookies);
  if (!session || !permissions) {
    throw new RequestError("Sign in required", 401);
  }
  return { env, session, permissions };
};

const requireAdmin = async (context: ActionAPIContext) => {
  const { env, permissions } = await requireSession(context);
  if (!permissions.isAdmin) {
    throw new RequestError("Admin role required", 403);
  }
  return { env, permissions };
};

export const server = {
  createPost: defineAction({
    accept: "form",
    input: z.object({
      title: z.string().trim().min(1).max(POST_TITLE_MAX_LENGTH),
      url: z.string().trim().max(POST_URL_MAX_LENGTH).optional(),
      body: z.string().trim().max(POST_BODY_MAX_LENGTH).optional(),
      mandatoryTag: z.string().min(1),
      optionalTag: z.array(z.string()).max(MAX_OPTIONAL_TAGS).default([]),
    }),
    handler: async (input, context) => {
      try {
        const { env, session } = await requireSession(context);
        const author = session.user.name?.trim() || session.user.email?.trim() || "";
        const tagSlugs = normalizeTagSlugs([input.mandatoryTag, ...input.optionalTag]);
        const post = await createPost(env, {
          userId: session.user.id,
          author,
          title: input.title,
          url: input.url ?? null,
          body: input.body ?? null,
          tagSlugs,
        });
        return { redirectTo: postPath(post) };
      } catch (error) {
        raiseActionError(error);
      }
    },
  }),
  createComment: defineAction({
    accept: "form",
    input: z.object({
      postId: z.string().min(1),
      body: z.string().trim().min(1).max(COMMENT_BODY_MAX_LENGTH),
      parentId: z.string().optional(),
      returnTo: z.string().optional(),
    }),
    handler: async (input, context) => {
      try {
        const { env, session } = await requireSession(context);
        const author = session.user.name?.trim() || session.user.email?.trim() || "";
        const postId = parseEntityId(input.postId);
        if (!postId) {
          throw new RequestError("Invalid post id", 400);
        }

        const parentId = input.parentId ? parseEntityId(input.parentId) : null;
        if (input.parentId && !parentId) {
          throw new RequestError("Invalid parent id", 400);
        }

        const created = await createComment(env, {
          postId,
          body: input.body,
          parentId,
          author,
        });

        const targetPath = input.returnTo?.startsWith("/item/")
          ? input.returnTo
          : `/item/${postId}`;

        return {
          redirectTo: `${targetPath}#${commentAnchor(created)}`,
          created,
        };
      } catch (error) {
        raiseActionError(error);
      }
    },
  }),
  createTag: defineAction({
    accept: "form",
    input: z.object({
      name: z.string().trim().min(1).max(TAG_NAME_MAX_LENGTH),
      slug: z.string().trim().max(TAG_SLUG_MAX_LENGTH).optional(),
      returnTo: z.string().optional(),
      description: z.string().trim().max(TAG_DESCRIPTION_MAX_LENGTH).optional(),
    }),
    handler: async (input, context) => {
      try {
        const { env } = await requireAdmin(context);
        const created = await createOptionalTag(env, {
          name: input.name,
          slug: input.slug ?? null,
          description: input.description ?? null,
        });
        return { ok: true, tag: created, returnTo: input.returnTo ?? null };
      } catch (error) {
        raiseActionError(error);
      }
    },
  }),
  updateTag: defineAction({
    accept: "form",
    input: z.object({
      originalSlug: z.string().trim().min(1).max(TAG_SLUG_MAX_LENGTH),
      name: z.string().trim().min(1).max(TAG_NAME_MAX_LENGTH),
      slug: z.string().trim().max(TAG_SLUG_MAX_LENGTH).optional(),
      returnTo: z.string().optional(),
      description: z.string().trim().max(TAG_DESCRIPTION_MAX_LENGTH).optional(),
    }),
    handler: async (input, context) => {
      try {
        const { env } = await requireAdmin(context);
        const updated = await updateOptionalTag(env, input.originalSlug, {
          name: input.name,
          slug: input.slug ?? null,
          description: input.description ?? null,
        });
        return { ok: true, tag: updated, returnTo: input.returnTo ?? null };
      } catch (error) {
        raiseActionError(error);
      }
    },
  }),
  deleteTag: defineAction({
    accept: "form",
    input: z.object({
      slug: z.string().min(1),
      returnTo: z.string().optional(),
    }),
    handler: async (input, context) => {
      try {
        const { env } = await requireAdmin(context);
        await deleteOptionalTag(env, input.slug);
        return {
          ok: true,
          slug: input.slug.trim().toLowerCase(),
          returnTo: input.returnTo ?? null,
        };
      } catch (error) {
        raiseActionError(error);
      }
    },
  }),
};
