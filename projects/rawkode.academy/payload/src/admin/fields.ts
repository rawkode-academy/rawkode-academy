import type { CollectionBeforeValidateHook, Condition, Field, TextField } from 'payload'
import { type AdminAccess, isDeveloper } from './access'

// Presentational field helpers. Everything here is admin-only: unnamed tabs,
// rows and collapsibles do not change the stored shape, and labels,
// descriptions, readOnly, conditions, function defaults and validate emit no
// DDL. tests/admin-config.test.ts guards that with fixtures/admin-field-shape.json.

type Named = Field & { name: string }
const isNamed = (field: Field): field is Named => 'name' in field && typeof field.name === 'string'
const nameOf = (field: Field) => (isNamed(field) ? field.name : '')

const withAdmin = (field: Field, admin: Record<string, unknown>): Field => ({ ...field, admin: { ...(field.admin ?? {}), ...admin } }) as Field

export const readOnly = (field: Field): Field => withAdmin(field, { readOnly: true })
export const readOnlyAll = (fields: Field[]): Field[] => fields.map(readOnly)

const rawSourceFields = new Set(['sourceFields', 'sourceData', 'sourceRaw', 'sourceBody', 'sourceAssets', 'editorialData'])

const labels: Record<string, string> = {
	youtubeId: 'YouTube ID',
	streamUrl: 'Stream URL',
	thumbnailUrl: 'Thumbnail URL',
	avatarUrl: 'Avatar URL',
	gameFormatUrl: 'Game format URL',
	github: 'GitHub',
	githubHandle: 'GitHub handle (canonical)',
	githubUrl: 'GitHub URL (legacy)',
	linkedin: 'LinkedIn',
	youtube: 'YouTube',
	bluesky: 'Bluesky',
	legacyId: 'Legacy ID',
	realtimeKit: 'RealtimeKit',
	seo: 'SEO',
	cncf: 'CNCF',
	whatYouWillLearn: 'What you will learn',
}

const descriptions: Record<string, string> = {
	duration: 'Seconds.',
	audioFileSize: 'Bytes.',
	startTime: 'Seconds from the start of the video.',
	estimatedDuration: 'Minutes.',
	slug: 'URL segment. Generated from the title on create when left empty.',
	tombstone: 'Hidden from public reads. Set by importer reconciliation.',
	legacyId: 'Stable identity used by the importer. Editor-created records get a payload: prefix.',
}

export function decorate(field: Field): Field {
	if (!isNamed(field)) return field
	let next = field as Field
	const name = field.name
	if (labels[name] && !('label' in field && field.label)) next = { ...next, label: labels[name] } as Field
	if (descriptions[name] && !(field.admin as { description?: unknown } | undefined)?.description) {
		next = withAdmin(next, { description: descriptions[name] })
	}
	return next
}

export const advanced = (fields: Field[], label = 'Advanced data (raw JSON)'): Field[] =>
	fields.length ? [{ type: 'collapsible', label, admin: { initCollapsed: true }, fields }] : []

export const collapsible = (label: string, fields: Field[], initCollapsed = false): Field[] =>
	fields.length ? [{ type: 'collapsible', label, admin: { initCollapsed }, fields }] : []

export const developerOnly =
	(access: AdminAccess): Condition =>
	(_data, _siblingData, { user }) =>
		isDeveloper(access, user)

// Provenance is owned by the importer. It is read-only for everyone, visible
// only to developers, and the bulky raw blobs are kept out of list columns,
// filters and bulk edit.
export function sourceTab(fields: Field[], access: AdminAccess) {
	const plain = fields.filter(field => !rawSourceFields.has(nameOf(field)))
	const raw = fields
		.filter(field => rawSourceFields.has(nameOf(field)))
		.map(field => withAdmin(decorate(field), { readOnly: true, disableListColumn: true, disableListFilter: true, disableBulkEdit: true }))
	return {
		label: 'Source',
		description: 'Imported provenance. Read-only; the importer owns these values.',
		admin: { condition: developerOnly(access) },
		fields: [...readOnlyAll(plain.map(decorate)), ...collapsible('Raw source', raw, true)],
	}
}

// A title for collections that have no readable stored column, read through
// a relationship. Payload allows relationship-linked virtuals as useAsTitle.
export const relationTitle = (name: string, path: string, label: string): TextField => ({
	name,
	type: 'text',
	label,
	virtual: path,
	admin: { readOnly: true, disableBulkEdit: true, condition: () => false },
})

// A list-only computed column. Never a useAsTitle (Payload rejects virtual:true titles).
export const computedLabel = (name: string, compute: (doc: Record<string, unknown>) => string): TextField => ({
	name,
	type: 'text',
	label: 'Label',
	virtual: true,
	admin: { readOnly: true, disableBulkEdit: true, disableListFilter: true, condition: () => false },
	hooks: { afterRead: [({ data, siblingData }) => compute({ ...(data ?? {}), ...(siblingData ?? {}) })] },
})

export const slugify = (value: string): string =>
	value
		.toLowerCase()
		.normalize('NFKD')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 80)

const titleKeys = ['title', 'name', 'displayName', 'code', 'label', 'quote'] as const

// Editor-created records need importer identity values they cannot see.
// legacyId/legacyType get function defaults (no column default, so no DDL),
// and slug may be left empty on an editorial create; fillEditorialIdentity
// then derives it before validation. NOT NULL still protects the database.
export function provenanceDefaults(slug: string, singular: string) {
	return {
		legacyId: { defaultValue: () => `payload:${slug}:${crypto.randomUUID()}` },
		// Function, never a literal: a literal default would become a column DEFAULT.
		legacyType: { defaultValue: () => singular },
		slug: {
			validate: (value: unknown, options: { operation?: string; req?: { context?: Record<string, unknown> } }) => {
				if (typeof value === 'string' && value.trim()) return true
				if (options.operation === 'create' && options.req?.context?.importing !== true) return true
				return 'A slug is required'
			},
		},
	}
}

export const fillEditorialIdentity =
	(slug: string, singular: string): CollectionBeforeValidateHook =>
	async ({ data, operation, req }) => {
		if (operation !== 'create' || !data || req.context?.importing === true) return data
		if (!data.legacyId) data.legacyId = `payload:${slug}:${crypto.randomUUID()}`
		if (!data.legacyType) data.legacyType = singular
		if (typeof data.slug === 'string' && data.slug.trim()) return data
		const source = titleKeys.map(key => data[key]).find(value => typeof value === 'string' && value.trim()) as string | undefined
		const base = slugify(source ?? '') || slugify(String(data.legacyId).split(':').pop() ?? '') || slug
		// Best effort: the slug index is not unique for most collections, so a
		// concurrent create can still collide. That is a UX issue, not a crash.
		let candidate = base
		for (let attempt = 2; attempt <= 8; attempt += 1) {
			const taken = await req.payload.count({ collection: slug as never, where: { slug: { equals: candidate } }, overrideAccess: true, req })
			if (!taken.totalDocs) break
			candidate = attempt < 8 ? `${base}-${attempt}` : `${base}-${crypto.randomUUID().slice(0, 8)}`
		}
		data.slug = candidate
		return data
	}
