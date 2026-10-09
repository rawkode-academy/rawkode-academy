import { z } from 'zod'
import type { EditorialTimesV1 } from '../editorial/effective'

// Published read contract, version 1. The website (workstream G5) reads it over a
// service binding to rawkode-academy-payload, entrypoint PublishedContent; it is
// never served on a public host (src/ingress.ts answers 404 there).
//
// publishedAt is the effective first public release:
//   video_editorial_times.published_at ?? (published in Payload ? the imported videos.publishedAt : null)
// It is stable across republishes. scheduledStartAt falls back to the imported
// publishedAt of a live video; broadcast times come only from Rawkode Studio or
// staff corrections. Every time is canonical UTC ISO 8601 with milliseconds.
//
// Additive, optional fields may appear within v1. Removing or retyping a field,
// or changing a meaning above, requires contractVersion 2 at a new path.
export const PUBLISHED_CONTRACT_VERSION = 1
export const publishedPaths = { list: '/api/published/v1/videos', item: '/api/published/v1/videos/' } as const
export const availabilityValues = ['live', 'upcoming', 'ended', 'available'] as const
export type Availability = (typeof availabilityValues)[number]
// A started broadcast with no end flips to 'ended' after this long, so a missed
// broadcast-ended never leaves a video live forever. Staff correct the times.
export const liveStaleMs = 12 * 3600 * 1000

const time = z.iso.datetime().nullable()
const absoluteUrl = z.url({ protocol: /^https?$/ }).nullable()
const reference = z.object({ id: z.string().min(1), name: z.string() }).strict()

export const PublishedVideoV1 = z.object({
  contractVersion: z.literal(1),
  // The legacyId: the CDN key and Rawkode Studio's contentVideoId.
  id: z.string().min(1),
  slug: z.string().min(1),
  title: z.string(),
  description: z.string().nullable(),
  tagline: z.string().optional(),
  subtitle: z.string().optional(),
  type: z.enum(['live', 'recorded']).nullable(),
  category: z.string().nullable(),
  scheduledStartAt: time,
  broadcastStartedAt: time,
  broadcastEndedAt: time,
  publishedAt: time,
  availability: z.enum(availabilityValues),
  // Seconds.
  duration: z.number().nonnegative().nullable(),
  // Absolute URLs as stored, never rebuilt from the id.
  streamUrl: absoluteUrl,
  thumbnailUrl: absoluteUrl,
  // Review chapters when the cut came through client review, otherwise the
  // imported chapters. startTime is in seconds.
  chapters: z.array(z.object({ title: z.string(), startTime: z.number().nonnegative() }).strict()),
  show: reference.nullable(),
  guests: z.array(reference),
  // Technology legacyIds.
  technologies: z.array(z.string()),
  episode: z.object({ id: z.string().min(1), code: z.string().nullable() }).strict().nullable(),
  youtubeId: z.string().nullable(),
}).strict()
export type PublishedVideo = z.infer<typeof PublishedVideoV1>

export const PublishedVideoListV1 = z.object({
  contractVersion: z.literal(1),
  items: z.array(PublishedVideoV1),
  // Pass back as ?cursor= for the next page; null on the last page.
  nextCursor: z.string().nullable(),
  generatedAt: z.iso.datetime(),
}).strict()
export type PublishedVideoList = z.infer<typeof PublishedVideoListV1>

// Checked in order. null means the video is not visible in the contract.
export function availability(type: unknown, times: EditorialTimesV1, now: number, staleMs = liveStaleMs): Availability | null {
  const at = (value: string | null) => (value ? Date.parse(value) : Number.NaN)
  const started = at(times.broadcastStartedAt)
  const ended = at(times.broadcastEndedAt)
  if (!Number.isNaN(started) && Number.isNaN(ended) && now - started <= staleMs) return 'live'
  if (!Number.isNaN(at(times.publishedAt)) && at(times.publishedAt) <= now) return 'available'
  if (!Number.isNaN(ended) || !Number.isNaN(started)) return 'ended'
  if (type === 'live' && times.scheduledStartAt) return 'upcoming'
  return null
}
