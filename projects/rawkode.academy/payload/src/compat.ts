import { buildClientSchema, GraphQLError, isObjectType, isScalarType, type GraphQLFieldResolver, type GraphQLSchema, type IntrospectionQuery } from 'graphql'
import { createYoga } from 'graphql-yoga'
import { DateResolver, DateTimeResolver } from 'graphql-scalars'
import type { Payload } from 'payload'
import gatewayIntrospection from '../fixtures/schema-gateway.json'
import { Catalogue, stringRows, type CatalogueDocument } from './catalogue'

export interface CompatibilityContext { catalogue: Catalogue }
type Resolver = GraphQLFieldResolver<CatalogueDocument, CompatibilityContext | undefined>

export function createCompatibilityContext(payload: Payload): CompatibilityContext {
  return { catalogue: new Catalogue(payload) }
}

function unsupported(domain: string): never {
  throw new GraphQLError(`${domain} belongs to an external Academy domain and is not implemented in this isolated experiment.`, {
    extensions: { code: 'DOMAIN_NOT_IMPLEMENTED', domain },
  })
}

/** Exact captured gateway type contract, with explicitly bounded catalogue behavior. */
export function createCompatibilitySchema(payload: Payload): GraphQLSchema {
  // Introspection retains specified-directive locations that printSchema omits.
  // Rebuilding only the SDL silently substituted this runtime's older built-ins.
  const schema = buildClientSchema(gatewayIntrospection as unknown as IntrospectionQuery)
  const catalogue = (context: CompatibilityContext | undefined) => context?.catalogue ?? new Catalogue(payload)
  const set = (typeName: string, field: string, resolver: Resolver) => {
    const type = schema.getType(typeName)
    if (!isObjectType(type) || !type.getFields()[field]) throw new Error(`Missing captured contract field ${typeName}.${field}`)
    type.getFields()[field].resolve = resolver
  }
  const publicTypes = new Set(['Video', 'Technology', 'Person', 'Show', 'Episode', 'Chapter', 'PersonLink', 'LearningResources'])
  for (const type of Object.values(schema.getTypeMap())) {
    if (!isObjectType(type) || type.name.startsWith('__')) continue
    for (const [name, field] of Object.entries(type.getFields())) {
      // Fail closed for every unimplemented domain, including fields added by future snapshots.
      field.resolve = publicTypes.has(type.name)
        ? source => source[name] ?? null
        : () => unsupported(`${type.name}.${name}`)
    }
  }
  for (const type of ['Video', 'Technology', 'Person', 'Show', 'Episode']) set(type, 'id', source => source.legacyId)
  set('Video', 'publishedAt', video => video.publishedAt ? new Date(String(video.publishedAt)) : null)
  for (const type of ['Video', 'Technology', 'Person', 'Show', 'Episode']) set(type, 'terms', source => stringRows(source.terms))
  for (const field of ['aliases', 'features', 'relatedTechnologies', 'useCases']) set('Technology', field, source => stringRows(source[field]))
  for (const field of ['community', 'official', 'tutorials']) set('LearningResources', field, source => stringRows(source[field]))

  set('Query', 'videoByID', (_, args, context) => catalogue(context).byLegacyId('videos', args.id))
  set('Query', 'getAllVideos', (_, __, context) => catalogue(context).all('videos'))
  const latest = async (context: CompatibilityContext | undefined) => (await catalogue(context).all('videos'))
    .filter(video => new Date(String(video.publishedAt)).getTime() <= Date.now())
    .sort((left, right) => new Date(String(right.publishedAt)).getTime() - new Date(String(left.publishedAt)).getTime())
  set('Query', 'getLatestVideos', async (_, args, context) => (await latest(context)).slice(args.offset ?? 0, (args.offset ?? 0) + (args.limit ?? 15)))
  set('Query', 'simpleSearch', async (_, args, context) => {
    const term = String(args.term).toLowerCase()
    return (await latest(context)).filter(video => ['title', 'description', 'subtitle'].some(field => String(video[field] ?? '').toLowerCase().includes(term))).slice(0, args.limit ?? 15)
  })
  set('Query', 'getRandomVideos', async (_, args, context) => {
    const videos = await latest(context)
    // Uniform shuffle; source uses random Array.sort. Membership/count preserved, sequence intentionally unspecified.
    for (let i = videos.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [videos[i], videos[j]] = [videos[j], videos[i]] }
    return videos.slice(0, args.limit ?? 5)
  })
  set('Query', 'getTechnologies', async (_, args, context) => (await catalogue(context).all('technologies')).slice(args.offset ?? 0, (args.offset ?? 0) + (args.limit ?? 15)))
  set('Query', 'allShows', (_, __, context) => catalogue(context).all('shows'))
  set('Query', 'showById', (_, args, context) => catalogue(context).byLegacyId('shows', args.id))
  set('Query', 'episodesForShow', async (_, args, context) => {
    const view = catalogue(context)
    const show = await view.byLegacyId('shows', args.showId)
    return show ? view.reverse('episodes', 'show', show) : []
  })
  set('Query', 'episodeByShowCode', async (_, args, context) => {
    const view = catalogue(context)
    const show = await view.byLegacyId('shows', args.showId)
    return show ? (await view.reverse('episodes', 'show', show)).find(episode => String(episode.code).toLowerCase() === String(args.code).toLowerCase()) ?? null : null
  })
  set('Query', 'episodeByVideoId', async (_, args, context) => {
    const view = catalogue(context)
    const video = await view.byLegacyId('videos', args.videoId)
    return video ? (await view.reverse('episodes', 'video', video))[0] ?? null : null
  })
  // No fake identity bridge: this POC public facade is anonymous, regardless of request headers.
  set('Query', 'me', () => null)

  for (const [field, collection] of [['technologies', 'technologies'], ['guests', 'people'], ['chapters', 'chapters']] as const)
    set('Video', field, (video, _, context) => catalogue(context).relationships(collection, video[field]))
  set('Video', 'episode', async (video, _, context) => {
    const view = catalogue(context)
    return video.episode ? view.relationship('episodes', video.episode) : (await view.reverse('episodes', 'video', video))[0] ?? null
  })
  set('Technology', 'videos', async (technology, _, context) => (await catalogue(context).reverse('videos', 'technologies', technology))
    .filter(video => new Date(String(video.publishedAt)).getTime() <= Date.now()))
  set('Technology', 'learningResources', (technology, _, context) => catalogue(context).relationship('learning-resources', technology.learningResources))
  set('Person', 'name', person => person.name ?? [person.forename, person.surname].filter(Boolean).join(' '))
  set('Person', 'links', person => person.links ?? [])
  set('Person', 'guestAppearances', async (person, _, context) => (await catalogue(context).reverse('videos', 'guests', person))
    .filter(video => new Date(String(video.publishedAt)).getTime() <= Date.now()))
  set('Person', 'hostedShows', (person, _, context) => catalogue(context).reverse('shows', 'hosts', person))
  set('Show', 'hosts', (show, _, context) => catalogue(context).relationships('people', show.hosts))
  set('Show', 'episodes', (show, _, context) => catalogue(context).reverse('episodes', 'show', show))
  set('Episode', 'show', (episode, _, context) => catalogue(context).relationship('shows', episode.show))
  set('Episode', 'video', (episode, _, context) => catalogue(context).relationship('videos', episode.video))
  for (const [type, fields] of Object.entries({
    Video: ['emojiReactions', 'hasReacted', 'watchPosition'],
    Person: ['emailPreferences', 'emailPreferenceEvents'],
    Show: ['brackets', 'liveMatch', 'myParticipation', 'openBrackets', 'schedule', 'seasons'],
  })) for (const field of fields) set(type, field, () => unsupported(`${type}.${field}`))

  for (const [scalarName, implementation] of [['Date', DateResolver], ['DateTime', DateTimeResolver]] as const) {
    const scalar = schema.getType(scalarName)
    if (!isScalarType(scalar)) throw new Error(`Missing ${scalarName}`)
    scalar.serialize = implementation.serialize
    scalar.parseValue = implementation.parseValue
    scalar.parseLiteral = implementation.parseLiteral
  }
  return schema
}

export function createCompatibilityYoga(payload: Payload) {
  return createYoga({ schema: createCompatibilitySchema(payload), graphqlEndpoint: '/graphql',
    context: () => createCompatibilityContext(payload) })
}
