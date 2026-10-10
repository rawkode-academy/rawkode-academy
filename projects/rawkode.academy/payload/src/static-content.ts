import { createHash } from 'node:crypto'
import { lstat, readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import matter from 'gray-matter'
import { parse as parseYaml } from 'yaml'
import type { ContentReference, ImportRecord, ImportSnapshot, SourceAsset } from './import-types'

export type StaticAssetFile = SourceAsset & { absolutePath: string; alt?: string }
export type StaticContentSnapshot = ImportSnapshot & { assetFiles: StaticAssetFile[] }

type Format = 'md' | 'mdx' | 'yaml' | 'yml'
type SourceFile = {
  absolutePath: string
  relativePath: string
  format: Format
  data: Record<string, unknown>
  body: string
  raw: string
  checksum: string
  assets: StaticAssetFile[]
}

const specs = [
  { collection: 'videos', directory: 'videos', formats: ['md', 'mdx'] as Format[] },
  { collection: 'shows', directory: 'shows', formats: ['md', 'mdx'] as Format[] },
  { collection: 'people', directory: 'people', formats: ['md', 'mdx'] as Format[] },
  { collection: 'articles', directory: 'articles', formats: ['md', 'mdx'] as Format[] },
  { collection: 'technologies', directory: 'technologies', formats: ['md', 'mdx'] as Format[] },
  { collection: 'series', directory: 'series', formats: ['mdx'] as Format[] },
  { collection: 'adrs', directory: 'adrs', formats: ['md'] as Format[] },
  { collection: 'testimonials', directory: 'testimonials', formats: ['yaml', 'yml'] as Format[] },
  { collection: 'courses', directory: 'courses', formats: ['md', 'mdx'] as Format[] },
  { collection: 'changelog', directory: 'changelog', formats: ['md', 'mdx'] as Format[] },
  { collection: 'learning-paths', directory: 'learning-paths', formats: ['md', 'mdx'] as Format[] },
  { collection: 'news', directory: 'news', formats: ['md', 'mdx'] as Format[] },
] as const

const assetMimeTypes: Record<string, string> = {
  '.avif': 'image/avif', '.gif': 'image/gif', '.jpeg': 'image/jpeg', '.jpg': 'image/jpeg', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.ico': 'image/x-icon', '.mp4': 'video/mp4', '.webm': 'video/webm', '.woff': 'font/woff', '.woff2': 'font/woff2',
}
const staticFileMimeTypes: Record<string, string> = {
  ...assetMimeTypes,
  '.css': 'text/css', '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.py': 'text/x-python', '.sh': 'text/x-shellscript',
  '.ts': 'text/typescript', '.tsx': 'text/typescript', '.toml': 'application/toml', '.yaml': 'application/yaml', '.yml': 'application/yaml', '.txt': 'text/plain',
}
const inlineDemoExtensions = new Set(['.astro','.c','.cc','.cpp','.cs','.cjs','.css','.go','.graphql','.h','.hpp','.html','.java','.js','.json','.jsonc','.jsx','.md','.mdx','.mjs','.php','.py','.rb','.rs','.sh','.sql','.svg','.toml','.ts','.tsx','.txt','.vue','.xml','.yaml','.yml'])
const inlineDemoNames = new Set(['dockerfile','license','makefile'])
const maxInlineDemoFiles = 100
const maxInlineDemoFileBytes = 256 * 1024
const maxInlineDemoBytes = 1024 * 1024
const maxInlineDemoPathLength = 240
const directKeys = new Set([
  'title', 'name', 'description', 'subtitle', 'tagline', 'forename', 'surname', 'github', 'twitter', 'bluesky', 'mastodon', 'linkedin', 'website', 'youtube',
  'githubHandle', 'githubUrl', 'avatarUrl', 'biography', 'quote', 'category', 'subcategory', 'documentation', 'icon', 'logo', 'source', 'license', 'status', 'terms',
  'aliases', 'features', 'relatedTechnologies', 'useCases', 'publishedAt', 'date', 'adoptedAt', 'duration', 'audioFileSize', 'type', 'howto',
  'youtubeId', 'streamUrl', 'thumbnailUrl', 'mediaReference', 'realtimeKit', 'podcast', 'subscribeLinks', 'gameFormatUrl', 'code', 'order', 'section',
  'difficulty', 'estimatedDuration', 'prerequisites', 'learningPath', 'pullRequest', 'links', 'cncf', 'community', 'matrix', 'seo', 'logos',
])

function normalise(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value)) return value.map(normalise)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, normalise(child)]))
  return value
}

function sha256(value: string | Uint8Array): string {
  return createHash('sha256').update(value).digest('hex')
}

function sourceId(relativePath: string): string {
  const withoutExtension = relativePath.replace(/\.(?:md|mdx|yaml|yml)$/i, '')
  return withoutExtension.endsWith('/index') ? withoutExtension.slice(0, -'/index'.length) : withoutExtension
}

function cleanReference(value: unknown): string | null {
  if (typeof value === 'string') {
    const cleaned = value.replace(/^\.\//, '').replace(/\/index$/, '')
    return cleaned.replace(/^(?:people|technologies|videos|shows|series)\//, '') || null
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return cleanReference(record.id ?? record.slug ?? record.value)
  }
  return null
}

function reference(collection: ContentReference['collection'], value: unknown): ContentReference | null {
  const legacyId = cleanReference(value)
  return legacyId ? { collection, legacyId } : null
}

function references(collection: ContentReference['collection'], value: unknown, defaultValue: unknown[] = []): ContentReference[] {
  const input = Array.isArray(value) ? value : value == null ? defaultValue : [value]
  return input.map(item => reference(collection, item)).filter((item): item is ContentReference => Boolean(item))
}

function rows(value: unknown): { value: string }[] {
  if (!Array.isArray(value)) return []
  return value.map(item => typeof item === 'string' ? { value: item } : { value: String((item as Record<string, unknown>)?.value ?? item) })
}

function urls(value: unknown): { url: string }[] {
  if (!Array.isArray(value)) return []
  return value.map(item => typeof item === 'string' ? { url: item } : { url: String((item as Record<string, unknown>)?.url ?? item) })
}

async function walk(directory: string): Promise<string[]> {
  try {
    const entries = await readdir(directory, { withFileTypes: true })
    const files: string[] = []
    for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue
      const absolutePath = path.join(directory, entry.name)
      if (entry.isDirectory()) files.push(...await walk(absolutePath))
      else if (entry.isFile()) files.push(absolutePath)
    }
    return files
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }
}

function isAsset(file: string): boolean {
  return Boolean(assetMimeTypes[path.extname(file).toLowerCase()])
}

function isStaticResource(file: string): boolean {
  return !file.split(path.sep).includes('examples') && Boolean(staticFileMimeTypes[path.extname(file).toLowerCase()])
}

function localAssetReferences(data: unknown, output = new Set<string>()): Set<string> {
  if (typeof data === 'string' && /^\.\.?\//.test(data) && isAsset(data)) output.add(data)
  else if (Array.isArray(data)) for (const child of data) localAssetReferences(child, output)
  else if (data && typeof data === 'object') for (const child of Object.values(data)) localAssetReferences(child, output)
  return output
}

async function assetsFor(source: SourceFile, contentRoot: string, collection: string): Promise<StaticAssetFile[]> {
  const candidates = new Set<string>(localAssetReferences(source.data))
  const pattern = /(?:^|[('" ])(\.\.?\/[^'" )]+\.(?:avif|gif|jpe?g|png|svg|webp|mp4|webm|woff2?))/gi
  for (const match of source.body.matchAll(pattern)) if (match[1]) candidates.add(match[1])
  const sourceDirectory = path.dirname(source.absolutePath)
  const includeDirectory = path.basename(source.relativePath).startsWith('index.') || collection === 'technologies' || collection === 'shows'
  const paths = includeDirectory
    ? (await walk(sourceDirectory)).filter(file => isAsset(file))
    : [...candidates].map(candidate => path.resolve(sourceDirectory, candidate)).filter(file => file.startsWith(`${contentRoot}${path.sep}`))
  const unique = [...new Set(paths)].filter(file => !path.relative(contentRoot, file).split(path.sep).includes('examples')).sort()
  const result: StaticAssetFile[] = []
  for (const absolutePath of unique) {
    const asset = await staticFileFor(absolutePath, contentRoot)
    if (asset) result.push(asset)
  }
  return result
}

async function staticFileFor(absolutePath: string, contentRoot: string): Promise<StaticAssetFile | null> {
  const file = await stat(absolutePath).catch(() => null)
  if (!file?.isFile()) return null
  const bytes = await readFile(absolutePath)
  const relativePath = path.relative(contentRoot, absolutePath).split(path.sep).join('/')
  const checksum = sha256(bytes)
  return { absolutePath, relativePath, r2Key: `static/${checksum.slice(0, 16)}/${relativePath}`, mimeType: staticFileMimeTypes[path.extname(relativePath).toLowerCase()] ?? 'application/octet-stream', bytes: file.size, checksum }
}

async function readSource(absolutePath: string, contentRoot: string, collection: string): Promise<SourceFile> {
  const raw = await readFile(absolutePath, 'utf8')
  const relativePath = path.relative(contentRoot, absolutePath).split(path.sep).join('/')
  const extension = path.extname(absolutePath).slice(1).toLowerCase() as Format
  const parsed = extension === 'yaml' || extension === 'yml' ? { data: parseYaml(raw) ?? {}, content: '' } : matter(raw)
  const data = normalise(parsed.data) as Record<string, unknown>
  const source: SourceFile = { absolutePath, relativePath, format: extension, data, body: parsed.content, raw, checksum: sha256(raw), assets: [] }
  source.assets = await assetsFor(source, contentRoot, collection)
  return source
}

function statusFor(collection: string, data: Record<string, unknown>): 'draft' | 'published' {
  // Astro creates public article routes regardless of the legacy draft metadata.
  if (collection === 'articles') return 'published'
  if (data.draft === true) return 'draft'
  if (collection === 'shows' && data.publish === false) return 'draft'
  return 'published'
}

function directData(collection: string, source: SourceFile): Record<string, unknown> {
  const input = source.data
  const data: Record<string, unknown> = { body: source.body }
  for (const key of directKeys) if (key in input) data[key] = input[key]
  for (const key of ['terms', 'whatYouWillLearn', 'aliases', 'features', 'relatedTechnologies', 'useCases', 'prerequisites', 'learningPath']) if (key in input) data[key] = rows(input[key])
  if (Array.isArray(input.links)) data.links = input.links
  if (input.cover && typeof input.cover === 'object') data.cover = input.cover
  if ('resources' in input) data.contentResources = input.resources
  if (collection === 'testimonials' && input.author) data.author = input.author
  if (collection === 'videos' && typeof input.id === 'string') {
    data.streamUrl = `https://content.rawkode.academy/videos/${input.id}/stream.m3u8`
    data.thumbnailUrl = `https://content.rawkode.academy/videos/${input.id}/thumbnail.webp`
  }
  return data
}

function relationsFor(collection: string, source: SourceFile): Record<string, ContentReference | ContentReference[] | null> {
  const input = source.data
  const relationships: Record<string, ContentReference | ContentReference[] | null> = {}
  const addMany = (field: string, target: ContentReference['collection'], value: unknown, defaults?: unknown[]) => {
    const valueReferences = references(target, value, defaults)
    if (valueReferences.length || value !== undefined || defaults) relationships[field] = valueReferences
  }
  const addOne = (field: string, target: ContentReference['collection'], value: unknown) => {
    if (value !== undefined) relationships[field] = reference(target, value)
  }
  if (['articles', 'courses', 'course-modules', 'learning-paths', 'adrs', 'news'].includes(collection)) addMany('authors', 'people', input.authors, ['rawkode'])
  if (collection === 'changelog') addOne('author', 'people', input.author ?? 'rawkode')
  if (collection === 'videos') {
    addMany('technologies', 'technologies', input.technologies)
    addMany('guests', 'people', input.guests)
    addOne('show', 'shows', input.show)
    addOne('episode', 'episodes', input.episode)
  }
  if (collection === 'shows') addMany('hosts', 'people', input.hosts)
  if (collection === 'articles') {
    addMany('technologies', 'technologies', input.technologies)
    addOne('series', 'series', input.series)
  }
  if (collection === 'courses') addMany('technologies', 'technologies', input.technologies)
  if (collection === 'course-modules') {
    addOne('course', 'courses', input.course ?? source.relativePath.split('/')[1])
    addOne('video', 'videos', (input.video as Record<string, unknown> | undefined)?.id)
  }
  if (collection === 'learning-paths') {
    addMany('technologies', 'technologies', input.technologies)
    addMany('courses', 'courses', input.courses)
    addMany('videos', 'videos', input.videos)
  }
  if (collection === 'news') addMany('technologies', 'technologies', input.technologies)
  return relationships
}

function validDemoPath(value: string): boolean {
  if (!value || value.length > maxInlineDemoPathLength || value.startsWith('/') || value.includes('\\') || /[\u0000-\u001f\u007f]/.test(value)) return false
  const segments = value.split('/')
  return segments.every(segment => segment && segment !== '.' && segment !== '..' && !segment.startsWith('.'))
}

function isInlineDemoFile(value: string): boolean {
  return inlineDemoExtensions.has(path.extname(value).toLowerCase()) || inlineDemoNames.has(path.basename(value).toLowerCase())
}

async function inlineDemoForResource(source: SourceFile, contentRoot: string, resource: Record<string, unknown>): Promise<{ files: Record<string, string>; startCommand?: string }> {
  const embedConfig = resource.embedConfig as Record<string, unknown> | undefined
  const resourceSlug = typeof embedConfig?.src === 'string' ? embedConfig.src : ''
  const importConfig = embedConfig?.import as Record<string, unknown> | undefined
  const localDir = typeof importConfig?.localDir === 'string' ? importConfig.localDir : ''
  if (!resourceSlug || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$/.test(resourceSlug) || resourceSlug === '.' || resourceSlug === '..') {
    throw new Error(`Invalid WebContainer resource slug in ${source.relativePath}`)
  }
  if (!localDir || localDir.length > maxInlineDemoPathLength || localDir.includes('\\') || /[\u0000-\u001f\u007f]/.test(localDir) || path.isAbsolute(localDir)) {
    throw new Error(`WebContainer resource ${resourceSlug} in ${source.relativePath} must provide a safe import.localDir`)
  }
  const sourceParts = source.relativePath.split('/')
  if (sourceParts[0] !== 'courses' || !sourceParts[1]) throw new Error(`WebContainer module is outside courses/: ${source.relativePath}`)
  const courseSlug = sourceParts[1]
  const examplesRoot = path.resolve(contentRoot, 'courses', courseSlug, 'examples')
  const demoDirectory = path.resolve(path.dirname(source.absolutePath), localDir)
  const relativeDirectory = path.relative(examplesRoot, demoDirectory)
  const exampleSegments = relativeDirectory.split(path.sep)
  const [courseStat, examplesStat, demoStat] = await Promise.all([
    lstat(path.resolve(contentRoot, 'courses', courseSlug)).catch(() => null),
    lstat(examplesRoot).catch(() => null),
    lstat(demoDirectory).catch(() => null),
  ])
  if (!relativeDirectory || relativeDirectory === '..' || relativeDirectory.startsWith(`..${path.sep}`) || path.isAbsolute(relativeDirectory) || exampleSegments.length !== 1 || exampleSegments.some(part => !part || part === '.' || part === '..' || part.startsWith('.')) || path.basename(demoDirectory) !== resourceSlug || !courseStat || !courseStat.isDirectory() || courseStat.isSymbolicLink() || !examplesStat || !examplesStat.isDirectory() || examplesStat.isSymbolicLink() || !demoStat || !demoStat.isDirectory() || demoStat.isSymbolicLink()) {
    throw new Error(`WebContainer resource ${resourceSlug} in ${source.relativePath} must resolve to its course examples/${resourceSlug} directory`)
  }

  const files: Record<string, string> = {}
  let totalBytes = 0
  let webContainerConfig: Record<string, unknown> = {}
  const absoluteFiles = await walk(demoDirectory)
  if (!absoluteFiles.length) throw new Error(`WebContainer example directory is empty: ${path.relative(contentRoot, demoDirectory)}`)
  for (const absolutePath of absoluteFiles) {
    const relative = path.relative(demoDirectory, absolutePath).split(path.sep).join('/')
    if (relative === '.webcontainer.json') {
      const bytes = await readFile(absolutePath)
      if (bytes.byteLength > 16 * 1024) throw new Error(`WebContainer config exceeds 16 KiB: ${relative}`)
      try {
        const parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as unknown
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) webContainerConfig = parsed as Record<string, unknown>
      } catch (error) {
        throw new Error(`Invalid WebContainer config in ${path.relative(contentRoot, absolutePath)}: ${String(error)}`)
      }
      continue
    }
    if (!validDemoPath(relative) || !isInlineDemoFile(relative)) {
      throw new Error(`Unsupported WebContainer example file: ${path.relative(contentRoot, absolutePath)}`)
    }
    if (Object.keys(files).length >= maxInlineDemoFiles) throw new Error(`WebContainer example exceeds ${maxInlineDemoFiles} files: ${path.relative(contentRoot, demoDirectory)}`)
    const bytes = await readFile(absolutePath)
    if (bytes.byteLength > maxInlineDemoFileBytes) throw new Error(`WebContainer example file exceeds ${maxInlineDemoFileBytes} bytes: ${path.relative(contentRoot, absolutePath)}`)
    totalBytes += bytes.byteLength
    if (totalBytes > maxInlineDemoBytes) throw new Error(`WebContainer example exceeds ${maxInlineDemoBytes} total bytes: ${path.relative(contentRoot, demoDirectory)}`)
    files[relative] = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  }
  if (!Object.keys(files).length) throw new Error(`WebContainer example has no inline text files: ${path.relative(contentRoot, demoDirectory)}`)
  const configuredCommand = webContainerConfig.startCommand
  const authoredCommand = embedConfig?.startCommand
  const startCommand = typeof configuredCommand === 'string' && configuredCommand.trim() && configuredCommand.length <= 200 && !/[\u0000-\u001f\u007f]/.test(configuredCommand)
    ? configuredCommand
    : typeof authoredCommand === 'string' && authoredCommand.trim() && authoredCommand.length <= 200 && !/[\u0000-\u001f\u007f]/.test(authoredCommand)
      ? authoredCommand
      : undefined
  return { files, ...(startCommand ? { startCommand } : {}) }
}

async function inlineWebContainerResources(source: SourceFile, contentRoot: string): Promise<unknown> {
  if (!Array.isArray(source.data.resources)) return source.data.resources
  const resources: unknown[] = []
  for (const value of source.data.resources) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      resources.push(value)
      continue
    }
    const resource = value as Record<string, unknown>
    const embedConfig = resource.embedConfig && typeof resource.embedConfig === 'object' && !Array.isArray(resource.embedConfig)
      ? resource.embedConfig as Record<string, unknown>
      : undefined
    if (embedConfig?.container !== 'webcontainer') {
      resources.push(value)
      continue
    }
    const demo = await inlineDemoForResource(source, contentRoot, resource)
    const { import: _import, files: _oldFiles, startCommand: _oldCommand, ...publicConfig } = embedConfig
    resources.push({ ...resource, embedConfig: { ...publicConfig, files: demo.files, ...(demo.startCommand ? { startCommand: demo.startCommand } : {}) } })
  }
  return resources
}

async function contentRecord(collection: string, source: SourceFile, contentRoot: string): Promise<ImportRecord> {
  const input = source.data
  const legacyId = typeof input.id === 'string' && input.id.trim() ? input.id : sourceId(source.relativePath.replace(new RegExp(`^${collection === 'course-modules' ? 'courses' : collection}/`), ''))
  const slug = typeof input.slug === 'string' && input.slug.trim() ? input.slug : legacyId
  const data = directData(collection, source)
  if (collection === 'course-modules' && 'resources' in input) data.contentResources = await inlineWebContainerResources(source, contentRoot)
  return {
    collection: collection as ImportRecord['collection'], legacyId, slug,
    sourceRevision: source.checksum, status: statusFor(collection, input), data, relationships: relationsFor(collection, source),
    source: { path: source.relativePath, assets: source.assets.map(({ absolutePath: _absolutePath, ...asset }) => asset) },
  }
}

function derivedChapterRecords(source: SourceFile, video: ImportRecord): ImportRecord[] {
  const chapters = Array.isArray(source.data.chapters) ? source.data.chapters : []
  return chapters.map((chapter, index) => {
    const value = chapter as Record<string, unknown>
    const legacyId = `${video.legacyId}-chapter-${index}`
    return {
      collection: 'chapters', legacyId, slug: legacyId, sourceRevision: source.checksum, status: video.status,
      data: { title: String(value.title ?? `Chapter ${index + 1}`), startTime: Number(value.startTime ?? 0) },
      source: { path: `${source.relativePath}#chapters/${index}` },
    }
  })
}

function episodeCode(slug: string): string {
  const match = slug.match(/(?:s(\d+))?e(\d+)/i)
  if (!match?.[2]) return slug
  const episode = `E${match[2].padStart(2, '0')}`
  return match[1] ? `S${match[1].padStart(2, '0')}${episode}` : episode
}

function derivedEpisodeRecord(source: SourceFile, video: ImportRecord): ImportRecord | null {
  const show = video.relationships?.show
  if (!show || Array.isArray(show)) return null
  const legacyId = `${show.legacyId}-${video.legacyId}`
  return {
    collection: 'episodes', legacyId, slug: legacyId, sourceRevision: video.sourceRevision, status: video.status,
    data: { code: episodeCode(video.slug), terms: rows(source.data.terms) },
    relationships: { video: { collection: 'videos', legacyId: video.legacyId }, show },
    source: { path: `${source.relativePath}#episode` },
  }
}

function derivedResourceRecord(source: SourceFile, technology: ImportRecord): ImportRecord | null {
  const value = source.data.learningResources
  if (!value || typeof value !== 'object') return null
  const input = value as Record<string, unknown>
  if (!Object.values(input).some(item => Array.isArray(item) && item.length)) return null
  const legacyId = `${technology.legacyId}:learning-resources`
  return {
    collection: 'learning-resources', legacyId, slug: legacyId, sourceRevision: source.checksum, status: technology.status,
    data: { title: `${String(source.data.name ?? technology.legacyId)} learning resources`, official: urls(input.official), community: urls(input.community), tutorials: urls(input.tutorials) },
    source: { path: `${source.relativePath}#learning-resources` },
  }
}

function assetRecord(asset: StaticAssetFile): ImportRecord {
  return {
    collection: 'static-assets', legacyId: asset.relativePath, slug: asset.relativePath, sourceRevision: asset.checksum, status: 'published',
    data: { r2Key: asset.r2Key, mimeType: asset.mimeType, bytes: asset.bytes, checksum: asset.checksum },
    source: { path: asset.relativePath },
  }
}

export async function buildStaticSnapshot(options: { root: string; sequence?: number; mappingVersion?: string }): Promise<StaticContentSnapshot> {
  const contentRoot = path.resolve(options.root)
  const files: { collection: string; source: SourceFile }[] = []
  for (const spec of specs) {
    const candidates = await walk(path.join(contentRoot, spec.directory))
    for (const absolutePath of candidates) {
      const extension = path.extname(absolutePath).slice(1).toLowerCase() as Format
      if (!spec.formats.includes(extension)) continue
      const relative = path.relative(contentRoot, absolutePath).split(path.sep).join('/')
      const relativeToCollection = path.relative(path.join(contentRoot, spec.directory), absolutePath).split(path.sep).join('/')
      const collection = spec.collection === 'courses' && relativeToCollection.includes('/') ? 'course-modules' : spec.collection
      if (spec.collection === 'courses' && collection === 'course-modules' && relativeToCollection.split('/').length !== 2) continue
      files.push({ collection, source: await readSource(absolutePath, contentRoot, collection) })
    }
  }
  const records: ImportRecord[] = []
  const assetFiles = new Map<string, StaticAssetFile>()
  for (const { collection, source } of files) {
    const record = await contentRecord(collection, source, contentRoot)
    records.push(record)
    for (const asset of source.assets) if (!asset.relativePath.split('/').includes('examples')) assetFiles.set(asset.relativePath, asset)
    if (collection === 'videos') {
      for (const chapter of derivedChapterRecords(source, record)) {
        record.relationships = { ...(record.relationships ?? {}), chapters: [...((record.relationships?.chapters as ContentReference[] | undefined) ?? []), { collection: 'chapters', legacyId: chapter.legacyId }] }
        records.push(chapter)
      }
      const episode = derivedEpisodeRecord(source, record)
      if (episode) {
        record.relationships = { ...(record.relationships ?? {}), episode: { collection: 'episodes', legacyId: episode.legacyId } }
        records.push(episode)
      }
    }
    if (collection === 'technologies') {
      const resources = derivedResourceRecord(source, record)
      if (resources) {
        record.relationships = { ...(record.relationships ?? {}), learningResources: { collection: 'learning-resources', legacyId: resources.legacyId } }
        records.push(resources)
      }
    }
  }
  for (const directory of [...new Set(specs.map(spec => spec.directory))]) {
    for (const absolutePath of await walk(path.join(contentRoot, directory))) {
      if (!isStaticResource(absolutePath)) continue
      const asset = await staticFileFor(absolutePath, contentRoot)
      if (asset) assetFiles.set(asset.relativePath, asset)
    }
  }
  records.push(...[...assetFiles.values()].sort((left, right) => left.relativePath.localeCompare(right.relativePath)).map(assetRecord))
  const configuredSequence = Number(process.env.STATIC_CONTENT_SEQUENCE ?? 1)
  const sequence = options.sequence ?? (Number.isSafeInteger(configuredSequence) && configuredSequence > 0 ? configuredSequence : 1)
  return { sourceSystem: 'rawkode-academy-static-content', mappingVersion: options.mappingVersion ?? 'astro-content-v1', sequence, records, assetFiles: [...assetFiles.values()] }
}

export const staticContentCollections: string[] = [
  ...specs.map(spec => spec.collection),
  'course-modules',
  'chapters',
  'learning-resources',
  'static-assets',
]
