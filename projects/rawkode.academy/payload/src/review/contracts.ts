import { z } from 'zod'

const cuid2 = z.string().regex(/^[a-z][a-z0-9]{23}$/)
const id = cuid2
const text = (max: number) => z.string().trim().min(1).max(max)
export const metadataSchema = z.object({
  title: text(300), description: text(8000), thumbnailId: cuid2.optional(), transcript: z.string().max(100000).default(''),
  chapters: z.array(z.object({ title: text(200), startTime: z.number().int().nonnegative() }).strict()).max(100).default([]),
}).strict()
const base = { videoId: cuid2, commandId: id }
// A revision grant may last at most this long; staff re-share to extend it.
export const maximumGrantDays = 90
const revision = { revisionId: id, expectedReviewVersion: positiveId }
export const commandSchema = z.discriminatedUnion('action', [
  z.object({ ...base, action: z.literal('create-revision'), mediaId: cuid2, deliverableMediaId: cuid2, durationMs: z.number().int().positive().max(86400000).optional(), metadata: metadataSchema }).strict(),
  z.object({ ...base, action: z.literal('share'), revisionId: id, userId: cuid2, canApprove: z.boolean(), expiresAt: z.iso.datetime().optional(), expiresInDays: z.number().int().min(1).max(maximumGrantDays).optional() }).strict(),
  z.object({ ...base, action: z.literal('revoke'), userId: cuid2, revisionId: id.optional() }).strict(),
  z.object({ ...base, ...revision, action: z.literal('edit'), metadata: metadataSchema }).strict(),
  z.object({ ...base, action: z.literal('comment'), revisionId: id, startMs: z.number().int().nonnegative(), endMs: z.number().int().nonnegative().optional(), body: text(8000) }).strict(),
  z.object({ ...base, action: z.literal('resolve-comment'), commentId: id, resolved: z.boolean() }).strict(),
  z.object({ ...base, ...revision, action: z.literal('decide'), decision: z.enum(['approved', 'changes-requested']), note: z.string().trim().max(8000).default('') }).strict(),
  z.object({ ...base, ...revision, action: z.literal('publish'), decisionId: id }).strict(),
])
export type ReviewCommand = z.infer<typeof commandSchema>
export type ReviewMetadata = z.infer<typeof metadataSchema>
export type ReviewActor = { id: string; collection: 'users'; role: 'staff' | 'customer' }
export class ReviewError extends Error {
  constructor(public status: number, message: string) { super(message) }
}
export function actorFromUser(user: unknown): ReviewActor {
  const result = z.object({ id: cuid2, collection: z.literal('users'), role: z.enum(['staff', 'customer']) }).safeParse(user)
  if (!result.success) throw new ReviewError(401, 'Sign in to review this video')
  return result.data
}
export function validateMetadata(metadata: ReviewMetadata, durationMs: number) {
  let previous = -1
  for (const chapter of metadata.chapters) {
    if (chapter.startTime * 1000 >= durationMs || chapter.startTime <= previous) throw new ReviewError(400, 'Chapter times must increase and be within the video')
    previous = chapter.startTime
  }
}
