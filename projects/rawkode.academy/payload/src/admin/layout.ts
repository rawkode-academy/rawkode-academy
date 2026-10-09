import type { Condition, Field, Tab } from 'payload'
import type { AdminAccess } from './access'
import { advanced, collapsible, decorate, readOnlyAll, sourceTab } from './fields'

// Arranges a collection's flat field list into the edit view: editorial
// fields first in unnamed tabs, status and dates in the sidebar, provenance in
// a developer-only Source tab. Field names, types and stored shape are not
// touched; only presentation changes.

export const provenanceNames = new Set([
	'legacyId',
	'legacyType',
	'sourceSystem',
	'sourceRevision',
	'sourceHash',
	'mappingVersion',
	'importedAt',
	'importState',
	'locallyEdited',
	'sourceSequence',
	'sourceFields',
	'sourceOrder',
	'sourcePath',
	'sourceFormat',
	'sourceData',
	'sourceRaw',
	'sourceBody',
	'sourceAssets',
	'editorialData',
	// Importer reconciliation hides records with it. Editors unpublish with
	// Draft status instead, so it stays read-only and developer-only.
	'tombstone',
])
// Klustered source-system foreign keys and timestamps.
const sourceReference = /^source([A-Z]\w*Id|CreatedAt|UpdatedAt)$/

const sidebarOrder = [
	'type',
	'category',
	'status',
	'kind',
	'format',
	'entryType',
	'difficulty',
	'howto',
	'order',
	'section',
	'publishedAt',
	'date',
	'adoptedAt',
	'updatedAt',
	'startDate',
	'endDate',
	'startsAt',
	'endsAt',
	'registrationClosesAt',
	'scheduledAt',
	'startedAt',
	'endedAt',
	'submittedAt',
	'reviewedAt',
	'recordedAt',
	'revokedAt',
	'slug',
]
const sidebarNames = new Set(sidebarOrder)
const mediaNames = new Set([
	'youtubeId',
	'thumbnailUrl',
	'streamUrl',
	'mediaReference',
	'duration',
	'audioFileSize',
	'realtimeKit',
	'avatarUrl',
	'icon',
	'logo',
	'logos',
])
const titleNames = ['title', 'name', 'displayName', 'code', 'quote', 'label']

export type LayoutOptions = {
	// Hidden virtual title fields, kept outside the tabs.
	top?: Field[]
	// Grouped inside the Content tab, in order: { 'Social': ['github', ...] }.
	collapsibles?: Record<string, string[]>
	rows?: string[][]
	processing?: { fields: Field[]; condition?: Condition }
	review?: Field[]
	fieldAdmin?: Record<string, Record<string, unknown>>
	sidebarDescriptions?: Record<string, string>
}

const nameOf = (field: Field): string => ('name' in field && typeof field.name === 'string' ? field.name : '')

export function arrange(fields: Field[], access: AdminAccess, options: LayoutOptions = {}): Field[] {
	const source: Field[] = []
	const sidebar: Field[] = []
	const media: Field[] = []
	const relations: Field[] = []
	const content: Field[] = []
	const tweak = (field: Field): Field => {
		const name = nameOf(field)
		const extra = options.fieldAdmin?.[name]
		const description = options.sidebarDescriptions?.[name]
		let next = decorate(field)
		if (extra || description) next = { ...next, admin: { ...(next.admin ?? {}), ...extra, ...(description ? { description } : {}) } } as Field
		return next
	}
	for (const field of fields) {
		const name = nameOf(field)
		if (provenanceNames.has(name) || sourceReference.test(name)) source.push(field)
		else if (sidebarNames.has(name)) sidebar.push(field)
		else if (mediaNames.has(name)) media.push(tweak(field))
		else if (field.type === 'relationship' || field.type === 'upload') relations.push(tweak(field))
		else content.push(tweak(field))
	}

	const grouped = new Set([...Object.values(options.collapsibles ?? {}).flat(), ...(options.rows ?? []).flat()])
	const titleFirst = [...content].sort((left, right) => {
		const rank = (field: Field) => {
			const index = titleNames.indexOf(nameOf(field))
			return index === -1 ? titleNames.length : index
		}
		return rank(left) - rank(right)
	})
	const plain = titleFirst.filter(field => !grouped.has(nameOf(field)) && field.type !== 'json')
	const json = titleFirst.filter(field => !grouped.has(nameOf(field)) && field.type === 'json')
	const pick = (names: string[]) => names.map(name => content.find(field => nameOf(field) === name)).filter((field): field is Field => Boolean(field))
	const rows: Field[] = (options.rows ?? []).map(names => ({ type: 'row', fields: pick(names) }))
	const collapsibles = Object.entries(options.collapsibles ?? {}).flatMap(([label, names]) => collapsible(label, pick(names)))
	const [first, ...rest] = plain
	const contentFields = [...(first ? [first] : []), ...rows, ...rest, ...collapsibles, ...advanced(json)]

	const mediaPlain = media.filter(field => field.type !== 'json')
	const mediaJson = media.filter(field => field.type === 'json')
	// Join records (applications, team members) have no title of their own:
	// what they connect is the content, so Relations leads.
	const titled = content.some(field => titleNames.includes(nameOf(field)))
	const editorial: Tab[] = [
		{ label: 'Content', fields: contentFields },
		{ label: 'Relations', fields: relations },
	]
	const tabs: Tab[] = [
		...(titled || !relations.length ? editorial : editorial.reverse()),
		{ label: 'Media', fields: [...mediaPlain, ...advanced(mediaJson)] },
		...(options.processing
			? [
					{
						label: 'Processing',
						description: 'Written by the media pipeline. Approve through the pipeline, not by editing.',
						...(options.processing.condition ? { admin: { condition: options.processing.condition } } : {}),
						fields: readOnlyAll(options.processing.fields.map(decorate)),
					},
				]
			: []),
		...(options.review ? [{ label: 'Review', fields: options.review }] : []),
		...(source.length ? [sourceTab(source, access)] : []),
	].filter(tab => tab.fields.length > 0)

	const sidebarFields = [...sidebar]
		.sort((left, right) => sidebarOrder.indexOf(nameOf(left)) - sidebarOrder.indexOf(nameOf(right)))
		.map(field => {
			const next = tweak(field)
			return { ...next, admin: { ...(next.admin ?? {}), position: 'sidebar' } } as Field
		})

	return [...(options.top ?? []), { type: 'tabs', tabs }, ...sidebarFields]
}
