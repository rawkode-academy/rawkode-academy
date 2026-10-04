import {isStaff} from './auth/access'
import {usersCollection} from './auth/payload'
import type {AuthConfig} from './auth/config'
import {pipelineCollection,pipelineVideoFields} from './pipeline'
import type { Access, CollectionConfig, Field, RelationshipField, Where } from 'payload'

const staff: Access = ({ req }) => isStaff(req.user) || req.context.pipelineMachine === true
const readable: Access = ({ req }) => {
  if(isStaff(req.user) || req.context.pipelineMachine === true) return true
  return { and: [{ _status: { equals: 'published' } }, { tombstone: { equals: false } }] } as Where
}
const text = (name: string): Field => ({ name, type: 'text' })
const relation = (name: string, relationTo: string, hasMany = false): RelationshipField => (hasMany ? { name, type: 'relationship', relationTo, hasMany:true } : { name, type: 'relationship', relationTo, hasMany:false })
const strings = (name: string): Field => ({ name, type: 'array', fields: [text('value')] })
const refs = (name: string): Field => ({ name, type: 'array', fields: [text('url')] })
const protectedFields = ['legacyId','legacyType','sourceSystem','sourceRevision','sourceHash','mappingVersion','importedAt','importState','locallyEdited','sourceSequence','sourceFields']
const provenance: Field[] = [
  { name: 'legacyId', type: 'text', required: true, unique: true, index: true },
  { name: 'legacyType', type: 'text', required: true },
  { name: 'slug', type: 'text', required: true, index: true },
  ...['sourceSystem','sourceRevision','sourceHash','mappingVersion'].map(text),
  { name: 'importedAt', type: 'date' },
  { name: 'importState', type: 'select', options: ['pending','complete'] },
  { name: 'locallyEdited', type: 'checkbox', defaultValue: true },
  { name:'sourceFields', type:'json' },
  { name:'sourceSequence', type:'number' },
  { name: 'sourceOrder', type: 'number', defaultValue: 0 },
  { name: 'sourceBody', type: 'textarea' },
  { name: 'tombstone', type: 'checkbox', defaultValue: false },
]
function content(slug: string, fields: Field[]): CollectionConfig {
  return {
    slug, admin: { useAsTitle: fields.some(f => 'name' in f && f.name === 'title') ? 'title' : 'legacyId' },
    access: { read: readable, create: staff, update: staff, delete: staff, readVersions: staff },
    versions: { drafts: true, maxPerDoc: 30 },
    fields: [...provenance, ...fields],
    hooks: {
      beforeChange: [({ data, originalDoc, req, operation }) => {
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
      beforeDelete: [async ({ id, req }) => {
        // Keep a durable deletion marker so re-import cannot resurrect an editor-deleted record.
        const doc = await req.payload.findByID({ collection: slug, id, draft: true, req, overrideAccess: false })
        await req.payload.create({ collection: 'deletion-markers', req, overrideAccess: false,
          data: { key: `${slug}:${doc.legacyId}`, collectionSlug: slug, legacyId: doc.legacyId, sourceHash: doc.sourceHash ?? '' } })
      }],
    },
  }
}
const terms = strings('terms')
const title = text('title')
const description: Field = { name: 'description', type: 'textarea' }
export const createCollections = (config:AuthConfig,db:D1Database): CollectionConfig[] => [
  pipelineCollection,
  usersCollection(config,db),
  {
    slug: 'deletion-markers', access: { read: staff, create: staff, update: () => false, delete: () => false },
    fields: [{ name: 'key', type: 'text', unique: true, required: true }, text('collectionSlug'), text('legacyId'), text('sourceHash')],
  },
  content('videos', [...pipelineVideoFields,title,text('subtitle'),description,terms,{name:'publishedAt',type:'date'}, {name:'duration',type:'number'},
    {name:'type',type:'select',options:['live','recorded']}, {name:'category',type:'select',options:['announcement','editorial','interview','review','tutorial']},
    text('streamUrl'),text('thumbnailUrl'),text('mediaReference'),relation('technologies','technologies',true),relation('guests','people',true),relation('episode','episodes'),relation('chapters','chapters',true)]),
  content('people', [text('name'),text('forename'),text('surname'),text('githubHandle'),text('githubUrl'),text('avatarUrl'),{name:'biography',type:'textarea'},terms,{name:'links',type:'array',fields:[text('name'),text('url')]}]),
  content('technologies', [text('name'),text('category'),text('subcategory'),text('documentation'),text('icon'),text('logo'),text('source'),text('status'),text('website'),terms,strings('aliases'),strings('features'),strings('relatedTechnologies'),strings('useCases'),relation('learningResources','learning-resources')]),
  content('shows', [text('name'),description,terms,relation('hosts','people',true),{...relation('episodes','episodes',true),admin:{readOnly:true,description:'Imported source list. Public show episodes are derived from Episode.show; edit that relationship on the episode.'}}]),
  content('episodes', [text('code'),terms,relation('video','videos'),relation('show','shows')]),
  content('chapters', [title,{name:'startTime',type:'number',min:0}]),
  content('learning-resources', [title,refs('official'),refs('community'),refs('tutorials')]),
  content('articles', [title,description,{name:'publishedAt',type:'date'},relation('authors','people',true),relation('technologies','technologies',true),relation('resources','learning-resources',true)]),
  content('courses', [title,description,{name:'publishedAt',type:'date'},relation('modules','course-modules',true),relation('authors','people',true),relation('technologies','technologies',true)]),
  content('course-modules', [title,description,{name:'order',type:'number'},text('section'),relation('course','courses'),relation('video','videos'),relation('resources','learning-resources',true)]),
  content('learning-paths', [title,description,text('difficulty'),{name:'estimatedDuration',type:'number'},strings('prerequisites'),relation('courses','courses',true),relation('videos','videos',true),relation('technologies','technologies',true)]),
  {
    slug:'media', access:{read:staff,create:staff,update:()=>false,delete:()=>false},
    upload:{disableLocalStorage:true,crop:false,focalPoint:false,skipSafeFetch:true},
    fields:[text('alt')],
  },
]
