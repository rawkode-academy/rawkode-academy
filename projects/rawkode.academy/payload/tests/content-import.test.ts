import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { buildKlusteredSnapshot } from '../src/klustered-content'
import { buildStaticSnapshot } from '../src/static-content'

const repositoryRoot = path.resolve(process.cwd(), '../../..')

test('static content preserves public article routes without publishing draft courses or modules', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'static-publication-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const fixtures = [
    { collection: 'articles', directory: 'articles', draft: true, status: 'published' },
    { collection: 'articles', directory: 'articles', draft: false, status: 'published' },
    { collection: 'articles', directory: 'articles', draft: undefined, status: 'published' },
    { collection: 'courses', directory: 'courses', draft: true, status: 'draft' },
    { collection: 'courses', directory: 'courses', draft: false, status: 'published' },
    { collection: 'course-modules', directory: 'courses/example', draft: true, status: 'draft' },
    { collection: 'course-modules', directory: 'courses/example', draft: false, status: 'published' },
  ] as const
  for (const fixture of fixtures) {
    const directory = path.join(root, fixture.directory)
    await mkdir(directory, { recursive: true })
    const frontmatter = fixture.draft === undefined ? '' : `draft: ${fixture.draft}\n`
    await writeFile(path.join(directory, `${fixture.draft ?? 'unspecified'}.mdx`), `---\ntitle: Publication fixture\n${frontmatter}---\nFixture body.\n`)
  }

  const snapshot = await buildStaticSnapshot({ root, sequence: 1 })
  assert.equal(snapshot.records.length, fixtures.length)
  for (const fixture of fixtures) {
    const sourcePath = `${fixture.directory}/${fixture.draft ?? 'unspecified'}.mdx`
    const record = snapshot.records.find(candidate => candidate.source?.path === sourcePath)
    assert.ok(record, sourcePath)
    assert.equal(record.collection, fixture.collection, sourcePath)
    assert.equal(record.status, fixture.status, sourcePath)
    assert.equal('editorialData' in record.data, false, sourcePath)
    assert.equal('draft' in record.data, false, sourcePath)
    assert.equal(record.source?.path, sourcePath)
    assert.equal(record.slug, record.legacyId, sourcePath)
    assert.equal(record.slug, `${fixture.collection === 'course-modules' ? 'example/' : ''}${fixture.draft ?? 'unspecified'}`, sourcePath)
  }
})

test('static content snapshot preserves bodies, source metadata, relationships, and assets', async () => {
  const snapshot = await buildStaticSnapshot({ root: path.join(repositoryRoot, 'content'), sequence: 1 })
  assert.ok(snapshot.records.length > 1_000)
  assert.ok(snapshot.assetFiles.length > 100)
  assert.ok(snapshot.records.some(record => record.collection === 'articles'))
  const articles = snapshot.records.filter(record => record.collection === 'articles')
  assert.ok(articles.every(record => record.status === 'published'))
  const legacyDraftArticle = articles.find(record => record.legacyId === 'seccomp-kubernetes')
  assert.ok(legacyDraftArticle)
  assert.equal(legacyDraftArticle.status, 'published')
  const draftModules = snapshot.records.filter(record => record.collection === 'course-modules' && record.status === 'draft')
  assert.ok(draftModules.length > 0)
  assert.ok(draftModules.every(record => record.status === 'draft'))
  assert.ok(snapshot.records.some(record => record.collection === 'courses' && record.legacyId === 'complete-guide-zitadel'))
  assert.ok(snapshot.records.some(record => record.collection === 'course-modules'))
  assert.equal(snapshot.records.some(record => record.collection === 'course-modules' && record.legacyId.includes('/examples/')), false)
  const module = snapshot.records.find(record => record.collection === 'course-modules' && record.legacyId === 'complete-guide-zitadel/01-introduction')
  assert.deepEqual(module?.relationships?.course, { collection: 'courses', legacyId: 'complete-guide-zitadel' })
  assert.ok(snapshot.records.some(record => record.collection === 'news'))
  assert.ok(snapshot.records.some(record => record.collection === 'testimonials'))
  const article = snapshot.records.find(record => record.collection === 'articles' && record.source?.path.endsWith('introducing-cuenv/index.mdx'))
  assert.ok(article)
  assert.match(String(article.data.body), /cuenv/)
  assert.ok(Array.isArray(article.source?.assets))
  assert.deepEqual(Object.keys(article.source ?? {}).sort(), ['assets', 'path'])
  assert.deepEqual((article.relationships?.authors as { legacyId: string }[])[0], { collection: 'people', legacyId: 'rawkode' })
  const chapter = snapshot.records.find(record => record.collection === 'chapters')
  assert.ok(chapter)
  const asset = snapshot.assetFiles.find(candidate => candidate.relativePath.endsWith('introducing-cuenv/cover.png'))
  assert.ok(asset)
  assert.equal(asset?.r2Key.startsWith('static/'), true)
  assert.ok(snapshot.assetFiles.some(candidate => candidate.relativePath.endsWith('examples/oauth-pkce-app/server.js')))
  assert.ok(snapshot.assetFiles.some(candidate => candidate.relativePath.endsWith('examples/oauth-pkce-app/.webcontainer.json')))
  const video = snapshot.records.find(record => record.collection === 'videos')
  assert.match(String(video?.data.streamUrl), /^https:\/\/content\.rawkode\.academy\/videos\/.+\/stream\.m3u8$/)
  assert.match(String(video?.data.thumbnailUrl), /^https:\/\/content\.rawkode\.academy\/videos\/.+\/thumbnail\.webp$/)
  if (video?.relationships?.show) assert.ok(snapshot.records.some(record => record.collection === 'episodes' && record.relationships?.video && !Array.isArray(record.relationships.video)))
})

test('Klustered snapshot preserves domain IDs and excludes sensitive tables by default', () => {
  const input = {
    seasons: [{ id: 'season-1', show_id: 'klustered', slug: 'w26', name: 'Winter 2026', status: 'interest', start_date: 1_700_000_000_000, endDate: null, created_at: 1_700_000_000_000, updated_at: 1_700_000_000_000 }],
    brackets: [{ id: 'bracket-1', season_id: 'season-1', name: 'Team bracket', slug: 'teams', kind: 'team', format: 'single_elimination', status: 'draft', starts_at: 1_700_000_000_000, max_entries: 16, team_size: 4, cadence_days: 7, created_at: 1_700_000_000_000, updated_at: 1_700_000_000_000 }],
    bracket_breaks: [{ id: 'break-1', bracket_id: 'bracket-1', label: 'Pause', starts_at: 1_700_000_000_000, endsAt: null, created_at: 1_700_000_000_000 }],
    competitors: [{ id: 'competitor-1', season_id: 'season-1', person_slug: 'rawkode', display_name: 'Rawkode', bio: null, user_id: null, created_at: 1_700_000_000_000, updated_at: 1_700_000_000_000 }],
    team_members: [{ team_id: 'team-1', bracket_id: 'bracket-1', competitor_id: 'competitor-1', role: 'captain', created_at: 1_700_000_000_000 }],
    team_invites: [{ token: 'secret-token', team_id: 'team-1', bracket_id: 'bracket-1', created_by_user_id: 'user-1', created_at: 1_700_000_000_000, revoked_at: null }],
    registrations: [{ id: 'registration-1', season_id: 'season-1', bracket_id: 'bracket-1', display_name: 'Private', email: 'private@example.invalid', submitted_at: 1_700_000_000_000, status: 'pending' }],
  }
  const snapshot = buildKlusteredSnapshot(input, { sequence: 1 })
  assert.equal(snapshot.records.some(record => record.collection === 'team-invites'), false)
  assert.equal(snapshot.records.some(record => record.collection === 'registrations'), false)
  const member = snapshot.records.find(record => record.collection === 'team-members')
  assert.equal(member?.legacyId, 'team-1:competitor-1')
  assert.deepEqual(member?.relationships?.competitor, { collection: 'competitors', legacyId: 'competitor-1' })
  const season = snapshot.records.find(record => record.collection === 'seasons')
  assert.equal(season?.slug, 'w26')
  assert.equal('slug' in (season?.data ?? {}), false)
  assert.equal(season?.data.sourceShowId, 'klustered')
  assert.equal(season?.data.endDate, null)
  assert.equal('showId' in (season?.data ?? {}), false)
  assert.deepEqual(season?.relationships?.show, { collection: 'shows', legacyId: 'klustered' })
  const bracketBreak = snapshot.records.find(record => record.collection === 'bracket-breaks')
  assert.equal(bracketBreak?.data.endsAt, null)
  const repeatA = buildKlusteredSnapshot(input)
  const repeatB = buildKlusteredSnapshot(input)
  assert.equal(repeatA.sequence, repeatB.sequence)
  assert.deepEqual(repeatA.records, repeatB.records)
  const sensitive = buildKlusteredSnapshot(input, { sequence: 1, includeSensitive: true })
  const invite = sensitive.records.find(record => record.collection === 'team-invites')
  assert.equal(Boolean(invite), true)
  assert.notEqual(invite?.legacyId, 'secret-token')
  assert.equal(invite?.source?.path.includes('secret-token'), false)
  assert.equal(sensitive.records.some(record => record.collection === 'registrations'), true)
})
