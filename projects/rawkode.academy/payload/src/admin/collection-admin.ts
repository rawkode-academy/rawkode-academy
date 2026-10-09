import type { CollectionConfig } from 'payload'
import { type AdminAccess, hiddenUnlessDeveloper } from './access'

// One admin preset per collection slug. This is the only place to decide where
// a collection appears in the nav, what its list looks like and what it is
// called. Adding a collection without a preset fails createCollections and
// tests/admin-config.test.ts.
//
// Nav order follows the order collections are passed to buildConfig, so
// createCollections lists them group by group in NAV_ORDER.
export const NAV_ORDER = ['Publishing', 'Learning', 'People', 'Media', 'Klustered', 'Site', 'System'] as const
export type NavGroup = (typeof NAV_ORDER)[number]

export type AdminPreset = {
	// false keeps the collection routable (relationship drawers, deep links)
	// but out of the nav. developerOnly hides it, and 404s its routes, for
	// staff who are not in DEVELOPER_SUBJECTS.
	group: NavGroup | false
	developerOnly?: boolean
	description: string
	useAsTitle: string
	defaultColumns: string[]
	listSearchableFields?: string[]
	// Top-level CollectionConfig keys; Payload ignores them inside admin.
	labels?: { singular: string; plural: string }
	defaultSort?: string
	pagination?: { defaultLimit: number; limits: number[] }
}

const pagination = { defaultLimit: 25, limits: [25, 50, 100] }
const auditDescription = 'Read-only audit. Change review state in Preview review.'

export const adminPresets: Record<string, AdminPreset> = {
	// Publishing
	videos: {
		group: 'Publishing',
		description: 'Recorded and live videos. Videos in client review are read-only here and publish through Preview review.',
		useAsTitle: 'title',
		defaultColumns: ['title', '_status', 'type', 'show', 'publishedAt', 'processingState', 'updatedAt'],
		listSearchableFields: ['title', 'slug', 'youtubeId', 'legacyId'],
		defaultSort: '-publishedAt',
	},
	shows: {
		group: 'Publishing',
		description: 'Recurring shows. Episodes link a video to a show.',
		useAsTitle: 'name',
		defaultColumns: ['name', 'status', 'hosts', 'updatedAt'],
		listSearchableFields: ['name', 'slug'],
	},
	episodes: {
		group: 'Publishing',
		description: 'Show episodes. Each one joins a video to its show.',
		useAsTitle: 'code',
		defaultColumns: ['code', 'show', 'video', '_status'],
		listSearchableFields: ['code', 'slug'],
	},
	articles: {
		group: 'Publishing',
		description: 'Tutorials, guides and long-form articles.',
		useAsTitle: 'title',
		defaultColumns: ['title', 'type', 'authors', '_status', 'publishedAt'],
		listSearchableFields: ['title', 'slug', 'description'],
		defaultSort: '-publishedAt',
	},
	news: {
		group: 'Publishing',
		labels: { singular: 'News item', plural: 'News' },
		description: 'Short news posts.',
		useAsTitle: 'title',
		defaultColumns: ['title', 'authors', '_status', 'publishedAt'],
		listSearchableFields: ['title', 'slug', 'description'],
		defaultSort: '-publishedAt',
	},
	series: {
		group: 'Publishing',
		labels: { singular: 'Series', plural: 'Series' },
		description: 'Article series.',
		useAsTitle: 'title',
		defaultColumns: ['title', '_status', 'updatedAt'],
		listSearchableFields: ['title', 'slug'],
	},
	// Learning
	courses: {
		group: 'Learning',
		description: 'Courses and their modules.',
		useAsTitle: 'title',
		defaultColumns: ['title', 'difficulty', '_status', 'publishedAt'],
		listSearchableFields: ['title', 'slug', 'description'],
	},
	'course-modules': {
		group: 'Learning',
		description: 'Lessons inside a course, in order.',
		useAsTitle: 'title',
		defaultColumns: ['title', 'course', 'order', 'section', '_status'],
		listSearchableFields: ['title', 'slug'],
		defaultSort: 'order',
	},
	'learning-paths': {
		group: 'Learning',
		description: 'Curated sequences of courses and videos.',
		useAsTitle: 'title',
		defaultColumns: ['title', 'difficulty', '_status'],
		listSearchableFields: ['title', 'slug'],
	},
	technologies: {
		group: 'Learning',
		labels: { singular: 'Technology', plural: 'Technologies' },
		description: 'Technology profiles shown across the site.',
		useAsTitle: 'name',
		defaultColumns: ['name', 'category', 'status', 'website'],
		listSearchableFields: ['name', 'slug', 'category'],
	},
	// People
	people: {
		group: 'People',
		labels: { singular: 'Person', plural: 'People' },
		description: 'Hosts, guests and authors.',
		useAsTitle: 'name',
		defaultColumns: ['name', 'githubHandle', 'updatedAt'],
		listSearchableFields: ['name', 'forename', 'surname', 'github', 'githubHandle', 'slug'],
	},
	testimonials: {
		group: 'People',
		description: 'Quotes from maintainers, partners and viewers.',
		useAsTitle: 'quote',
		defaultColumns: ['quote', 'type', '_status'],
		listSearchableFields: ['quote'],
	},
	users: {
		group: 'People',
		description: 'Provisioned from Academy identity; staff role comes from OIDC_STAFF_SUBJECTS.',
		useAsTitle: 'name',
		defaultColumns: ['name', 'role', 'profileEmail'],
		listSearchableFields: ['name', 'profileEmail'],
	},
	// Media
	media: {
		group: 'Media',
		description: 'Uploaded files stored in R2.',
		useAsTitle: 'filename',
		defaultColumns: ['filename', 'alt', 'mimeType', 'filesize', 'updatedAt'],
		listSearchableFields: ['filename', 'alt'],
	},
	// Klustered
	seasons: {
		group: 'Klustered',
		description: 'Klustered seasons.',
		useAsTitle: 'name',
		defaultColumns: ['name', 'status', 'startDate'],
		listSearchableFields: ['name', 'slug'],
	},
	brackets: {
		group: 'Klustered',
		description: 'Competition brackets within a season.',
		useAsTitle: 'name',
		defaultColumns: ['name', 'season', 'kind', 'status', 'startsAt'],
		listSearchableFields: ['name', 'slug'],
	},
	matches: {
		group: 'Klustered',
		labels: { singular: 'Match', plural: 'Matches' },
		description: 'Bracket matches, listed by schedule.',
		useAsTitle: 'scheduledAt',
		defaultColumns: ['scheduledAt', 'label', 'bracket', 'status'],
		defaultSort: 'scheduledAt',
	},
	'match-results': {
		group: 'Klustered',
		description: 'Recorded match outcomes.',
		useAsTitle: 'legacyId',
		defaultColumns: ['legacyId', 'label', 'match', 'recordedAt'],
	},
	competitors: {
		group: 'Klustered',
		description: 'People competing in a season.',
		useAsTitle: 'displayName',
		defaultColumns: ['displayName', 'season', 'personSlug'],
		listSearchableFields: ['displayName', 'personSlug'],
	},
	teams: {
		group: 'Klustered',
		description: 'Teams entered in a bracket.',
		useAsTitle: 'name',
		defaultColumns: ['name', 'bracket', 'season'],
		listSearchableFields: ['name', 'slug'],
	},
	'bracket-applications': {
		group: 'Klustered',
		description: 'Competitor applications to join a bracket.',
		useAsTitle: 'competitorName',
		defaultColumns: ['competitorName', 'bracket', 'status', 'reviewedAt'],
	},
	'team-members': {
		group: 'Klustered',
		description: 'Competitors on a team.',
		useAsTitle: 'competitorName',
		defaultColumns: ['competitorName', 'team', 'role'],
	},
	'bracket-entries': {
		group: 'Klustered',
		description: 'Seeded entries in a bracket.',
		useAsTitle: 'displayName',
		defaultColumns: ['displayName', 'bracket', 'seed', 'status'],
	},
	'bracket-breaks': {
		group: 'Klustered',
		description: 'Scheduled breaks in a bracket.',
		useAsTitle: 'label',
		defaultColumns: ['label', 'bracket', 'startsAt', 'endsAt'],
	},
	registrations: {
		group: 'Klustered',
		developerOnly: true,
		description: 'Season registrations. Contains personal data, so only developers can open it.',
		useAsTitle: 'displayName',
		defaultColumns: ['displayName', 'bracket', 'entryType', 'status', 'submittedAt'],
		listSearchableFields: ['displayName'],
	},
	// Site
	changelog: {
		group: 'Site',
		labels: { singular: 'Changelog entry', plural: 'Changelog' },
		description: 'Product changelog entries.',
		useAsTitle: 'title',
		defaultColumns: ['title', 'type', 'date', '_status'],
		listSearchableFields: ['title', 'slug'],
		defaultSort: '-date',
	},
	adrs: {
		group: 'Site',
		labels: { singular: 'ADR', plural: 'ADRs' },
		description: 'Architecture decision records.',
		useAsTitle: 'title',
		defaultColumns: ['title', 'adoptedAt', '_status'],
		listSearchableFields: ['title', 'slug'],
	},
	// System: developer-only, machine-owned or sensitive.
	'pipeline-runs': {
		group: 'System',
		developerOnly: true,
		description: 'Experimental media pipeline runs. Server-owned.',
		useAsTitle: 'key',
		defaultColumns: ['key', 'video', 'state', 'provider', 'updatedAt'],
	},
	'deletion-markers': {
		group: 'System',
		developerOnly: true,
		description: 'Stops re-import from resurrecting records an editor deleted.',
		useAsTitle: 'key',
		defaultColumns: ['key', 'collectionSlug', 'legacyId', 'createdAt'],
	},
	'static-assets': {
		group: 'System',
		developerOnly: true,
		description: 'Imported static files mirrored to R2.',
		useAsTitle: 'sourcePath',
		defaultColumns: ['sourcePath', 'mimeType', 'bytes', 'updatedAt'],
	},
	'video-review-grants': {
		group: 'System',
		developerOnly: true,
		description: 'Retired: superseded by review-revision-grants. Kept read-only until the enforce migration.',
		useAsTitle: 'id',
		defaultColumns: ['id', 'video', 'user', 'canApprove', 'active'],
	},
	'review-revision-grants': {
		group: 'System',
		developerOnly: true,
		description: 'Per-revision client review access. Managed by the share and revoke review commands.',
		useAsTitle: 'videoTitle',
		defaultColumns: ['videoTitle', 'revision', 'user', 'canApprove', 'expiresAt', 'revokedAt'],
		defaultSort: '-grantedAt',
	},
	'video-publications': {
		group: 'System',
		developerOnly: true,
		description: 'Approved public projections of reviewed videos.',
		useAsTitle: 'id',
		defaultColumns: ['id'],
	},
	'team-invites': {
		group: 'System',
		developerOnly: true,
		description: 'Klustered team invite tokens.',
		useAsTitle: 'legacyId',
		defaultColumns: ['legacyId', 'team', 'bracket', 'revokedAt'],
	},
	// Routable, but kept out of the nav: review audit records (reached from the
	// Review queue) and child records edited from their parent.
	'video-revisions': {
		group: false,
		description: auditDescription,
		useAsTitle: 'videoTitle',
		defaultColumns: ['videoTitle', 'reviewVersion', 'state', 'createdAt'],
		defaultSort: '-createdAt',
	},
	'review-comments': {
		group: false,
		description: auditDescription,
		useAsTitle: 'videoTitle',
		defaultColumns: ['videoTitle', 'body', 'resolved', 'createdAt'],
		defaultSort: '-createdAt',
	},
	'review-decisions': {
		group: false,
		description: auditDescription,
		useAsTitle: 'videoTitle',
		defaultColumns: ['videoTitle', 'decision', 'reviewVersion', 'createdAt'],
		defaultSort: '-createdAt',
	},
	chapters: {
		group: false,
		description: 'Video chapters. Edit them from the video.',
		useAsTitle: 'title',
		defaultColumns: ['title', 'startTime'],
	},
	'learning-resources': {
		group: false,
		description: 'Link lists attached to technologies and articles.',
		useAsTitle: 'title',
		defaultColumns: ['title'],
	},
}

export function presetFor(slug: string): AdminPreset {
	const preset = adminPresets[slug]
	if (!preset) throw new Error(`Missing admin preset for collection "${slug}" in src/admin/collection-admin.ts`)
	return preset
}

export function applyPreset(config: CollectionConfig, access: AdminAccess): CollectionConfig {
	const preset = presetFor(config.slug)
	return {
		...config,
		...(preset.labels ? { labels: preset.labels } : {}),
		...(preset.defaultSort ? { defaultSort: preset.defaultSort } : {}),
		admin: {
			...config.admin,
			group: preset.group,
			description: preset.description,
			useAsTitle: preset.useAsTitle,
			defaultColumns: preset.defaultColumns,
			...(preset.listSearchableFields ? { listSearchableFields: preset.listSearchableFields } : {}),
			pagination: preset.pagination ?? pagination,
			...(preset.developerOnly ? { hidden: hiddenUnlessDeveloper(access) } : {}),
		},
	}
}
