import { ReviewError } from './contracts'
import type { StoredObject } from './intake-contracts'
import { fixedLengthStream, uploadImmutable, verifyStored, type LengthStream } from './intake-storage'
import { ArtifactFrames, validateReport, type ContainerReport, type Operation } from './container-frames'
import { validateEvidence, type ProcessingJob } from './processing-jobs'
import { validateAudio } from './processing-providers'

type Storage = Pick<DurableObjectStorage, 'get' | 'put'>
type Dependencies = { storage: Storage; bucket: R2Bucket; live: (job: ProcessingJob) => Promise<void>; invoke: (operation: Operation, job: ProcessingJob) => Promise<Response>; lengthStream?: LengthStream }
export type ContainerReceipt = Awaited<ReturnType<typeof validateEvidence>> | ReturnType<typeof validateAudio>
function resultFor(report: ContainerReport, job: ProcessingJob, objects: StoredObject[]): ContainerReceipt {
  if (report.operation === 'encode') return { jobId: job.jobId, recipe: job.recipe, source: { ...job.source, contentType: report.source.contentType }, deliverable: { ...objects[0], contentType: 'video/mp4', durationMs: report.durationMs, videoCodec: report.videoCodec, audioCodec: report.audioCodec, width: report.width, height: report.height, fastStart: report.fastStart, fullDecode: report.fullDecode } }
  return validateAudio(job, { jobId: job.jobId, recipe: job.recipe, source: job.source, durationMs: report.durationMs, noAudio: report.noAudio, chunks: objects.map((object, index) => ({ ...object, index, startMs: report.artifacts[index].startMs, durationMs: report.artifacts[index].durationMs, contentType: 'audio/wav', codec: 'pcm_s16le', sampleRate: 16000, channels: 1 })) })
}
/** One instance per DO. The promise is installed synchronously, before any I/O,
 * so duplicate requests coalesce across await points without locking FFmpeg. */
export class ContainerBridge {
  private identity?: string
  private work?: Promise<ContainerReceipt>
  constructor(readonly dependencies: Dependencies) {}
  run(operation: Operation, job: ProcessingJob) {
    const identity = JSON.stringify({ operation, job })
    if (this.identity && this.identity !== identity) return Promise.reject(new ReviewError(409, 'Container identity is already bound'))
    this.identity = identity
    if (!this.work) this.work = this.execute(operation, job, identity).finally(() => { this.work = undefined })
    return this.work
  }
  private async verify(job: ProcessingJob, receipt: ContainerReceipt) {
    if ('deliverable' in receipt) return validateEvidence(this.dependencies.bucket, job, receipt)
    const audio = validateAudio(job, receipt)
    await Promise.all(audio.chunks.map(chunk => verifyStored(this.dependencies.bucket, chunk, 'audio/wav')))
    return audio
  }
  private async execute(operation: Operation, job: ProcessingJob, identity: string) {
    const { storage, bucket, live, invoke } = this.dependencies
    await live(job)
    const savedIdentity = await storage.get<string>('identity')
    if (savedIdentity && savedIdentity !== identity) throw new ReviewError(409, 'Persisted Container identity does not match')
    if (!savedIdentity) await storage.put('identity', identity)
    const receipt = await storage.get<ContainerReceipt>('receipt')
    if (receipt) { const verified = await this.verify(job, receipt); await live(job); return verified }
    const response = await invoke(operation, job)
    if (!response.ok || response.headers.get('content-type') !== 'application/vnd.rawkode.review-artifacts' || !response.body) { await response.body?.cancel(); throw new ReviewError(502, 'Container failed to produce artifacts') }
    const frames = new ArtifactFrames(response.body)
    try {
      const report = validateReport(await frames.report(), job, operation), plan = JSON.stringify(report)
      const expected = await storage.get<string>('plan')
      if (expected && expected !== plan) throw new ReviewError(409, 'Container retry produced different artifacts')
      await live(job)
      // Save expected digests BEFORE any object upload. Crashes resume only an
      // identical plan, with conditional writes and verification of prior objects.
      if (!expected) await storage.put('plan', plan)
      const objects: StoredObject[] = []
      for (const artifact of report.artifacts) {
        await live(job)
        objects.push(await uploadImmutable(bucket, operation === 'encode' ? job.outputKey : `review-intake/${job.jobId}/audio/${artifact.index}.wav`, frames.artifact(artifact.bytes), artifact.bytes, artifact.checksum, operation === 'encode' ? 'video/mp4' : 'audio/wav', this.dependencies.lengthStream ?? fixedLengthStream))
      }
      await frames.finish()
      const result = await this.verify(job, resultFor(report, job, objects))
      await live(job)
      await storage.put('receipt', result)
      await live(job)
      return result
    } catch (error) { await frames.cancel(); throw error }
  }
}
