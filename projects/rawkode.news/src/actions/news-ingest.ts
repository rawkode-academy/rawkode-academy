import { defineAction } from "astro:actions";
import { z } from "astro/zod";
import { newsSourceTypes } from "@/domains/news-ingest/contracts";
import {
  NEWS_SOURCE_LOCATOR_MAX_LENGTH,
  NEWS_SOURCE_NAME_MAX_LENGTH,
} from "@/domains/news-ingest/input-limits";
import {
  createNewsSource,
  deleteNewsSource,
  dismissNewsCandidate,
  publishNewsCandidate,
  previewNewsSource,
  pullNewsSources,
  setNewsSourceEnabled,
  updateNewsSource,
} from "@/domains/news-ingest/server";
import {
  POST_BODY_MAX_LENGTH,
  POST_TITLE_MAX_LENGTH,
  POST_URL_MAX_LENGTH,
} from "@/shared/input-limits";
import { MAX_OPTIONAL_TAGS } from "@/domains/tags/model";
import { raiseActionError, requireAdmin } from "./shared";

export const newsIngestActions = {
  createNewsSource: defineAction({
    accept: "form",
    input: z.object({
      type: z.enum(newsSourceTypes),
      name: z.string().trim().min(1).max(NEWS_SOURCE_NAME_MAX_LENGTH),
      locator: z.string().trim().min(1).max(NEWS_SOURCE_LOCATOR_MAX_LENGTH),
    }),
    handler: async (input, context) => {
      try {
        const { env } = await requireAdmin(context);
        const source = await createNewsSource(env, input);
        return { ok: true, source };
      } catch (error) {
        raiseActionError(error);
      }
    },
  }),
  previewNewsSource: defineAction({
    accept: "form",
    input: z.object({
      type: z.enum(newsSourceTypes),
      locator: z.string().trim().min(1).max(NEWS_SOURCE_LOCATOR_MAX_LENGTH),
    }),
    handler: async (input, context) => {
      try {
        await requireAdmin(context);
        return {
          ok: true,
          preview: await previewNewsSource(input),
        };
      } catch (error) {
        raiseActionError(error);
      }
    },
  }),
  updateNewsSource: defineAction({
    accept: "form",
    input: z.object({
      sourceId: z.string().trim().min(1),
      type: z.enum(newsSourceTypes),
      name: z.string().trim().min(1).max(NEWS_SOURCE_NAME_MAX_LENGTH),
      locator: z.string().trim().min(1).max(NEWS_SOURCE_LOCATOR_MAX_LENGTH),
    }),
    handler: async (input, context) => {
      try {
        const { env } = await requireAdmin(context);
        const source = await updateNewsSource(env, input.sourceId, input);
        return { ok: true, source };
      } catch (error) {
        raiseActionError(error);
      }
    },
  }),
  setNewsSourceEnabled: defineAction({
    accept: "form",
    input: z.object({
      sourceId: z.string().trim().min(1),
      enabled: z.enum(["true", "false"]).transform((value) => value === "true"),
    }),
    handler: async (input, context) => {
      try {
        const { env } = await requireAdmin(context);
        const source = await setNewsSourceEnabled(env, input.sourceId, input.enabled);
        return { ok: true, source };
      } catch (error) {
        raiseActionError(error);
      }
    },
  }),
  deleteNewsSource: defineAction({
    accept: "form",
    input: z.object({
      sourceId: z.string().trim().min(1),
    }),
    handler: async (input, context) => {
      try {
        const { env } = await requireAdmin(context);
        return {
          ok: true,
          ...(await deleteNewsSource(env, input.sourceId)),
        };
      } catch (error) {
        raiseActionError(error);
      }
    },
  }),
  pullNewsSources: defineAction({
    accept: "form",
    input: z.object({}),
    handler: async (_input, context) => {
      try {
        const { env } = await requireAdmin(context);
        return {
          ok: true,
          ...(await pullNewsSources(env)),
        };
      } catch (error) {
        raiseActionError(error);
      }
    },
  }),
  publishNewsCandidate: defineAction({
    accept: "form",
    input: z.object({
      candidateId: z.string().trim().min(1),
      title: z.string().trim().min(1).max(POST_TITLE_MAX_LENGTH),
      url: z.string().trim().min(1).max(POST_URL_MAX_LENGTH),
      body: z.string().trim().max(POST_BODY_MAX_LENGTH).optional(),
      optionalTag: z.array(z.string()).max(MAX_OPTIONAL_TAGS).default([]),
    }),
    handler: async (input, context) => {
      try {
        const { env, session } = await requireAdmin(context);
        const author = session.user.name?.trim() || session.user.email?.trim() || "";
        return {
          ok: true,
          ...(await publishNewsCandidate(env, {
            userId: session.user.id,
            author,
            candidateId: input.candidateId,
            title: input.title,
            url: input.url,
            body: input.body ?? null,
            optionalTagSlugs: input.optionalTag,
          })),
        };
      } catch (error) {
        raiseActionError(error);
      }
    },
  }),
  dismissNewsCandidate: defineAction({
    accept: "form",
    input: z.object({
      candidateId: z.string().trim().min(1),
    }),
    handler: async (input, context) => {
      try {
        const { env } = await requireAdmin(context);
        return {
          ok: true,
          candidate: await dismissNewsCandidate(env, input.candidateId),
        };
      } catch (error) {
        raiseActionError(error);
      }
    },
  }),
};
