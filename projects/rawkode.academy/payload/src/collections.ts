import {reviewCollections} from './review/collections'
import {isStaff} from './auth/access'
import {usersCollection} from './auth/payload'
import type {AuthConfig} from './auth/config'
import {pipelineCollection,pipelineVideoFields} from './pipeline'
import {filterExternalFileHeaders} from './media-security'
import type { Access, CollectionConfig, Field, RelationshipField, Where } from 'payload'
import {type AdminAccess,noDevelopers} from './admin/access'
import {applyPreset} from './admin/collection-admin'
import {computedLabel,fillEditorialIdentity,provenanceDefaults,relationTitle} from './admin/fields'
import {arrange,type LayoutOptions} from './admin/layout'
import {fieldComponents} from './admin/config'
import {videoDeleteGuard} from './editorial/delete-guard'

const staff: Access = ({ req }) => isStaff(req.user) || req.context.pipelineMachine === true
const readable: Access = ({ req }) => {
  if(isStaff(req.user) || req.context.pipelineMachine === true) return true
  return { and: [{ _status: { equals: 'published' } }, { tombstone: { equals: false } }] } as Where
}
const text = (name: string, dbName?: string): Field => ({ name, type: 'text', ...(dbName ? { dbName } : {}) })
const relation = (name: string, relationTo: string, hasMany = false, dbName?: string): RelationshipField => (hasMany ? { name, type: 'relationship', relationTo, hasMany:true, ...(dbName ? { dbName } : {}) } : { name, type: 'relationship', relationTo, hasMany:false, ...(dbName ? { dbName } : {}) })
const sourceFieldName = (name: string): string => `source${name[0].toUpperCase()}${name.slice(1)}`
const sourceText = (name: string): Field => text(sourceFieldName(name))
const strings = (name: string): Field => ({ name, type: 'array', fields: [text('value')] })
const refs = (name: string): Field => ({ name, type: 'array', fields: [text('url')] })
const date = (name: string): Field => ({ name, type: 'date' })
const json = (name: string): Field => ({ name, type: 'json' })
const authors = (name = 'authors'): RelationshipField => relation(name, 'people', true)
const technologies = relation('technologies', 'technologies', true)
const domainRelationshipIndexes: Record<string, NonNullable<CollectionConfig['indexes']>> = {
  seasons: [{ unique: true, fields: ['show', 'slug'] }],
  competitors: [{ unique: true, fields: ['season', 'personSlug'] }, { unique: true, fields: ['season', 'userId'] }],
  brackets: [{ unique: true, fields: ['season', 'slug'] }],
  'bracket-applications': [{ unique: true, fields: ['bracket', 'competitor'] }],
  teams: [{ unique: true, fields: ['bracket', 'slug'] }],
  'team-members': [{ unique: true, fields: ['team', 'competitor'] }, { unique: true, fields: ['bracket', 'competitor'] }],
  'bracket-entries': [{ unique: true, fields: ['bracket', 'seed'] }, { unique: true, fields: ['bracket', 'competitor'] }, { unique: true, fields: ['bracket', 'team'] }],
  'match-results': [{ unique: true, fields: ['match'] }],
}
const protectedFields = ['legacyId','legacyType','sourceSystem','sourceRevision','sourceHash','mappingVersion','importedAt','importState','locallyEdited','sourceSequence','sourceFields','sourcePath','sourceFormat','sourceData','sourceRaw','sourceBody','sourceAssets']
// legacyType for editor-created records, matching the importer's spelling.
const legacyTypeOverrides: Record<string, string> = { people: 'Person', technologies: 'Technology', series: 'Series', news: 'News', adrs: 'ADR', changelog: 'Changelog', matches: 'Match', 'learning-resources': 'LearningResources' }
const singularOf = (slug: string) => legacyTypeOverrides[slug] ?? slug.split('-').map(part => part[0].toUpperCase() + part.slice(1)).join('').replace(/ies$/, 'y').replace(/s$/, '')
// Stored shape is unchanged; provenanceDefaults only adds function defaults and
// an editorial-create slug validator (no DDL). See src/admin/fields.ts.
const provenanceFor = (slug: string): Field[] => {
  const defaults = provenanceDefaults(slug, singularOf(slug))
  return [
  { name: 'legacyId', type: 'text', required: true, unique: true, index: true, ...defaults.legacyId },
  { name: 'legacyType', type: 'text', required: true, ...defaults.legacyType },
  { name: 'slug', type: 'text', required: true, index: true, ...defaults.slug } as Field,
  ...['sourceSystem','sourceRevision','sourceHash','mappingVersion'].map(name => text(name)),
  { name: 'importedAt', type: 'date' },
  { name: 'importState', type: 'select', options: ['pending','complete'] },
  { name: 'locallyEdited', type: 'checkbox', defaultValue: true },
  { name:'sourceFields', type:'json' },
  { name:'sourceSequence', type:'number' },
  { name: 'sourceOrder', type: 'number', defaultValue: 0 },
  text('sourcePath'),
  { name: 'sourceFormat', type: 'select', options: ['md','mdx','yaml','yml','json'] },
  json('sourceData'),
  { name: 'sourceRaw', type: 'textarea' },
  { name: 'sourceBody', type: 'textarea' },
  json('sourceAssets'),
  { name: 'tombstone', type: 'checkbox', defaultValue: false },
]
}
type ExtraHooks = { beforeDelete?: ((args: { id: string | number; req: any }) => Promise<void>)[] }
const editorialHooks = (slug: string, extra: ExtraHooks = {}) => ({
  beforeValidate: [fillEditorialIdentity(slug, singularOf(slug))],
  beforeChange: [({ data, originalDoc, req, operation }: { data: Record<string, any>; originalDoc?: Record<string, any>; req: any; operation: string }) => {
    if(slug === 'videos') {
      const linked = data.processingRun || originalDoc?.processingRun
      if((data._status ?? originalDoc?._status) === 'published' && linked && !req.context.pipelineApproval) throw new Error('Use explicit pipeline approval')
      if(!req.context.pipelineInternal && !req.context.pipelineApproval) {
        for(const field of ['processingRun','mediaChecksum','mediaVersion','processingState','approvalRevision']) {
          if(field in data && JSON.stringify(data[field]) !== JSON.stringify(originalDoc?.[field])) throw new Error('Pipeline state is server-owned')
        }
      }
    }
    // Context is supplied only by trusted server code, never HTTP body fields.
    if (req.context.importing === true) return data
    if (operation === 'update') {
      for (const field of protectedFields) {
        if (field in data && JSON.stringify(data[field]) !== JSON.stringify(originalDoc?.[field])) {
          throw new Error(`Import provenance is immutable through editorial writes: ${field}`)
        }
      }
    } else if (data.sourceHash || data.sourceRevision || data.sourceSystem) {
      throw new Error('Editorial creates cannot claim import provenance')
    }
    data.locallyEdited = true
    return data
  }],
  // Extra guards run first, so a refused delete never leaves a deletion marker.
  beforeDelete: [...(extra.beforeDelete ?? []), async ({ id, req }: { id: string | number; req: any }) => {
    // Keep a durable deletion marker so re-import cannot resurrect an editor-deleted record.
    const doc = await req.payload.findByID({ collection: slug, id, draft: true, req, overrideAccess: false })
    await req.payload.create({ collection: 'deletion-markers', req, overrideAccess: false,
      data: { key: `${slug}:${doc.legacyId}`, collectionSlug: slug, legacyId: doc.legacyId, sourceHash: doc.sourceHash ?? '' } })
  }],
})
type Builder = (access: AdminAccess, db: D1Database) => CollectionConfig
function content(slug: string, fields: Field[], layout: LayoutOptions = {}, extraHooks: ExtraHooks = {}): Builder {
  return access => applyPreset({
    slug,
    access: { read: readable, create: staff, update: staff, delete: staff, readVersions: staff },
    versions: { drafts: true, maxPerDoc: 30 },
    fields: arrange([...provenanceFor(slug), ...fields, { name: 'body', type: 'textarea' }, json('cover'), json('contentResources'), json('editorialData')], access, layout),
    hooks: editorialHooks(slug, extraHooks),
  }, access)
}
const terms = strings('terms')
const title = text('title')
const description: Field = { name: 'description', type: 'textarea' }
const domain = (slug: string, fields: Field[], indexes: CollectionConfig['indexes'] = [], layout: LayoutOptions = {}): Builder => access => applyPreset({
  slug,
  access: { read: staff, create: staff, update: staff, delete: staff, readVersions: staff },
  versions: { drafts: true, maxPerDoc: 30 },
  fields: arrange([...provenanceFor(slug), ...fields], access, layout),
  indexes: [...(domainRelationshipIndexes[slug] ?? []), ...indexes],
  hooks: editorialHooks(slug),
}, access)
const competitorTitle: LayoutOptions = { top: [relationTitle('competitorName', 'competitor.displayName', 'Competitor')] }
const ordinal = (value: unknown) => typeof value === 'number' ? String(value) : '?'

const withEditComponents = (config: CollectionConfig, edit: NonNullable<NonNullable<NonNullable<CollectionConfig['admin']>['components']>['edit']>): CollectionConfig =>
  ({ ...config, admin: { ...config.admin, components: { ...config.admin?.components, edit: { ...config.admin?.components?.edit, ...edit } } } })
const updatedAtDescription = 'Shown to readers as Last updated. This is the system timestamp and changes on every save.'
const people: LayoutOptions = {
  rows: [['forename','surname']],
  collapsibles: { Social: ['github','githubHandle','githubUrl','twitter','bluesky','mastodon','linkedin','website','youtube','links'] },
}
const builders: Record<string, Builder> = {
  // Publishing
  videos: (access, db) => withEditComponents(content('videos', [title,text('tagline'),text('subtitle'),description,strings('whatYouWillLearn'),terms,{name:'publishedAt',type:'date',admin:{date:{pickerAppearance:'dayAndTime'},description:'Imported git value. Once a video is published through review, its public release time follows the Times tab.'}}, {name:'duration',type:'number'}, {name:'audioFileSize',type:'number'},
    {name:'type',type:'select',options:['live','recorded']}, {name:'category',type:'select',options:['announcement','editorial','interview','review','tutorial']},
    text('streamUrl'),text('thumbnailUrl'),text('mediaReference'),text('youtubeId'),json('realtimeKit'),json('podcast'),json('subscribeLinks'),relation('show','shows'),technologies,relation('guests','people',true),relation('episode','episodes'),relation('chapters','chapters',true)], {
    processing: { fields: pipelineVideoFields, condition: data => Boolean(data?.processingRun || data?.processingState) },
    // Broadcast and publication times live outside the document (src/editorial),
    // written by guarded commands; a ui field has no column and no GraphQL shape.
    times: [{ name: 'editorialTimes', type: 'ui', label: 'Broadcast and publication times', admin: { components: { Field: fieldComponents.editorialTimes }, condition: data => Boolean(data?.id) } }],
    // Review history plus the guarded assign, share and publish actions.
    review: [{ name: 'reviewPanel', type: 'ui', admin: { components: { Field: fieldComponents.reviewPanel }, condition: data => Boolean(data?.id) } }],
    // Videos in client review are frozen by database triggers; say so and
    // swap the save buttons rather than fail with a generic toast.
    top: [{ name: 'reviewFreeze', type: 'ui', admin: { components: { Field: fieldComponents.reviewFreezeNotice }, condition: data => Boolean(data?.id) } }],
  }, { beforeDelete: [videoDeleteGuard(db)] })(access, db), {
    PublishButton: fieldComponents.videoPublishControl,
    SaveDraftButton: fieldComponents.videoSaveDraftControl,
    UnpublishButton: fieldComponents.videoUnpublishControl,
  }),
  shows: content('shows', [text('name'),{name:'status',type:'select',options:['coming-soon','active','archived']},text('tagline'),text('gameFormatUrl'),description,json('podcast'),json('subscribeLinks'),terms,relation('hosts','people',true),{...relation('episodes','episodes',true),admin:{readOnly:true,description:'Imported source list. Public show episodes are derived from Episode.show; edit that relationship on the episode.'}}]),
  episodes: content('episodes', [text('code'),terms,relation('video','videos'),relation('show','shows')]),
  articles: content('articles', [title,description,date('publishedAt'),date('updatedAt'),text('subtitle'),{name:'type',type:'select',options:['tutorial','article','guide','news']},{name:'howto',type:'checkbox'},authors(),technologies,relation('series','series'),relation('resources','learning-resources',true)], { sidebarDescriptions: { updatedAt: updatedAtDescription } }),
  news: content('news', [title, description, date('publishedAt'), authors(), technologies]),
  series: content('series', [title]),
  // Learning
  courses: content('courses', [title,description,date('publishedAt'),date('updatedAt'),authors(),text('difficulty'),strings('learningPath'),technologies,relation('modules','course-modules',true)], { sidebarDescriptions: { updatedAt: updatedAtDescription } }),
  'course-modules': content('course-modules', [title,description,date('publishedAt'),text('difficulty'),strings('learningPath'),{name:'order',type:'number'},text('section'),relation('course','courses'),relation('video','videos'),authors(),relation('resources','learning-resources',true)]),
  'learning-paths': content('learning-paths', [title,description,date('publishedAt'),text('difficulty'),{name:'estimatedDuration',type:'number'},strings('prerequisites'),authors(),relation('courses','courses',true),relation('videos','videos',true),technologies]),
  technologies: content('technologies', [text('name'),json('seo'),json('logos'),text('category'),text('subcategory'),text('documentation'),text('icon'),text('logo'),text('source'),text('license'),text('status'),text('website'),json('cncf'),json('community'),json('matrix'),terms,strings('aliases'),strings('features'),strings('relatedTechnologies'),strings('useCases'),relation('learningResources','learning-resources')]),
  // People
  people: content('people', [text('name'),text('forename'),text('surname'),text('github'),text('twitter'),text('bluesky'),text('mastodon'),text('linkedin'),text('website'),text('youtube'),text('githubHandle'),text('githubUrl'),text('avatarUrl'),{name:'biography',type:'textarea'},terms,{name:'links',type:'array',fields:[text('name'),text('url')]}], people),
  testimonials: content('testimonials', [text('quote'), json('author'), { name: 'type', type: 'select', options: ['maintainer','partner','viewer'] }]),
  // Klustered
  seasons: domain('seasons', [sourceText('showId'), relation('show', 'shows'), text('name'), { name: 'status', type: 'select', options: ['interest','active','finished'] }, date('startDate'), date('endDate'), date('sourceCreatedAt'), date('sourceUpdatedAt')], [{ unique: true, fields: ['sourceShowId', 'slug'] }]),
  brackets: domain('brackets', [sourceText('seasonId'), relation('season', 'seasons'), text('name'), { name: 'kind', type: 'select', options: ['solo','team'] }, { name: 'format', type: 'select', options: ['single_elimination'] }, { name: 'status', type: 'select', options: ['draft','active','finished'] }, date('startsAt'), date('registrationClosesAt'), { name: 'maxEntries', type: 'number' }, { name: 'teamSize', type: 'number' }, { name: 'cadenceDays', type: 'number' }, date('sourceCreatedAt'), date('sourceUpdatedAt')], [{ unique: true, fields: ['sourceSeasonId', 'slug'] }]),
  matches: domain('matches', [sourceText('bracketId'), relation('bracket', 'brackets'), { name: 'roundNumber', type: 'number' }, { name: 'positionInRound', type: 'number' }, date('scheduledAt'), { name: 'status', type: 'select', options: ['scheduled','live','completed','cancelled'] }, sourceText('teamAId'), relation('teamA', 'teams'), sourceText('teamBId'), relation('teamB', 'teams'), sourceText('entryAId'), relation('entryA', 'bracket-entries'), sourceText('entryBId'), relation('entryB', 'bracket-entries'), text('judgeUserId'), sourceText('winnerTeamId'), relation('winnerTeam', 'teams'), sourceText('winnerEntryId'), relation('winnerEntry', 'bracket-entries'), date('startedAt'), date('endedAt'), date('sourceCreatedAt'), date('sourceUpdatedAt')], [],
    { top: [computedLabel('label', doc => `Round ${ordinal(doc.roundNumber)}, match ${ordinal(doc.positionInRound)}`)] }),
  competitors: domain('competitors', [sourceText('seasonId'), relation('season', 'seasons'), text('personSlug'), text('displayName'), text('bio'), text('userId'), date('sourceCreatedAt'), date('sourceUpdatedAt')], [{ unique: true, fields: ['sourceSeasonId', 'personSlug'] }, { unique: true, fields: ['sourceSeasonId', 'userId'] }]),
  teams: domain('teams', [sourceText('seasonId'), relation('season', 'seasons'), sourceText('bracketId'), relation('bracket', 'brackets'), text('name'), date('sourceCreatedAt'), date('sourceUpdatedAt')], [{ unique: true, fields: ['sourceBracketId', 'slug'] }]),
  'bracket-applications': domain('bracket-applications', [sourceText('bracketId'), relation('bracket', 'brackets'), sourceText('competitorId'), relation('competitor', 'competitors'), { name: 'status', type: 'select', options: ['pending','approved','rejected'] }, date('sourceCreatedAt'), date('reviewedAt'), text('reviewedByUserId')], [{ unique: true, fields: ['sourceBracketId', 'sourceCompetitorId'] }], competitorTitle),
  registrations: domain('registrations', [sourceText('seasonId'), relation('season', 'seasons'), sourceText('bracketId'), relation('bracket', 'brackets'), { name: 'entryType', type: 'select', options: ['solo','team'] }, text('teamName'), { name: 'preferredSlot', type: 'number' }, text('userId'), text('displayName'), text('email'), text('message'), { name: 'status', type: 'select', options: ['pending','approved','rejected'] }, date('submittedAt'), date('reviewedAt'), text('reviewedByUserId')], [],
    { fieldAdmin: { email: { readOnly: true, description: 'Personal data. Visible to developers only.' } } }),
  // Site
  changelog: content('changelog', [title, description, date('date'), { name: 'type', type: 'select', options: ['feature','fix','improvement','breaking'] }, { name: 'pullRequest', type: 'number' }, relation('author', 'people')]),
  adrs: content('adrs', [title, date('adoptedAt'), authors()]),
  // System
  'static-assets': access => applyPreset({
    slug: 'static-assets',
    access: { read: staff, create: staff, update: staff, delete: staff, readVersions: staff },
    versions: { drafts: false },
    fields: arrange([...provenanceFor('static-assets'), text('r2Key'), text('mimeType'), { name: 'bytes', type: 'number' }, text('checksum'), text('alt')], access),
    hooks: editorialHooks('static-assets'),
  }, access),
  'team-invites': domain('team-invites', [text('token'), sourceText('teamId'), relation('team', 'teams'), sourceText('bracketId'), relation('bracket', 'brackets'), text('createdByUserId'), date('sourceCreatedAt'), date('revokedAt')]),
  // Out of the nav: child records edited from their parent.
  chapters: content('chapters', [title,{name:'startTime',type:'number',min:0}]),
  'learning-resources': content('learning-resources', [title,refs('official'),refs('community'),refs('tutorials')]),
  'bracket-entries': domain('bracket-entries', [sourceText('bracketId'), relation('bracket', 'brackets'), sourceText('competitorId'), relation('competitor', 'competitors'), sourceText('teamId'), relation('team', 'teams'), text('displayName'), { name: 'seed', type: 'number' }, { name: 'status', type: 'select', options: ['pending','confirmed','withdrawn'] }, date('sourceCreatedAt'), date('sourceUpdatedAt')], [{ unique: true, fields: ['sourceBracketId', 'seed'] }, { unique: true, fields: ['sourceBracketId', 'sourceCompetitorId'] }, { unique: true, fields: ['sourceBracketId', 'sourceTeamId'] }]),
  'bracket-breaks': domain('bracket-breaks', [sourceText('bracketId'), relation('bracket', 'brackets'), text('label'), date('startsAt'), date('endsAt'), date('sourceCreatedAt')]),
  'team-members': domain('team-members', [sourceText('teamId'), relation('team', 'teams'), sourceText('bracketId'), relation('bracket', 'brackets'), sourceText('competitorId'), relation('competitor', 'competitors'), text('role'), date('sourceCreatedAt')], [{ unique: true, fields: ['sourceTeamId', 'sourceCompetitorId'] }, { unique: true, fields: ['sourceBracketId', 'sourceCompetitorId'] }], competitorTitle),
  'match-results': domain('match-results', [sourceText('matchId'), relation('match', 'matches'), sourceText('winnerTeamId'), relation('winnerTeam', 'teams'), sourceText('winnerEntryId'), relation('winnerEntry', 'bracket-entries'), { name: 'timeToResolveSeconds', type: 'number' }, { name: 'scoreA', type: 'number' }, { name: 'scoreB', type: 'number' }, text('notes'), date('recordedAt'), text('recordedByUserId')], [{ unique: true, fields: ['sourceMatchId'] }],
    { top: [computedLabel('label', doc => `${ordinal(doc.scoreA)} to ${ordinal(doc.scoreB)}`)] }),
}

// Nav order is first appearance in this list (see NAV_ORDER), followed by the
// group:false collections. Order does not affect the stored schema.
export const collectionOrder = [
  'videos','shows','episodes','articles','news','series',
  'courses','course-modules','learning-paths','technologies',
  'people','testimonials','users',
  'media',
  'seasons','brackets','matches','match-results','competitors','teams','bracket-applications','team-members','bracket-entries','bracket-breaks','registrations',
  'changelog','adrs',
  'pipeline-runs','deletion-markers','static-assets','video-review-grants','review-revision-grants','video-publications','team-invites',
  'video-revisions','review-comments','review-decisions','chapters','learning-resources',
] as const
// Payload numbers colliding compound index names (bracket_competitor_1_idx,
// _2_idx) in collection order. These three share [bracket, competitor] and
// [sourceBracketId, sourceCompetitorId], so they must keep this relative order
// or migrate:create emits index renames.
export const compoundIndexOrder = ['bracket-applications','team-members','bracket-entries'] as const

export const createCollections = (config:AuthConfig,db:D1Database,access:AdminAccess=noDevelopers): CollectionConfig[] => {
  const all: CollectionConfig[] = [
    ...reviewCollections(access),
    pipelineCollection(access),
    applyPreset(usersCollection(config,db),access),
    applyPreset({
      slug: 'deletion-markers', access: { read: staff, create: staff, update: () => false, delete: () => false },
      fields: [{ name: 'key', type: 'text', unique: true, required: true }, text('collectionSlug'), text('legacyId'), text('sourceHash')],
    },access),
    applyPreset({
      slug:'media', access:{read:staff,create:staff,update:()=>false,delete:()=>false},
      // Keep Payload's URL-fetch safety checks enabled. Staff media URLs may
      // still be used during migration, but must not forward Academy cookies to
      // an external origin.
      upload:{disableLocalStorage:true,crop:false,focalPoint:false,externalFileHeaderFilter:filterExternalFileHeaders},
      fields:[text('alt')],
    },access),
    ...Object.values(builders).map(build => build(access, db)),
  ]
  const bySlug = new Map(all.map(collection => [collection.slug, collection]))
  if (bySlug.size !== collectionOrder.length || all.some(collection => !(collectionOrder as readonly string[]).includes(collection.slug))) throw new Error('Every collection must appear exactly once in collectionOrder')
  return collectionOrder.map(slug => bySlug.get(slug)!)
}
