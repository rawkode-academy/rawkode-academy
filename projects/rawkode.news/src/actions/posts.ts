import { defineAction } from "astro:actions";
import { z } from "astro/zod";
import { commentAnchor, postPath } from "@/shared/contracts";
import { parseEntityId } from "@/shared/ids";
import {
  COMMENT_BODY_MAX_LENGTH,
  POST_BODY_MAX_LENGTH,
  POST_TITLE_MAX_LENGTH,
  POST_URL_MAX_LENGTH,
} from "@/shared/input-limits";
import { createComment, createPost } from "@/domains/posts/server";
import { MAX_OPTIONAL_TAGS, normalizeTagSlugs } from "@/domains/tags/model";
import { RequestError } from "@/server/errors";
import { raiseActionError, requireSession } from "./shared";

export const postActions = {
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
};
