import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import type { CollectionConfig, Field, Tab } from 'payload'
import { type AdminAccess, hiddenUnlessDeveloper, isDeveloper, parseDeveloperSubjects } from '../src/admin/access'
import { NAV_ORDER, adminPresets } from '../src/admin/collection-admin'
import { dashboard } from '../src/admin/config'
import { fillEditorialIdentity } from '../src/admin/fields'
import { provenanceNames } from '../src/admin/layout'
import { type CollectionShape, type DataField, flattenDataShape, flattenFields } from '../src/admin/shape'
import { collectionOrder, compoundIndexOrder, createCollections } from '../src/collections'

// Pure config checks: no payload.config import, no Cloudflare bindings.
const developer = 'developer-subject'
const access: AdminAccess = { developerSubjects: [developer], localAuth: false }
const collections = createCollections({ localAuth: false } as never, {} as never, access)
const bySlug = new Map(collections.map(collection => [collection.slug, collection]))
const staffUser = { collection: 'users', role: 'staff', oidcSubject: 'someone-else' }
const developerUser = { collection: 'users', role: 'staff', oidcSubject: developer }
const customerUser = { collection: 'users', role: 'customer', oidcSubject: developer }

const builtIn = new Set(['id', '_status', 'createdAt', 'updatedAt'])
const uploadBuiltIn = new Set(['filename', 'mimeType', 'filesize', 'width', 'height', 'url', 'thumbnailURL', 'focalX', 'focalY'])
const authBuiltIn = new Set(['email'])
const virtualAdditions = new Set(['competitorName', 'videoTitle', 'label'])
const tabsOf = (collection: CollectionConfig): Tab[] => collection.fields.flatMap(field => (field.type === 'tabs' ? field.tabs : []))
const nameOf = (field: Field) => ('name' in field ? field.name : undefined)
const readOnlyOf = (field: Field) => (field.admin as { readOnly?: boolean } | undefined)?.readOnly
const allNamed = (fields: Field[]): Field[] =>
	fields.flatMap(field => {
		if (field.type === 'tabs') return field.tabs.flatMap(tab => allNamed(tab.fields))
		if (field.type === 'row' || field.type === 'collapsible') return allNamed(field.fields)
		return nameOf(field) ? [field] : []
	})
const resolvable = (collection: CollectionConfig, name: string) =>
	builtIn.has(name) ||
	(collection.upload && uploadBuiltIn.has(name)) ||
	(collection.auth && authBuiltIn.has(name)) ||
	allNamed(collection.fields).some(field => nameOf(field) === name) ||
	collection.fields.some(field => field.type === 'ui' && field.name === name)

test('every collection is grouped in NAV_ORDER or deliberately kept out of the nav', () => {
	assert.equal(collections.length, collectionOrder.length)
	for (const collection of collections) {
		const group = collection.admin?.group
		const hidden = collection.admin?.hidden
		const grouped = typeof group === 'string' && (NAV_ORDER as readonly string[]).includes(group)
		assert.ok(grouped || group === false || typeof hidden === 'function', `${collection.slug} would fall into the implicit Collections group`)
		assert.ok(adminPresets[collection.slug], `${collection.slug} has no preset`)
	}
	assert.equal(Object.keys(adminPresets).length, collections.length, 'presets exist only for real collections')
})

test('nav groups appear in NAV_ORDER, with group:false collections last', () => {
	const groups: string[] = []
	let sawUngrouped = false
	for (const collection of collections) {
		const group = collection.admin?.group
		if (group === false) {
			sawUngrouped = true
			continue
		}
		assert.equal(sawUngrouped, false, `${collection.slug} is grouped but listed after group:false collections`)
		if (typeof group === 'string' && !groups.includes(group)) groups.push(group)
	}
	assert.deepEqual(groups, [...NAV_ORDER])
})

test('the review audit tables and child records stay routable but out of the nav', () => {
	for (const slug of ['video-revisions', 'review-comments', 'review-decisions', 'chapters', 'learning-resources']) {
		assert.equal(bySlug.get(slug)?.admin?.group, false, slug)
		assert.equal(bySlug.get(slug)?.admin?.hidden, undefined, `${slug} must stay reachable from the queue and parent records`)
	}
})

test('Klustered child records have no parent join, so they stay in the nav', () => {
	for (const slug of ['match-results', 'team-members', 'bracket-entries', 'bracket-breaks']) {
		assert.equal(bySlug.get(slug)?.admin?.group, 'Klustered', slug)
		assert.equal(bySlug.get(slug)?.admin?.hidden, undefined, slug)
	}
})

test('tombstone is never an editable sidebar control', () => {
	for (const collection of collections) {
		const sidebar = collection.fields.filter(field => field.admin && 'position' in field.admin && field.admin.position === 'sidebar').map(nameOf)
		assert.ok(!sidebar.includes('tombstone'), `${collection.slug}.tombstone is in the sidebar`)
	}
})

test('list presets resolve to real fields and readable titles', () => {
	const notLegacy = [
		'people',
		'technologies',
		'shows',
		'episodes',
		'testimonials',
		'matches',
		'bracket-applications',
		'team-members',
		'video-revisions',
		'review-comments',
		'review-decisions',
		'videos',
		'articles',
	]
	for (const collection of collections) {
		const admin = collection.admin ?? {}
		const title = admin.useAsTitle
		assert.ok(title, `${collection.slug} needs useAsTitle`)
		assert.ok(resolvable(collection, title), `${collection.slug}.useAsTitle ${title} does not resolve`)
		const titleField = allNamed(collection.fields).find(field => nameOf(field) === title) as { virtual?: unknown } | undefined
		assert.notEqual(titleField?.virtual, true, `${collection.slug}.useAsTitle is virtual:true, which Payload rejects`)
		if (typeof titleField?.virtual === 'string') assert.match(titleField.virtual, /^\w+\.\w+$/)
		if (notLegacy.includes(collection.slug)) assert.notEqual(title, 'legacyId', `${collection.slug} still titles by legacyId`)
		for (const column of admin.defaultColumns ?? []) assert.ok(resolvable(collection, column), `${collection.slug} column ${column} does not resolve`)
		for (const field of admin.listSearchableFields ?? []) assert.ok(resolvable(collection, field), `${collection.slug} search field ${field} does not resolve`)
		assert.ok(!(admin.defaultColumns ?? []).includes('legacyType'), `${collection.slug} shows legacyType as a column`)
	}
	assert.ok(!bySlug.get('videos')!.admin!.defaultColumns!.includes('legacyId'))
})

test('every collection is described; labels and defaultSort are top-level, never admin keys', () => {
	for (const collection of collections) {
		assert.ok(collection.admin?.description, `${collection.slug} needs a description`)
		assert.equal('labels' in (collection.admin ?? {}), false)
		assert.equal('defaultSort' in (collection.admin ?? {}), false)
		const preset = adminPresets[collection.slug]
		if (preset.labels) assert.deepEqual(collection.labels, preset.labels)
		if (preset.defaultSort) assert.equal(collection.defaultSort, preset.defaultSort)
	}
	assert.equal(bySlug.get('adrs')?.labels?.plural, 'ADRs')
	assert.equal(bySlug.get('videos')?.defaultSort, '-publishedAt')
})

test('provenance sits read-only in a developer-only Source tab, after editorial content', () => {
	const editorial = collections.filter(
		collection => allNamed(collection.fields).some(field => nameOf(field) === 'legacyId') && collection.slug !== 'deletion-markers',
	)
	assert.ok(editorial.length >= 25)
	for (const collection of editorial) {
		const tabs = tabsOf(collection)
		assert.ok(tabs.length, `${collection.slug} has no tabs`)
		const source = tabs.find(tab => tab.label === 'Source')
		assert.ok(source, `${collection.slug} has no Source tab`)
		assert.equal(tabs.at(-1), source, `${collection.slug} Source tab must be last`)
		const condition = source.admin?.condition
		assert.equal(typeof condition, 'function')
		assert.equal(condition!({}, {}, { user: staffUser } as never), false, 'staff never see provenance')
		assert.equal(condition!({}, {}, { user: developerUser } as never), true)
		const sourceFields = allNamed(source.fields)
		for (const name of ['legacyId']) {
			const field = sourceFields.find(item => nameOf(item) === name)
			assert.ok(field, `${collection.slug}.${name} not in Source`)
			assert.equal(readOnlyOf(field), true)
		}
		for (const field of sourceFields) assert.equal(readOnlyOf(field), true, `${collection.slug}.${nameOf(field)} is editable in Source`)
		for (const tab of tabs.filter(tab => tab !== source)) {
			for (const field of allNamed(tab.fields))
				assert.ok(!provenanceNames.has(String(nameOf(field))), `${collection.slug}.${nameOf(field)} leaked out of Source`)
		}
		const first = allNamed(tabs[0].fields)[0]
		if (tabs[0].label !== 'Relations')
			assert.ok(
				[
					'title',
					'name',
					'displayName',
					'code',
					'quote',
					'label',
					'body',
					'sourcePath',
					'r2Key',
					'token',
					'personSlug',
					'role',
					'roundNumber',
					'timeToResolveSeconds',
				].includes(String(nameOf(first))),
				`${collection.slug} starts with ${nameOf(first)}`,
			)
		const slug = collection.fields.find(field => nameOf(field) === 'slug')
		assert.equal(slug?.admin && 'position' in slug.admin ? slug.admin.position : undefined, 'sidebar', `${collection.slug}.slug belongs in the sidebar`)
	}
	const videos = tabsOf(bySlug.get('videos')!)
	assert.deepEqual(
		videos.map(tab => tab.label),
		['Content', 'Relations', 'Media', 'Processing', 'Review', 'Source'],
	)
	assert.equal(allNamed(videos[0].fields)[0] && nameOf(allNamed(videos[0].fields)[0]), 'title')
	const sidebar = bySlug
		.get('videos')!
		.fields.filter(field => field.admin && 'position' in field.admin && field.admin.position === 'sidebar')
		.map(nameOf)
	assert.deepEqual(sidebar, ['type', 'category', 'publishedAt', 'slug'])
})

test('developer-only collections are hidden from staff and visible to developers', () => {
	const developerOnly = ['pipeline-runs', 'deletion-markers', 'static-assets', 'video-review-grants', 'review-revision-grants', 'video-publications', 'team-invites', 'registrations']
	for (const slug of developerOnly) {
		const hidden = bySlug.get(slug)?.admin?.hidden
		assert.equal(typeof hidden, 'function', slug)
		const check = hidden as (args: { user: unknown }) => boolean
		assert.equal(check({ user: staffUser }), true, `${slug} visible to non-developer staff`)
		assert.equal(check({ user: developerUser }), false, `${slug} hidden from developers`)
		assert.equal(check({ user: customerUser }), true)
	}
	for (const collection of collections) {
		if (!developerOnly.includes(collection.slug)) assert.equal(collection.admin?.hidden, undefined, `${collection.slug} unexpectedly hidden`)
	}
	assert.equal(
		isDeveloper({ developerSubjects: [], localAuth: true }, { collection: 'users', role: 'staff', oidcSubject: null }),
		true,
		'loopback local staff are developers',
	)
	assert.equal(isDeveloper({ developerSubjects: [], localAuth: true }, staffUser), false, 'local auth never promotes an OIDC subject')
	assert.equal(hiddenUnlessDeveloper({ developerSubjects: [], localAuth: false })({ user: { collection: 'users', role: 'staff' } }), true)
})

test('DEVELOPER_SUBJECTS uses the strict OIDC_STAFF_SUBJECTS format and fails closed', () => {
	assert.deepEqual(parseDeveloperSubjects(undefined, ['a']), [])
	assert.deepEqual(parseDeveloperSubjects('["a"]', ['a', 'b']), ['a'])
	for (const bad of ['a', '{"a":1}', '[""]', '[1]', '["a",null]', 'not json']) {
		assert.throws(() => parseDeveloperSubjects(bad, ['a']), /DEVELOPER_SUBJECTS must be an explicit JSON array/, bad)
	}
	assert.throws(() => parseDeveloperSubjects('["c"]', ['a']), /must also be listed in OIDC_STAFF_SUBJECTS/)
})

test('editor creates do not fabricate importer identity and can derive a slug', async () => {
	for (const collection of collections) {
		const named = allNamed(collection.fields)
		const legacyId = named.find(field => nameOf(field) === 'legacyId') as { defaultValue?: unknown; required?: unknown; admin?: { hidden?: unknown } } | undefined
		if (!legacyId || collection.slug === 'deletion-markers') continue
		assert.equal(legacyId.defaultValue, undefined, `${collection.slug}.legacyId is importer-owned`)
		assert.equal(legacyId.required, undefined, `${collection.slug}.legacyId must be optional for CMS-created content`)
		assert.equal(legacyId.admin?.hidden, true, `${collection.slug}.legacyId stays hidden in the CMS`)
		const slug = named.find(field => nameOf(field) === 'slug') as { validate?: (value: unknown, options: unknown) => unknown }
		assert.equal(slug.validate!('', { operation: 'create', req: { context: {} } }), true)
		assert.notEqual(slug.validate!('', { operation: 'update', req: { context: {} } }), true)
		assert.notEqual(slug.validate!('', { operation: 'create', req: { context: { importing: true } } }), true)
		assert.equal(slug.validate!('ok', { operation: 'update', req: { context: {} } }), true)
	}
	const taken = new Set(['hello-world', 'hello-world-2'])
	const req = {
		context: {},
		payload: { count: async ({ where }: { where: { slug: { equals: string } } }) => ({ totalDocs: taken.has(where.slug.equals) ? 1 : 0 }) },
	}
	const hook = fillEditorialIdentity('articles')
	const created = (await hook({ data: { title: 'Hello, World!' }, operation: 'create', req } as never)) as Record<string, string>
	assert.equal(created.slug, 'hello-world-3')
	assert.equal(created.legacyId, undefined)
	const kept = (await hook({ data: { title: 'x', slug: 'chosen' }, operation: 'create', req } as never)) as Record<string, string>
	assert.equal(kept.slug, 'chosen')
	const imported = (await hook({ data: { title: 'x' }, operation: 'create', req: { ...req, context: { importing: true } } } as never)) as Record<string, string>
	assert.equal(imported.slug, undefined, 'imports keep their explicit identity rules')
	const updated = (await hook({ data: { title: 'x' }, operation: 'update', req } as never)) as Record<string, string>
	assert.equal(updated.slug, undefined)
})

test('videos guard Save and Publish for review-frozen and pipeline-linked videos and carry a read-only Review panel', () => {
	const videos = bySlug.get('videos')!
	const edit = videos.admin?.components?.edit
	assert.equal(edit?.PublishButton, './src/admin/fields/ReviewFreeze#VideoPublishControl')
	assert.equal(edit?.SaveDraftButton, './src/admin/fields/ReviewFreeze#VideoSaveDraftControl')
	assert.equal(edit?.UnpublishButton, './src/admin/fields/ReviewFreeze#VideoUnpublishControl')
	const notice = videos.fields.find(field => nameOf(field) === 'reviewFreeze')
	assert.equal(notice?.type, 'ui')
	assert.ok(videos.fields.indexOf(notice!) < videos.fields.findIndex(field => field.type === 'tabs'), 'freeze notice sits above the tabs')
	const review = tabsOf(videos).find(tab => tab.label === 'Review')!
	assert.equal(review.fields[0].type, 'ui')
	const processing = tabsOf(videos).find(tab => tab.label === 'Processing')!
	for (const field of allNamed(processing.fields)) assert.equal(readOnlyOf(field), true)
	assert.equal(processing.admin?.condition?.({}, {}, {} as never), false)
	assert.equal(processing.admin?.condition?.({ processingRun: '7' }, {}, {} as never), true)
})

test('dashboard widgets render before Payload collections and never reuse its slug', () => {
	assert.ok(dashboard.widgets.every(widget => widget.slug !== 'collections'))
	assert.equal(dashboard.defaultLayout[0].widgetSlug, 'review-queue')
	assert.equal(dashboard.defaultLayout.at(-1)?.widgetSlug, 'collections')
	const known = new Set([...dashboard.widgets.map(widget => widget.slug), 'collections'])
	for (const item of dashboard.defaultLayout) assert.ok(known.has(item.widgetSlug))
})

test('SCHEMA GUARD: the stored data shape matches the pre-change snapshot', async () => {
	const baseline = JSON.parse(await readFile(new URL('../fixtures/admin-field-shape.json', import.meta.url), 'utf8')) as CollectionShape[]
	// Only virtual fields may be added; they have no column.
	const strip = (fields: DataField[]): DataField[] =>
		fields
			.filter(field => !(virtualAdditions.has(field.name) && field.virtual))
			.map(field => (field.fields ? { ...field, fields: strip(field.fields) } : field))
	const actual = flattenDataShape(collections).map(collection => ({ ...collection, fields: strip(collection.fields) }))
	assert.deepEqual(actual, baseline)
	const added = flattenDataShape(collections).flatMap(collection =>
		collection.fields.filter(field => virtualAdditions.has(field.name) && field.virtual).map(field => `${collection.slug}.${field.name}`),
	)
	assert.deepEqual(added.sort(), [
		'bracket-applications.competitorName',
		'match-results.label',
		'matches.label',
		'review-comments.videoTitle',
		'review-decisions.videoTitle',
		'review-revision-grants.videoTitle',
		'team-members.competitorName',
		'video-revisions.videoTitle',
	])
	assert.ok(flattenFields(bySlug.get('videos')!.fields).every(field => !('admin' in field)))
})

test('SCHEMA GUARD: collections with compound indexes keep their original relative order', () => {
	// Reordering them renames generated index names (bracket_competitor_1_idx vs _2_idx).
	const key = (fields: string[]) => fields.join('_')
	const owners = new Map<string, string[]>()
	for (const collection of collections) {
		for (const index of collection.indexes ?? []) owners.set(key(index.fields), [...(owners.get(key(index.fields)) ?? []), collection.slug])
	}
	const shared = [...owners.values()].filter(slugs => slugs.length > 1)
	assert.ok(shared.length, 'expected the known [bracket, competitor] collision')
	for (const slugs of shared)
		assert.deepEqual(
			slugs,
			compoundIndexOrder.filter(slug => slugs.includes(slug)),
			`index collision order changed: ${slugs.join(', ')}`,
		)
	for (const slugs of shared)
		assert.ok(
			slugs.every(slug => (compoundIndexOrder as readonly string[]).includes(slug)),
			`new index collision: ${slugs.join(', ')}`,
		)
})
