import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import test from 'node:test'
import { ContainerBridge } from '../src/review/container-bridge'
import { ArtifactFrames, type ContainerReport, type Operation } from '../src/review/container-frames'
import { ReviewError } from '../src/review/contracts'
import { hex, type LengthStream } from '../src/review/intake-storage'
import { audioPolicy, type ProcessingJob } from '../src/review/processing-jobs'
import { configuredMediaAdapter, mediaRecipe, type MediaRuntime } from '../src/review/processing-runtime'
import { ReviewStore } from '../src/review/store'
import { WorkflowMediaAdapter } from '../src/review/workflow-adapter'

// Protocol fixtures are deliberately not playable media. The separate runner
// suite invokes real FFmpeg; these tests exercise storage, framing and fencing.
const bytes = (value: string) => new TextEncoder().encode(value)
const checksum = (value: Uint8Array) => createHash('sha256').update(value).digest('hex')
const body = (value: Uint8Array) => new Blob([value as BlobPart]).stream()
const lengthStream: LengthStream = size => {
  let seen = 0
  return new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) { seen += chunk.length; if (seen > size) throw Error('long stream'); controller.enqueue(chunk) },
    flush() { if (seen !== size) throw Error('short stream') },
  })
}
function fakeBucket() {
  const objects = new Map<string, { bytes: Uint8Array; head: R2Object }>(), writes: string[] = []
  let afterWrite: (key: string) => void = () => {}
  function seed(key: string, value: Uint8Array, contentType: string) {
    const hash = createHash('sha256').update(value).digest(), etag = hash.toString('hex').slice(0, 32)
    const head = { key, size: value.length, etag, httpEtag: `"${etag}"`, checksums: { sha256: Uint8Array.from(hash).buffer }, httpMetadata: { contentType } } as R2Object
    objects.set(key, { bytes: value.slice(), head }); return head
  }
  const bucket = {
    async head(key: string) { return objects.get(key)?.head ?? null },
    async put(key: string, stream: ReadableStream<Uint8Array>, options: R2PutOptions) {
      assert.ok(stream instanceof ReadableStream)
      assert.deepEqual(options.onlyIf, { etagDoesNotMatch: '*' })
      if (objects.has(key)) return null
      const value = new Uint8Array(await new Response(stream).arrayBuffer())
      assert.equal(checksum(value), options.sha256, 'fake R2 independently validates actual bytes')
      const head = seed(key, value, (options.httpMetadata as R2HTTPMetadata).contentType!)
      writes.push(key); afterWrite(key); return head
    },
  } as unknown as R2Bucket
  return { bucket, objects, writes, seed, afterWrite: (fn: typeof afterWrite) => { afterWrite = fn } }
}
function storage() {
  const data = new Map<string, unknown>()
  let afterPut: (key: string) => void = () => {}
  const binding = {
    async get(key: string) { return structuredClone(data.get(key)) },
    async put(key: string, value: unknown) { data.set(key, structuredClone(value)); afterPut(key) },
  } as unknown as Pick<DurableObjectStorage, 'get' | 'put'>
  return { binding, data, afterPut: (fn: typeof afterPut) => { afterPut = fn } }
}
function framed(report: unknown, artifacts: Uint8Array[]) {
  const json = Buffer.from(JSON.stringify(report)), prefix = Buffer.alloc(4)
  prefix.writeUInt32BE(json.length)
  return new Uint8Array(Buffer.concat([prefix, json, ...artifacts]))
}
function fragmented(value: Uint8Array, partSize = 7) {
  let at = 0
  return new ReadableStream<Uint8Array>({ pull(controller) {
    if (at >= value.length) { controller.close(); return }
    controller.enqueue(value.subarray(at, at + partSize)); at += partSize
  } })
}
function harness(operation: Operation = 'encode') {
  const r2 = fakeBucket(), saved = storage(), jobId = crypto.randomUUID(), source = bytes('private source fixture')
  const sourceKey = `review-intake/${jobId}/source`, head = r2.seed(sourceKey, source, 'application/octet-stream')
  const job: ProcessingJob = { jobId, videoId: 1, recipe: mediaRecipe, source: { key: sourceKey, etag: head.etag, checksum: checksum(source), bytes: source.length }, contentType: 'video/mp4', outputKey: `review-intake/${jobId}/deliverable.mp4`, maximumBytes: 67108864, maximumDurationMs: 7200000, audioPolicy, startedAt: 1000, deadline: 87400, expectedCurrentRevisionId: null }
  const files = operation === 'encode' ? [bytes('encoded fixture')] : [bytes('audio zero'), bytes('audio one'), bytes('audio two')]
  const common = { protocol: 1 as const, jobId, recipe: job.recipe, source: { contentType: job.contentType } }
  let report: ContainerReport = operation === 'encode' ? {
    ...common, operation, durationMs: 10000, videoCodec: 'h264', audioCodec: 'aac', width: 1280, height: 720, fastStart: true, fullDecode: true,
    artifacts: [{ kind: 'deliverable', index: 0, bytes: files[0].length, checksum: checksum(files[0]) }],
  } : {
    ...common, operation, durationMs: 180000, noAudio: false,
    artifacts: files.map((value, index) => ({ kind: 'audio', index, startMs: index * 60000, durationMs: 60000, bytes: value.length, checksum: checksum(value) })),
  }
  let cancelled = false, invocations = 0, wire: (() => Uint8Array) | undefined, gate: Promise<void> | undefined
  const dependencies = {
    bucket: r2.bucket, storage: saved.binding, lengthStream,
    async live(candidate: ProcessingJob) { assert.deepEqual(candidate, job); if (cancelled) throw new ReviewError(409, 'cancelled') },
    async invoke() {
      invocations++; await gate
      return new Response(fragmented(wire?.() ?? framed(report, files)), { headers: { 'content-type': 'application/vnd.rawkode.review-artifacts' } })
    },
  }
  const bridge = () => new ContainerBridge(dependencies)
  return { r2, saved, job, files, bridge, dependencies, operation, report: () => report, setReport: (next: ContainerReport) => { report = next }, setWire: (next: typeof wire) => { wire = next }, setGate: (next: Promise<void>) => { gate = next }, cancel: () => { cancelled = true }, invocations: () => invocations }
}

test('concurrent requests coalesce before any I/O and retain one immutable receipt', async () => {
  const h = harness(), bridge = h.bridge()
  let release!: () => void; h.setGate(new Promise(resolve => { release = resolve }))
  const first = bridge.run('encode', h.job), second = bridge.run('encode', h.job)
  assert.equal(first, second); release()
  const [a, b] = await Promise.all([first, second])
  assert.deepEqual(a, b); assert.equal(h.invocations(), 1); assert.deepEqual(h.r2.writes, [h.job.outputKey])
  assert.deepEqual(await h.bridge().run('encode', h.job), a); assert.equal(h.invocations(), 1)
})
test('crashes after every audio object write recover the identical plan without overwrites', async t => {
  for (const index of [0, 1, 2]) await t.test(`artifact ${index}`, async () => {
    const h = harness('audio'), key = `review-intake/${h.job.jobId}/audio/${index}.wav`
    h.r2.afterWrite(written => { if (written === key) throw Error('lost R2 response') })
    await assert.rejects(h.bridge().run('audio', h.job), { status: 400 })
    assert.ok(h.saved.data.has('plan')); assert.equal(h.saved.data.has('receipt'), false)
    assert.equal(h.r2.writes.length, index + 1)
    h.r2.afterWrite(() => {})
    const receipt = await h.bridge().run('audio', h.job)
    assert.ok('chunks' in receipt); assert.equal(receipt.chunks.length, 3)
    assert.equal(h.r2.writes.length, 3); assert.equal(new Set(h.r2.writes).size, 3)
    for (const chunk of receipt.chunks) {
      const object = h.r2.objects.get(chunk.key)!
      assert.equal(chunk.bytes, object.bytes.length); assert.equal(chunk.checksum, checksum(object.bytes))
      assert.equal(hex(object.head.checksums.sha256), chunk.checksum)
    }
  })
})
test('an interrupted plan rejects changed artifact evidence before any new write', async () => {
  const h = harness('audio')
  h.r2.afterWrite(() => { throw Error('crash') })
  await assert.rejects(h.bridge().run('audio', h.job))
  h.r2.afterWrite(() => {})
  const changed = structuredClone(h.report()); changed.artifacts[1].checksum = 'b'.repeat(64); h.setReport(changed)
  await assert.rejects(h.bridge().run('audio', h.job), /different artifacts/)
  assert.equal(h.r2.writes.length, 1); assert.equal(h.saved.data.has('receipt'), false)
})
test('a lost receipt write response recovers from durable storage without rerunning FFmpeg', async () => {
  const h = harness()
  h.saved.afterPut(key => { if (key === 'receipt') throw Error('lost acknowledgement') })
  await assert.rejects(h.bridge().run('encode', h.job), /lost acknowledgement/)
  assert.ok(h.saved.data.has('receipt'))
  h.saved.afterPut(() => {})
  const receipt = await h.bridge().run('encode', h.job)
  assert.deepEqual(receipt, h.saved.data.get('receipt')); assert.equal(h.invocations(), 1); assert.equal(h.r2.writes.length, 1)
})
test('cancellation fences cached receipts, in-flight uploads and receipt persistence', async t => {
  await t.test('cached receipt', async () => {
    const h = harness(); await h.bridge().run('encode', h.job); h.cancel()
    await assert.rejects(h.bridge().run('encode', h.job), /cancelled/); assert.equal(h.invocations(), 1)
  })
  await t.test('during artifact write', async () => {
    const h = harness('audio'); h.r2.afterWrite(() => h.cancel())
    await assert.rejects(h.bridge().run('audio', h.job), /cancelled/)
    assert.equal(h.saved.data.has('receipt'), false); assert.equal(h.r2.writes.length, 1)
  })
  await t.test('after receipt storage', async () => {
    const h = harness(); h.saved.afterPut(key => { if (key === 'receipt') h.cancel() })
    await assert.rejects(h.bridge().run('encode', h.job), /cancelled/)
    await assert.rejects(h.bridge().run('encode', h.job), /cancelled/); assert.equal(h.invocations(), 1)
  })
})
test('one Container identity cannot be reused for another operation or job', async () => {
  const h = harness(), bridge = h.bridge(); await bridge.run('encode', h.job)
  await assert.rejects(bridge.run('audio', h.job), /identity is already bound/)
  await assert.rejects(h.bridge().run('audio', h.job), /Persisted Container identity/)
  h.dependencies.live = async () => {}
  const changed = { ...h.job, recipe: 'c'.repeat(64) }
  await assert.rejects(h.bridge().run('encode', changed), /Persisted Container identity/)
})
test('cached deliverables recheck source and output SHA/size/content type', async t => {
  for (const target of ['source', 'deliverable'] as const) for (const field of ['checksum', 'size', 'contentType'] as const) await t.test(`${target} ${field}`, async () => {
    const h = harness(); await h.bridge().run('encode', h.job)
    const head = h.r2.objects.get(target === 'source' ? h.job.source.key : h.job.outputKey)!.head
    if (field === 'checksum') Object.assign(head.checksums, { sha256: new Uint8Array(32).buffer })
    if (field === 'size') Object.assign(head, { size: head.size + 1 })
    if (field === 'contentType') head.httpMetadata!.contentType = 'application/x-wrong'
    await assert.rejects(h.bridge().run('encode', h.job), /integrity evidence/)
    assert.equal(h.invocations(), 1)
  })
})
test('wrong job, recipe, MIME, codec, evidence and output limits are rejected before R2 writes', async t => {
  const mutations: [string, (report: any) => void][] = [
    ['job', r => { r.jobId = crypto.randomUUID() }], ['recipe', r => { r.recipe = '0'.repeat(64) }],
    ['MIME', r => { r.source.contentType = 'video/webm' }], ['codec', r => { r.videoCodec = 'vp9' }],
    ['decode', r => { r.fullDecode = false }], ['fast start', r => { r.fastStart = false }],
    ['size', r => { r.artifacts[0].bytes = 67108865 }], ['duration', r => { r.durationMs = 7200001 }],
    ['client key', r => { r.artifacts[0].key = 'arbitrary/path' }], ['extra artifact', r => { r.artifacts.push(r.artifacts[0]) }],
  ]
  for (const [name, mutate] of mutations) await t.test(name, async () => {
    const h = harness(), changed = structuredClone(h.report()); mutate(changed); h.setWire(() => framed(changed, h.files))
    await assert.rejects(h.bridge().run('encode', h.job))
    assert.equal(h.r2.writes.length, 0); assert.equal(h.saved.data.has('receipt'), false)
  })
})
test('truncated, oversized, invalid and extra framing can never produce a receipt', async t => {
  const cases: [string, (report: ContainerReport, files: Uint8Array[]) => Uint8Array][] = [
    ['short prefix', () => new Uint8Array([0, 0])],
    ['oversized JSON', () => new Uint8Array([0, 1, 0, 1])],
    ['invalid JSON', () => new Uint8Array([0, 0, 0, 2, 123, 123])],
    ['invalid UTF8', () => new Uint8Array([0, 0, 0, 2, 195, 195])],
    ['truncated artifact', (report, files) => framed(report, files).slice(0, -1)],
    ['extra byte', (report, files) => new Uint8Array([...framed(report, files), 1])],
    ['wrong artifact digest', (report, files) => framed(report, [new Uint8Array(files[0].length)])],
  ]
  for (const [name, wire] of cases) await t.test(name, async () => {
    const h = harness(); h.setWire(() => wire(h.report(), h.files))
    await assert.rejects(h.bridge().run('encode', h.job)); assert.equal(h.saved.data.has('receipt'), false)
  })
})
test('audio coverage, chunk order and chunk byte limits are strict', async t => {
  for (const [name, mutate] of [
    ['gap', (r: any) => { r.artifacts[1].startMs++ }], ['order', (r: any) => { r.artifacts[1].index = 0 }],
    ['chunk size', (r: any) => { r.artifacts[0].bytes = 2097153 }], ['false silence', (r: any) => { r.noAudio = true }],
    ['incomplete coverage', (r: any) => { r.artifacts.pop() }],
  ] as const) await t.test(name, async () => {
    const h = harness('audio'), changed = structuredClone(h.report()); mutate(changed); h.setWire(() => framed(changed, h.files))
    await assert.rejects(h.bridge().run('audio', h.job)); assert.equal(h.r2.writes.length, 0)
  })
})
test('an artifact cancellation drains precisely its frame and preserves the next one', async () => {
  const first = bytes('one'), second = bytes('second'), frames = new ArtifactFrames(fragmented(framed({ protocol: 1 }, [first, second]), 1))
  assert.deepEqual(await frames.report(), { protocol: 1 })
  await frames.artifact(first.length).cancel()
  assert.equal(await new Response(frames.artifact(second.length)).text(), 'second')
  await frames.finish()
})
test('request-worker activation requires the Workflow binding, baked recipe and store', () => {
  const store = new ReviewStore({} as D1Database)
  const env = { D1: {} as D1Database, R2: {} as R2Bucket, AI: {} as Ai, REVIEW_FFMPEG: {} as DurableObjectNamespace, REVIEW_MEDIA_WORKFLOW: {} as MediaRuntime['REVIEW_MEDIA_WORKFLOW'], REVIEW_MEDIA_RECIPE: mediaRecipe }
  assert.equal(configuredMediaAdapter(), undefined); assert.equal(configuredMediaAdapter(env), undefined)
  for (const name of ['REVIEW_MEDIA_WORKFLOW', 'REVIEW_MEDIA_RECIPE'] as const) assert.equal(configuredMediaAdapter({ ...env, [name]: undefined }, store), undefined)
  assert.ok(configuredMediaAdapter({ ...env, AI: undefined, REVIEW_FFMPEG: undefined }, store))
  assert.equal(configuredMediaAdapter({ ...env, REVIEW_MEDIA_RECIPE: 'different recipe' }, store), undefined)
  const adapter = configuredMediaAdapter(env, store)
  assert.ok(adapter instanceof WorkflowMediaAdapter); assert.equal(adapter.recipe, mediaRecipe)
})
