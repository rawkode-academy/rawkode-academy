import { defineAction } from "astro:actions";
import { z } from "astro/zod";
import {
  TAG_DESCRIPTION_MAX_LENGTH,
  TAG_NAME_MAX_LENGTH,
  TAG_SLUG_MAX_LENGTH,
} from "@/shared/input-limits";
import {
  createOptionalTag,
  deleteOptionalTag,
  updateOptionalTag,
} from "@/domains/tags/server";
import { raiseActionError, requireAdmin } from "./shared";

export const tagActions = {
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
