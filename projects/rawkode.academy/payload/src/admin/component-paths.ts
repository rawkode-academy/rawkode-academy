import type { CollectionConfig, Field } from 'payload'
import { adminComponentPaths } from './config'

// Collects every custom component path the admin can render, so a missing
// importMap entry fails CI instead of silently dropping the component in the
// production Worker bundle.
function fieldPaths(fields: Field[]): string[] {
	const out: string[] = []
	for (const field of fields) {
		const components = (field.admin as { components?: Record<string, unknown> } | undefined)?.components ?? {}
		for (const value of Object.values(components)) if (typeof value === 'string') out.push(value)
		if ('fields' in field && Array.isArray(field.fields)) out.push(...fieldPaths(field.fields))
		if (field.type === 'tabs') for (const tab of field.tabs) out.push(...fieldPaths(tab.fields))
	}
	return out
}

export function collectionComponentPaths(collections: CollectionConfig[]): string[] {
	return collections.flatMap(collection => {
		const components = collection.admin?.components as Record<string, unknown> | undefined
		const edit = (components?.edit ?? {}) as Record<string, unknown>
		const strings = Object.values(edit).filter((value): value is string => typeof value === 'string')
		return [...strings, ...fieldPaths(collection.fields)]
	})
}

export function requiredComponentPaths(collections: CollectionConfig[]): string[] {
	return [...new Set([...adminComponentPaths(), ...collectionComponentPaths(collections)])].sort()
}

export function importMapKeys(source: string): string[] {
	return [...source.matchAll(/^\s*"([^"]+)":/gm)].map(match => match[1])
}

export function missingFromImportMap(collections: CollectionConfig[], importMapSource: string): string[] {
	const keys = new Set(importMapKeys(importMapSource))
	return requiredComponentPaths(collections).filter(path => !keys.has(path))
}
