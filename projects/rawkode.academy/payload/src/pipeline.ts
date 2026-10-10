import {isStaff} from './auth/access'
import type {AdminAccess} from './admin/access'
import {applyPreset} from './admin/collection-admin'
import type { CollectionConfig, Field, Payload } from 'payload'

type User = NonNullable<Parameters<Payload['find']>[0]['user']>
type Run = Record<string, unknown> & { id: string; key: string; video: string; media: string; checksum: string; videoVersion: string; state: string; generatedRevision?: string }
export type PipelineOutput = { runId: string; checksum: string; videoVersion: string; transcript: string; summary: string; chapters: { title: string; startTime: number }[]; manifestKey: string; provider: 'deterministic-fixture'; transcriptionAttempts: number }
export const pipelineVideoFields: Field[] = [
  { name: 'processingState', type: 'select', options: ['processing', 'awaiting-review', 'published'] },
  { name: 'transcript', type: 'textarea' }, { name: 'summary', type: 'textarea' },
  { name: 'mediaChecksum', type: 'text' }, { name: 'mediaVersion', type: 'text' },
  { name: 'approvalRevision', type: 'text' }, { name: 'processingRun', type: 'text' },
]
export const pipelineCollection = (access: AdminAccess): CollectionConfig => applyPreset({
  slug: 'pipeline-runs',
  access: { read: ({ req }) => isStaff(req.user) || req.context.pipelineMachine === true, create: ({ req }) => req.context.pipelineInternal === true && (isStaff(req.user) || req.context.pipelineMachine === true), update: ({ req }) => req.context.pipelineInternal === true && (isStaff(req.user) || req.context.pipelineMachine === true), delete: () => false },
  fields: [
    { name: 'key', type: 'text', unique: true, required: true },
    { name: 'video', type: 'relationship', relationTo: 'videos', required: true },
    { name: 'media', type: 'relationship', relationTo: 'media', required: true },
    ...['checksum', 'videoVersion', 'workflowId', 'manifestKey', 'generatedRevision', 'approvedRevision'].map(name => ({ name, type: 'text' as const })),
    { name: 'state', type: 'select', options: ['registered', 'processing', 'awaiting-review', 'approved'], required: true },
    { name: 'provider', type: 'select', options: ['deterministic-fixture'] },
    { name: 'transcript', type: 'textarea' }, { name: 'summary', type: 'textarea' },
    { name: 'chapters', type: 'json' }, { name: 'transcriptionAttempts', type: 'number' },
    { name: 'humanEdited', type: 'checkbox', defaultValue: false },
  ],
}, access)

function staff(user: User): void { if (!isStaff(user)) throw new Error('Staff authentication required') }
const maximumSummaryCharacters = 8_000
const maximumFixtureBytes = 2 * 1024 * 1024
export async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}
function scope(user?: User) { return { overrideAccess: false, user: user ?? null, context: { pipelineInternal: true, pipelineMachine: !user } } }
async function runById(payload: Payload, id: string, user?: User): Promise<Run> {
  return await payload.findByID({ collection: 'pipeline-runs', id, depth: 0, ...scope(user) }) as unknown as Run
}
export async function registerPipeline(payload: Payload, user: User, input: { videoId: string; mediaId: string; checksum: string; videoVersion: string }): Promise<Run> {
  staff(user)
  if (!/^[a-f0-9]{64}$/.test(input.checksum) || !/^[a-zA-Z0-9_-]{1,80}$/.test(input.videoVersion)) throw new Error('A SHA-256 checksum and bounded immutable videoVersion are required')
  const video = await payload.findByID({ collection: 'videos', id: input.videoId, draft: true, depth: 0, user, overrideAccess: false })
  if (video._status === 'published') throw new Error('Use a new private draft video for the experimental media pipeline')
  const media = await payload.findByID({ collection: 'media', id: input.mediaId, user, overrideAccess: false })
  if (typeof media.filesize !== 'number' || media.filesize < 1 || media.filesize > maximumFixtureBytes) throw new Error('The experimental pipeline accepts fixtures up to 2 MiB only')
  const key = await sha256(`${input.videoId}:${input.videoVersion}:${input.checksum}`)
  const existing = await payload.find({ collection: 'pipeline-runs', where: { key: { equals: key } }, limit: 1, depth: 0, ...scope(user) })
  if (existing.docs[0]) {
    const prior = existing.docs[0] as unknown as Run
    if (String(prior.media) !== String(input.mediaId) || (video.processingRun && video.processingRun !== String(prior.id))) throw new Error('Existing pipeline identity is bound to a different media record or run')
    if (!video.processingRun) await payload.update({ collection: 'videos', id: input.videoId, draft: true, user, overrideAccess: false, context: { pipelineInternal: true }, data: { processingState: 'processing', mediaChecksum: input.checksum, mediaVersion: input.videoVersion, processingRun: String(prior.id), _status: 'draft' } })
    return prior
  }
  if (video.processingRun) throw new Error('This draft already has a pipeline version; create a new version record')
  const run = await payload.create({ collection: 'pipeline-runs', depth: 0, ...scope(user), data: { key, video: input.videoId, media: input.mediaId, checksum: input.checksum, videoVersion: input.videoVersion, state: 'registered', provider: 'deterministic-fixture' } })
  await payload.update({ collection: 'videos', id: input.videoId, draft: true, user, overrideAccess: false, context: { pipelineInternal: true }, data: { processingState: 'processing', mediaChecksum: input.checksum, mediaVersion: input.videoVersion, processingRun: String(run.id), _status: 'draft' } })
  return run as unknown as Run
}
export async function startPipeline(payload: Payload, user: User, env: { MEDIA_WORKFLOW: Workflow; }, runId: string, injectFailure = false): Promise<Run> {
  staff(user)
  const run = await runById(payload, runId, user)
  if (run.state === 'awaiting-review' || run.state === 'approved') return run
  const media = await payload.findByID({ collection: 'media', id: run.media, depth: 0, user, overrideAccess: false })
  const workflowId = `media-${run.key}`
  await payload.update({ collection: 'pipeline-runs', id: run.id, ...scope(user), data: { workflowId, state: 'processing' } })
  // create() is idempotent by instance ID at the platform boundary. A prior
  // successful create followed by a lost HTTP response is recovered with get().
  try { await env.MEDIA_WORKFLOW.create({ id: workflowId, params: { runId: run.id, mediaKey: String(media.filename), checksum: run.checksum, videoVersion: run.videoVersion, injectFailure } }) }
  catch (error) {
    try { await (await env.MEDIA_WORKFLOW.get(workflowId)).status() }
    catch { throw error }
  }
  return runById(payload, run.id, user)
}

/** Caller authenticates the dedicated machine callback secret. Never expose this
 * as a public REST mutation or trust a customer-supplied processing result. */
export async function completePipeline(payload: Payload, input: PipelineOutput): Promise<Run> {
  const run = await runById(payload, input.runId)
  if (input.provider !== 'deterministic-fixture' || input.checksum !== run.checksum || input.videoVersion !== run.videoVersion) throw new Error('Processing result does not match the immutable source version')
  if (typeof input.transcript !== 'string' || !input.transcript.trim() || input.transcript.length > 100_000 || typeof input.summary !== 'string' || !input.summary.trim() || input.summary.length > maximumSummaryCharacters || !input.manifestKey || !Array.isArray(input.chapters) || !input.chapters.length || input.chapters.length > 100) throw new Error('Incomplete or oversized processing result')
  if (!Number.isSafeInteger(input.transcriptionAttempts) || input.transcriptionAttempts < 1) throw new Error('Missing durable transcription execution evidence')
  if (input.chapters.some(chapter => typeof chapter.title !== 'string' || !chapter.title.trim() || chapter.title.length > 200 || !Number.isFinite(chapter.startTime) || chapter.startTime < 0)) throw new Error('Invalid generated chapter')
  const revision = await sha256(JSON.stringify(input))
  if (run.state === 'awaiting-review' || run.state === 'approved') {
    if (run.generatedRevision !== revision && !run.humanEdited) throw new Error('Conflicting provider result; refusing to overwrite review state')
    return run // Retries cannot overwrite an editor's reviewed summary.
  }
  await payload.update({ collection: 'videos', id: run.video, draft: true, ...scope(), data: { processingState: 'awaiting-review', transcript: input.transcript, summary: input.summary, _status: 'draft' } })
  const saved = await payload.update({ collection: 'pipeline-runs', id: run.id, ...scope(), data: { ...input, state: 'awaiting-review', generatedRevision: revision } })
  return saved as unknown as Run
}
export async function editPipelineReview(payload: Payload, user: User, input: { runId: string; generatedRevision: string; summary: string }): Promise<Run> {
  staff(user)
  const run = await runById(payload, input.runId, user)
  if (run.state !== 'awaiting-review' || run.generatedRevision !== input.generatedRevision || typeof input.summary !== 'string' || !input.summary.trim() || input.summary.length > maximumSummaryCharacters) throw new Error('Stale or invalid review edit; summary must contain 1–8000 characters')
  const revision = await sha256(`${run.generatedRevision}:${input.summary}`)
  return await payload.update({ collection: 'pipeline-runs', id: run.id, ...scope(user), data: { summary: input.summary, generatedRevision: revision, humanEdited: true } }) as unknown as Run
}
export async function approvePipeline(payload: Payload, user: User, input: { runId: string; generatedRevision: string }, env: { R2: R2Bucket }): Promise<Run> {
  staff(user)
  const run = await runById(payload, input.runId, user)
  if (run.generatedRevision !== input.generatedRevision) throw new Error('Approval revision is stale')
  if (run.state === 'approved') return run
  if (run.state !== 'awaiting-review' || !run.transcript || !run.summary || !run.manifestKey) throw new Error('Processing and review must complete before approval')
  const video = await payload.findByID({ collection: 'videos', id: run.video, draft: true, depth: 0, overrideAccess: false, user })
  if (video.mediaChecksum !== run.checksum || video.mediaVersion !== run.videoVersion || video.processingRun !== String(run.id)) throw new Error('Media changed since processing')
  const media = await payload.findByID({ collection: 'media', id: run.media, depth: 0, overrideAccess: false, user })
  const object = await env.R2.get(String(media.filename))
  if (!object || object.size > maximumFixtureBytes) throw new Error('Approval requires the original bounded fixture object (maximum 2 MiB)')
  const checksum = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await object.arrayBuffer())), byte => byte.toString(16).padStart(2, '0')).join('')
  if (checksum !== run.checksum) throw new Error('R2 media bytes changed since processing; approval refused')
  // This recheck narrows accidental stale edits; it is not an atomic D1 CAS.
  // Production needs durable serialization spanning approval and media changes.
  const latestRun = await runById(payload, run.id, user)
  if (latestRun.state !== 'awaiting-review' || latestRun.generatedRevision !== input.generatedRevision) throw new Error('Review changed during approval')
  const chapterIds: string[] = []
  for (const [index, chapter] of (run.chapters as {title: string;startTime:number}[]).entries()) {
    const legacyId = `${video.id}-generated-${run.generatedRevision!.slice(0, 12)}-${index}`
    const existing = await payload.find({ collection: 'chapters', where: { legacyId: { equals: legacyId } }, limit: 1, depth: 0, overrideAccess: false, user, draft: true })
    const doc = existing.docs[0] ?? await payload.create({ collection: 'chapters', user, overrideAccess: false, data: { legacyId, slug: legacyId, title: chapter.title, startTime: chapter.startTime, _status: 'published' } })
    chapterIds.push(String(doc.id))
  }
  await payload.update({ collection: 'videos', id: run.video, user, overrideAccess: false, draft: false, context: { pipelineApproval: true }, data: { processingState: 'published', transcript: run.transcript, summary: run.summary, description: run.summary, chapters: chapterIds, approvalRevision: run.generatedRevision, _status: 'published' } })
  return await payload.update({ collection: 'pipeline-runs', id: run.id, ...scope(user), data: { state: 'approved', approvedRevision: run.generatedRevision } }) as unknown as Run
}
