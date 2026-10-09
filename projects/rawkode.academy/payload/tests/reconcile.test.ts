import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { actualFromDocuments, expectedFromSnapshot, reconcile, renderMarkdown, type ActualObject, type ReconcileInput } from '../scripts/lib/reconcile'
import { relations, type Reference } from '../src/importer'
import { buildStaticSnapshot, type StaticContentSnapshot } from '../src/static-content'

type Document = Record<string, unknown> & { id: number }

async function fixture(root: string): Promise<void> {
  const files: Record<string, string> = {
    'people/rawkode.md': '---\nname: David Flanagan\n---\nBio.\n',
    'people/guest.md': '---\nname: Guest Person\n---\nBio.\n',
    'technologies/kubernetes/index.mdx': '---\nname: Kubernetes\nlearningResources:\n  official:\n    - https://kubernetes.io/docs\n---\nOrchestrator.\n',
    'technologies/cilium/index.mdx': '---\nname: Cilium\n---\neBPF networking.\n',
    'shows/rawkode-live.md': '---\nname: Rawkode Live\nhosts:\n  - rawkode\n---\nShow.\n',
    'videos/first-video.md': [
      '---', 'id: abcdefghijklmnopqrstuvwx', 'slug: first-video', 'title: First video', 'show: rawkode-live',
      'technologies:', '  - kubernetes', '  - cilium', 'guests:', '  - guest',
      'chapters:', '  - title: Intro', '    startTime: 0', '  - title: Demo', '    startTime: 60', '  - title: Outro', '    startTime: 120',
      '---', 'Video body.', '',
    ].join('\n'),
    'articles/hello/index.mdx': '---\ntitle: Hello\nauthors:\n  - rawkode\ncover:\n  image: ./cover.png\n  alt: Cover\n---\nArticle body.\n',
  }
  for (const [relative, contents] of Object.entries(files)) {
    await mkdir(path.dirname(path.join(root, relative)), { recursive: true })
    await writeFile(path.join(root, relative), contents)
  }
  await writeFile(path.join(root, 'articles/hello/cover.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]))
}

/** What a complete, correct import leaves in Payload and R2. */
async function simulateImport(snapshot: StaticContentSnapshot): Promise<{ documents: Record<string, Document[]>; objects: ActualObject[] }> {
  const expected = await expectedFromSnapshot(snapshot)
  const ids = new Map<string, number>()
  snapshot.records.forEach((record, index) => ids.set(`${record.collection}:${record.legacyId}`, index + 1))
  const documents: Record<string, Document[]> = {}
  snapshot.records.forEach((record, index) => {
    const rules = relations[record.collection] ?? {}
    const doc: Document = {
      id: index + 1, legacyId: record.legacyId, slug: record.slug, sourceSystem: snapshot.sourceSystem, sourceRevision: record.sourceRevision,
      sourceHash: expected.records[index]!.sourceHash, sourceSequence: snapshot.sequence, importState: 'complete', locallyEdited: false, tombstone: false,
    }
    // static-assets has versions.drafts false, so Payload stores no _status.
    if (record.collection !== 'static-assets') doc._status = record.status ?? 'draft'
    for (const field of Object.keys(rules)) {
      const value = record.relationships?.[field]
      const refs = value === null || value === undefined ? [] : Array.isArray(value) ? value : [value]
      const mapped = refs.map((ref: Reference) => ids.get(`${ref.collection}:${ref.legacyId}`)!)
      doc[field] = rules[field]!.many ? mapped : mapped[0] ?? null
    }
    ;(documents[record.collection] ??= []).push(doc)
  })
  const objects = snapshot.assetFiles.map(asset => ({ key: asset.r2Key, size: asset.bytes, checksum: asset.checksum }))
  return { documents, objects }
}

test('reconciliation reports zero diffs after a complete import and detects each injected drift', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'reconcile-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  await fixture(root)
  const snapshot = await buildStaticSnapshot({ root, sequence: 42 })
  const expected = await expectedFromSnapshot(snapshot)
  const baseline = await simulateImport(snapshot)
  assert.ok(snapshot.assetFiles.length >= 1)
  assert.ok(snapshot.records.some(record => record.collection === 'chapters'))
  assert.ok(snapshot.records.some(record => record.collection === 'episodes'))
  assert.ok(snapshot.records.some(record => record.collection === 'learning-resources'))

  const run = (mutate: (state: { documents: Record<string, Document[]>; objects: ActualObject[] }) => void = () => {}) => {
    const state = structuredClone(baseline)
    mutate(state)
    const input: ReconcileInput = {
      target: 'local', gitSha: 'fixture', sequence: snapshot.sequence, mappingVersion: snapshot.mappingVersion, sourceSystem: snapshot.sourceSystem,
      expected, actual: { records: actualFromDocuments(state.documents), objects: state.objects }, generatedAt: '2026-10-09T00:00:00.000Z',
    }
    return reconcile(input)
  }
  const find = (documents: Record<string, Document[]>, collection: string, legacyId: string) => {
    const doc = documents[collection]?.find(candidate => candidate.legacyId === legacyId)
    assert.ok(doc, `${collection}:${legacyId}`)
    return doc
  }
  const kinds = (report: ReturnType<typeof run>) => report.diffs.map(diff => diff.kind)

  const clean = run()
  assert.equal(clean.ok, true, JSON.stringify(clean.diffs, null, 2))
  assert.deepEqual(clean.diffs, [])
  assert.deepEqual(clean.collections.videos, { expected: 1, actual: 1 })
  assert.deepEqual(clean.collections.chapters, { expected: 3, actual: 3 })
  assert.equal(clean.assets.orphans, 0)
  assert.match(renderMarkdown(clean), /PASS, 0 diffs/)

  const slug = run(({ documents }) => { find(documents, 'people', 'guest').slug = 'renamed' })
  assert.deepEqual(kinds(slug), ['slug'])
  assert.deepEqual(slug.diffs[0], { kind: 'slug', collection: 'people', legacyId: 'guest', expected: 'guest', actual: 'renamed' })

  const chapterOrder = run(({ documents }) => {
    const video = find(documents, 'videos', 'abcdefghijklmnopqrstuvwx')
    video.chapters = [...(video.chapters as number[])].reverse()
  })
  assert.deepEqual(kinds(chapterOrder), ['edges'])
  assert.equal(chapterOrder.diffs[0]?.field, 'chapters')

  const technologyOrder = run(({ documents }) => {
    const video = find(documents, 'videos', 'abcdefghijklmnopqrstuvwx')
    video.technologies = [...(video.technologies as number[])].reverse()
  })
  assert.deepEqual(technologyOrder.diffs.map(diff => [diff.kind, diff.field]), [['edges', 'technologies']])
  assert.deepEqual(technologyOrder.diffs[0]?.expected, ['technologies:kubernetes', 'technologies:cilium'])

  const droppedEdge = run(({ documents }) => { find(documents, 'videos', 'abcdefghijklmnopqrstuvwx').show = null })
  assert.deepEqual(droppedEdge.diffs.map(diff => [diff.kind, diff.field]), [['edges', 'show']])

  const hash = run(({ documents }) => {
    const doc = find(documents, 'articles', 'hello')
    doc.sourceHash = 'f'.repeat(64)
    doc.sourceRevision = 'e'.repeat(64)
  })
  assert.deepEqual(kinds(hash).sort(), ['sourceHash', 'sourceRevision'])

  const asset = snapshot.assetFiles[0]!
  const checksum = run(({ objects }) => { objects.find(object => object.key === asset.r2Key)!.checksum = '0'.repeat(64) })
  assert.deepEqual(kinds(checksum), ['asset-checksum'])
  const size = run(({ objects }) => { objects.find(object => object.key === asset.r2Key)!.size += 1 })
  assert.deepEqual(kinds(size), ['asset-size'])
  const missingAsset = run(state => { state.objects = state.objects.filter(object => object.key !== asset.r2Key) })
  assert.deepEqual(kinds(missingAsset), ['asset-missing'])

  const extra = run(({ documents }) => { documents.people!.push({ ...find(documents, 'people', 'guest'), id: 9_999, legacyId: 'not-in-content', slug: 'not-in-content' }) })
  assert.deepEqual(kinds(extra), ['extra'])
  assert.equal(extra.diffs[0]?.legacyId, 'not-in-content')
  assert.deepEqual(extra.collections.people, { expected: 2, actual: 3 })

  const editorCreated = run(({ documents }) => { documents.people!.push({ id: 10_000, name: 'Created in admin' }) })
  assert.deepEqual(kinds(editorCreated), ['extra'])

  // Orphaned static/ objects fail the report by default.
  const superseded = { key: `static/${'0'.repeat(16)}/${asset.relativePath}`, size: 3, checksum: '1'.repeat(64) }
  const orphan = run(({ objects }) => { objects.push(superseded) })
  assert.equal(orphan.ok, false)
  assert.equal(orphan.strictOrphans, true)
  assert.deepEqual(kinds(orphan), ['orphan-object'])
  assert.equal(orphan.assets.orphans, 1)
  assert.match(renderMarkdown(orphan), /FAIL, 1 diffs[\s\S]*orphan-object/)
  // A re-import after a changed asset leaves the old content-addressed object
  // behind; --allow-orphans lists it without failing.
  const allowed = reconcile({
    target: 'local', gitSha: 'fixture', sequence: snapshot.sequence, mappingVersion: snapshot.mappingVersion, sourceSystem: snapshot.sourceSystem,
    expected, actual: { records: actualFromDocuments(baseline.documents), objects: [...baseline.objects, superseded] }, strictOrphans: false,
  })
  assert.equal(allowed.ok, true)
  assert.deepEqual(allowed.diffs, [])
  assert.deepEqual(allowed.orphanObjects, [superseded])
  assert.match(renderMarkdown(allowed), /PASS, 0 diffs[\s\S]*Orphaned objects \(not failing\)[\s\S]*0000000000000000/)
  const outsidePrefix = run(({ objects }) => { objects.push({ key: 'media/upload.png', size: 3, checksum: null }) })
  assert.equal(outsidePrefix.ok, true)

  const missing = run(({ documents }) => { documents.shows = [] })
  assert.ok(kinds(missing).includes('missing'))
  // The episode and video edges now point at a show the target does not hold.
  assert.ok(missing.diffs.some(diff => diff.kind === 'edges' && diff.field === 'show'))

  const state = run(({ documents }) => {
    const doc = find(documents, 'people', 'rawkode')
    doc.locallyEdited = true
    doc.importState = 'pending'
    doc._status = 'draft'
    doc.sourceSequence = 41
  })
  assert.deepEqual(kinds(state).sort(), ['importState', 'locallyEdited', 'sourceSequence', 'status'])

  const markdown = renderMarkdown(state)
  assert.match(markdown, /FAIL, 4 diffs/)
  assert.match(markdown, /\| locallyEdited \| people:rawkode \|/)
})
