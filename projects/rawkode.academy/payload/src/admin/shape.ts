import type { CollectionConfig, Field } from 'payload'

// Projects only the parts of a collection config that reach D1 or the stored
// document shape. Admin-only keys (labels, descriptions, tabs, rows,
// collapsibles, conditions, components, validate, function defaults) are
// ignored, so the admin experience can change freely while this stays fixed.
export type DataField = {
	name: string
	type: string
	dbName?: string
	hasMany?: boolean
	relationTo?: string | string[]
	required?: boolean
	unique?: boolean
	index?: boolean
	options?: string[]
	virtual?: boolean | string
	defaultValue?: unknown
	min?: number
	fields?: DataField[]
}

export type CollectionShape = {
	slug: string
	timestamps: boolean
	drafts: boolean
	maxPerDoc?: number
	auth: boolean
	upload: boolean
	indexes: unknown[]
	fields: DataField[]
}

const optionValue = (option: unknown): string => (typeof option === 'string' ? option : String((option as { value: unknown }).value))

export function flattenFields(fields: Field[]): DataField[] {
	const out: DataField[] = []
	for (const field of fields) {
		if (field.type === 'ui') continue
		if (field.type === 'row' || field.type === 'collapsible') {
			out.push(...flattenFields(field.fields))
			continue
		}
		if (field.type === 'tabs') {
			for (const tab of field.tabs) {
				if ('name' in tab && tab.name) out.push({ name: tab.name, type: 'tab', fields: flattenFields(tab.fields) })
				else out.push(...flattenFields(tab.fields))
			}
			continue
		}
		if (field.type === 'group' && !('name' in field && field.name)) {
			out.push(...flattenFields(field.fields))
			continue
		}
		if (!('name' in field) || !field.name) continue
		const record = field as unknown as Record<string, unknown>
		const data: DataField = { name: field.name, type: field.type }
		for (const key of ['dbName', 'hasMany', 'relationTo', 'required', 'unique', 'index', 'virtual', 'min'] as const) {
			if (record[key] !== undefined && record[key] !== false) (data as Record<string, unknown>)[key] = record[key]
		}
		if (record.defaultValue !== undefined && typeof record.defaultValue !== 'function') data.defaultValue = record.defaultValue
		if (field.type === 'select' || field.type === 'radio') data.options = field.options.map(optionValue)
		if ('fields' in field && Array.isArray(field.fields)) data.fields = flattenFields(field.fields)
		out.push(data)
	}
	return out.sort((left, right) => left.name.localeCompare(right.name))
}

export function flattenDataShape(collections: CollectionConfig[]): CollectionShape[] {
	return collections
		.map(collection => {
			const versions = collection.versions
			const drafts = typeof versions === 'object' && versions !== null && Boolean(versions.drafts)
			return {
				slug: collection.slug,
				timestamps: collection.timestamps !== false,
				drafts,
				...(typeof versions === 'object' && versions?.maxPerDoc !== undefined ? { maxPerDoc: versions.maxPerDoc } : {}),
				auth: Boolean(collection.auth),
				upload: Boolean(collection.upload),
				indexes: collection.indexes ?? [],
				fields: flattenFields(collection.fields),
			}
		})
		.sort((left, right) => left.slug.localeCompare(right.slug))
}
