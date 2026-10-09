import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { importMapKeys, missingFromImportMap, requiredComponentPaths } from '../src/admin/component-paths'
import { monogramPaths, monogramViewBox, wordmarkPaths, wordmarkViewBox } from '../src/admin/graphics/paths'
import { createCollections } from '../src/collections'

const read = (path: string) => readFile(new URL(path, import.meta.url), 'utf8')

test('the committed importMap covers every admin component path', async () => {
	const collections = createCollections({ localAuth: false } as never, {} as never)
	const source = await read('../app/(payload)/admin/importMap.js')
	assert.deepEqual(missingFromImportMap(collections, source), [])
	const required = requiredComponentPaths(collections)
	for (const path of [
		'./src/admin/graphics/Logo#Logo',
		'./src/admin/views/ReviewQueue#ReviewQueueView',
		'./src/admin/fields/ReviewFreeze#VideoPublishControl',
		'./src/admin/fields/ReviewFreeze#VideoSaveDraftControl',
		'./src/admin/fields/ReviewFreeze#ReviewFreezeNotice',
		'./src/admin/fields/ReviewPanel#ReviewPanel',
	]) {
		assert.ok(required.includes(path), `${path} is not registered`)
	}
	assert.ok(importMapKeys(source).includes('@payloadcms/next/rsc#CollectionCards'))
})

test('Logo and Icon use the canonical website brand SVG paths', async () => {
	const svg = async (name: string) => {
		const text = await read(`../../website/src/components/branding/logos/${name}.svg`)
		return { viewBox: /viewBox="([^"]+)"/.exec(text)?.[1], paths: [...text.matchAll(/<path[^>]*\sd="([^"]+)"/g)].map(match => match[1]) }
	}
	assert.deepEqual(await svg('wordmark'), { viewBox: wordmarkViewBox, paths: wordmarkPaths })
	assert.deepEqual(await svg('monogram'), { viewBox: monogramViewBox, paths: monogramPaths })
})
