import * as z from "zod";

const durationValidator = (value) => {
  const durationPattern = /^P(\d+Y)?(\d+M)?(\d+D)?(T(\d+H)?(\d+M)?(\d+S)?)?$/;
  if (!durationPattern.test(value)) {
    throw new Error("Invalid ISO 8601 duration format.");
  }
  return value;
};

const thumbnailSchema = z.object({
  url: z.string(),
  width: z.number(),
  height: z.number(),
});

const localizedSchema = z.object({
  title: z.string(),
  description: z.string(),
});

const snippetSchema = z.object({
  publishedAt: z.string(),
  channelId: z.string(),
  title: z.string(),
  description: z.string(),
  thumbnails: z.object({
    default: thumbnailSchema,
    medium: thumbnailSchema,
    high: thumbnailSchema,
    standard: thumbnailSchema,
  }),
  channelTitle: z.string(),
  categoryId: z.string(),
  liveBroadcastContent: z.string(),
  localized: localizedSchema,
  defaultAudioLanguage: z.string(),
});

const contentDetailsSchema = z.object({
  duration: z.custom(durationValidator),
});

const statusSchema = z.object({
  uploadStatus: z.string(),
  privacyStatus: z.string(),
  license: z.string(),
  embeddable: z.boolean(),
  publicStatsViewable: z.boolean(),
  madeForKids: z.boolean(),
  selfDeclaredMadeForKids: z.boolean(),
});

const statisticsSchema = z.object({
  viewCount: z.string(),
  likeCount: z.string(),
  dislikeCount: z.string(),
  favoriteCount: z.string(),
  commentCount: z.string(),
});

const fileDetailsSchema = z.object({
  fileName: z.string(),
});

export const unparsedVideo = z.object({
  kind: z.string(),
  etag: z.string(),
  id: z.string(),
  snippet: snippetSchema,
  contentDetailsSchema: contentDetailsSchema,
  status: statusSchema,
  statistics: statisticsSchema,
  recordingDetails: z.record({}),
  fileDetails: fileDetailsSchema,
});

export const parsedVideo = z.object({
  slug: z.string(),
  youtubeId: z.string(),

  title: z.string(),
  description: z.string(),
  duration: z.custom(durationValidator),

  visibility: z.ZodEnum(["private", "tier-1", "tier-2", "tier-3", "public"]),

  publishedAt: z.string().datetime(),

  wasLive: z.boolean(),
  scheduledFor: z.string().datetime(),
  thumbnailUrl: z.string().url(),

  viewCount: z.number(),
  likeCount: z.number(),
  dislikeCount: z.number(),
  favoriteCount: z.number(),
  commentCount: z.number(),
})
