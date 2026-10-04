import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from 'cloudflare:workers'

export type MediaWorkflowParams = { runId: string | number; mediaKey: string; checksum: string; videoVersion: string; injectFailure?: boolean }
type Env = { R2: R2Bucket; WORKER_SELF_REFERENCE: Fetcher; PIPELINE_CALLBACK_SECRET: string }
async function digest(bytes: ArrayBuffer): Promise<string> {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), byte => byte.toString(16).padStart(2, '0')).join('')
}

/** Actual Cloudflare Workflows orchestration with deliberately fake providers.
 * No Workers AI, ffmpeg, Container, or third-party API executes in this POC.
 * Production adapters must implement chunked audio transcription and ffmpeg
 * probe/encode against R2. A JSON fixture manifest is NOT playable encoding.
 */
export class MediaWorkflow extends WorkflowEntrypoint<Env, MediaWorkflowParams> {
  async run(event: WorkflowEvent<MediaWorkflowParams>, step: WorkflowStep) {
    const input = event.payload
    // Artifacts and execution evidence belong to this run. Identical source
    // bytes/version labels on a different video must not reuse failure markers.
    const prefix = `pipeline/${event.instanceId}/run-${input.runId}/${input.checksum}`
    await step.do('verify immutable uploaded bytes', async () => {
      const object = await this.env.R2.get(input.mediaKey)
      if (!object || await digest(await object.arrayBuffer()) !== input.checksum) throw new Error('Uploaded R2 bytes do not match the registered checksum')
      return { checksum: input.checksum, size: object.size }
    })
    const [transcription, encoding] = await Promise.all([
      step.do('fixture transcription adapter', { retries: { limit: 2, delay: '1 second', backoff: 'constant' } }, async () => {
        const markerKey = `${prefix}/transcription-executions.json`
        const previous = await this.env.R2.get(markerKey)
        const marker = previous ? await previous.json<{ attempts: number; injectedFailure: boolean }>() : { attempts: 0, injectedFailure: false }
        const attempts = marker.attempts + 1
        const failThisAttempt = Boolean(input.injectFailure && !marker.injectedFailure)
        await this.env.R2.put(markerKey, JSON.stringify({ experimental: true, workflowId: event.instanceId, runId: input.runId, attempts, injectedFailure: marker.injectedFailure || failThisAttempt }))
        if (failThisAttempt) {
          throw new Error('Intentional fixture transcription failure; Workflows should retry this step')
        }
        const result = { provider: 'deterministic-fixture', transcript: 'Synthetic local media fixture. This text is deterministic and was not transcribed from audio by an AI model.', attempts }
        await this.env.R2.put(`${prefix}/transcript.json`, JSON.stringify(result))
        return result
      }),
      step.do('fixture encoding adapter', async () => {
        const manifestKey = `${prefix}/encoding.json`
        await this.env.R2.put(manifestKey, JSON.stringify({ experimental: true, provider: 'deterministic-fixture', encoded: false, playable: false, sourceKey: input.mediaKey, checksum: input.checksum, note: 'Container ffmpeg adapter intentionally not executed' }))
        return { manifestKey }
      }),
    ])
    const result = await step.do('join and fixture editorial enrichment', async () => ({
      runId: input.runId, checksum: input.checksum, videoVersion: input.videoVersion,
      provider: 'deterministic-fixture' as const, transcript: transcription.transcript,
      summary: 'Synthetic demonstration of upload, retryable fork/join processing, and an explicit human publishing gate.',
      chapters: [{ title: 'Synthetic fixture introduction', startTime: 0 }],
      manifestKey: encoding.manifestKey, transcriptionAttempts: transcription.attempts,
    }))
    await step.do('deliver idempotent private review result', { retries: { limit: 3, delay: '1 second', backoff: 'constant' } }, async () => {
      if (!this.env.PIPELINE_CALLBACK_SECRET) throw new Error('Dedicated machine callback secret is missing')
      const response = await this.env.WORKER_SELF_REFERENCE.fetch('https://pipeline.internal/api/poc/pipeline/callback', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${this.env.PIPELINE_CALLBACK_SECRET}` }, body: JSON.stringify(result) })
      if (!response.ok) throw new Error(`Pipeline callback failed: ${response.status}`)
      return { delivered: true }
    })
    return { runId: input.runId, state: 'awaiting-review', provider: 'deterministic-fixture' }
  }
}
