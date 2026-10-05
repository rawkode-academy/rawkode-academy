import type { ProbeResult } from './intake-contracts'
import type { AudioManifest } from './processing-providers'
import { ReviewError } from './contracts'
import { ProcessingJobs, validateEvidence } from './processing-jobs'
import { validateAudio, joinTranscript, type FFmpegBoundary, type WorkersWhisper } from './processing-providers'
import { verifyStored } from './intake-storage'

export interface DurableSteps { do<T extends Rpc.Serializable<T>>(name: string, callback: () => Promise<T>): Promise<T> }
/** Only job identity crosses the Workflow boundary. All source keys, limits and
 * recipe policy are loaded from the immutable D1 admission record. */
export async function runReviewProcessing(id: string, jobs: ProcessingJobs, container: FFmpegBoundary, whisper: Pick<WorkersWhisper, 'transcribe'>, step: DurableSteps) {
  const { job, result } = await jobs.load(id)
  if (result) return { jobId: id, state: 'complete' }
  const live = async () => {
    await jobs.load(id) // Never memoize cancellation/deadline authorization.
    await verifyStored(jobs.bucket, job.source, 'application/octet-stream')
  }
  const [encoding, audioText] = await Promise.all([
    step.do<ProbeResult>('encode and full-decode probe', async () => {
      await live()
      return validateEvidence(jobs.bucket, job, await container.encode(job))
    }),
    (async () => {
      const audio = await step.do<AudioManifest>('extract bounded audio chunks', async () => {
        await live()
        return validateAudio(job, await container.extractAudio(job))
      })
      const texts: string[] = []
      // One AI request at a time; encoding runs independently in parallel.
      for (const chunk of audio.chunks) {
        texts.push(await step.do<string>(`whisper chunk ${chunk.index}`, async () => { await live(); return whisper.transcribe(chunk) }))
        joinTranscript(job, texts) // Enforce total limit as the text grows.
      }
      return { audio, transcription: joinTranscript(job, texts) }
    })(),
  ])
  if ((encoding.deliverable.audioCodec === 'none') !== audioText.audio.noAudio || Math.abs(encoding.deliverable.durationMs - audioText.audio.durationMs) > 250) throw new ReviewError(409, 'Encoded media and extracted audio disagree')
  await step.do<{ jobId: string }>('persist verified completion', async () => {
    await live()
    await jobs.complete(job, { ...encoding, transcription: audioText.transcription })
    return { jobId: id }
  })
  return { jobId: id, state: 'complete' }
}
