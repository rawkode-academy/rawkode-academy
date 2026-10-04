import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync,writeFileSync } from 'node:fs'
import { buildClientSchema, findBreakingChanges, getIntrospectionQuery, printSchema } from 'graphql'
import fixture from '../fixtures/catalogue.json'
import gateway from '../fixtures/schema-gateway.json'

const base='http://127.0.0.1:3100'
const credentials=JSON.parse(readFileSync('.runtime/admin.json','utf8'))
let cookie=''
async function request(path:string,method='GET',body?:unknown,auth=true){
  const response=await fetch(base+path,{method,headers:{origin:base,'content-type':'application/json',...(auth?{cookie}:{})},body:body===undefined?undefined:JSON.stringify(body)})
  const text=await response.text()
  let result:any
  try { result=JSON.parse(text) } catch { throw new Error(`${path} returned ${response.status}: ${text.slice(0,400)}`) }
  return {response,result}
}
async function ok(path:string,method='GET',body?:unknown,auth=true){const {response,result}=await request(path,method,body,auth);assert.ok(response.ok,JSON.stringify(result));return result}
async function query(source:string,variables:Record<string,unknown>={}){return ok('/graphql','POST',{query:source,variables},false)}
async function gql(source:string,variables:Record<string,unknown>={}){const result=await query(source,variables);assert.equal(result.errors,undefined,JSON.stringify(result.errors));return result.data}
async function video(id:string){return (await gql('query($id:String!){videoByID(id:$id){id title slug publishedAt type category guests{id name} chapters{title startTime} episode{id code show{id}} technologies{id learningResources{official}}}}',{id})).videoByID}
const evidence:{checks:string[],runtime?:unknown,at:string}={checks:[],at:new Date().toISOString()}

test('actual Workers / D1 / R2 compatibility and mutation contract', async t=>{
  evidence.runtime=await ok('/api/poc/runtime');assert.match((evidence.runtime as any).runtime,/Cloudflare-Workers/)
  await request('/api/users/first-register','POST',credentials,false)
  const login=await request('/api/users/login','POST',credentials,false)
  assert.equal(login.response.status,200)
  cookie=login.response.headers.getSetCookie().map(x=>x.split(';')[0]).join('; ')
  assert.ok(cookie)
  const stamp=Date.now().toString(36)
  const snapshot=structuredClone(fixture) as any
  const id=(legacyId:string)=>`${stamp}-${legacyId}`
  for(const record of snapshot.records){record.legacyId=id(record.legacyId);record.slug=id(record.slug);for(const value of Object.values(record.relationships??{})){for(const ref of (Array.isArray(value)?value:[value]) as any[])if(ref)ref.legacyId=id(ref.legacyId)}}
  const vId=id('fixture-video-1')
  let internalId:number

  await t.test('exact gateway schema and query-only surface',async()=>{
    const root=await ok('/','POST',{query:'{__typename}'},false);assert.equal(root.data.__typename,'Query')
    const mcp=await fetch(base+'/api/mcp',{method:'POST'});assert.equal(mcp.status,404)
    const live=await gql(getIntrospectionQuery())
    const actual=buildClientSchema(live)
    const expected=buildClientSchema((gateway as any).data??gateway)
    assert.deepEqual(findBreakingChanges(expected,actual),[])
    assert.equal(printSchema(actual),printSchema(expected))
    assert.ok(actual.getMutationType() == null)
    evidence.checks.push('schema: exact captured gateway SDL; no mutation root')
  })
  await t.test('node-first broad import, dry-run and unchanged replay',async()=>{
    const dry=await ok('/api/poc/import','POST',{snapshot,dryRun:true});assert.equal(dry.counts.created,18)
    assert.equal(await video(vId),null)
    const imported=await ok('/api/poc/import','POST',{snapshot,dryRun:false})
    assert.equal(imported.counts.created,18,JSON.stringify(imported));assert.equal(imported.unresolved.length,0)
    const replay=await ok('/api/poc/import','POST',{snapshot,dryRun:false})
    assert.equal(replay.counts.unchanged,18);assert.equal(replay.counts.created,0)
    for(const collection of new Set(snapshot.records.map((r:any)=>r.collection))){const docs=await ok(`/api/${collection}?limit=100`);assert.ok(docs.docs.some((d:any)=>d.legacyId.startsWith(stamp)))}
    const stored=await ok(`/api/videos?where[legacyId][equals]=${vId}&depth=0&draft=true`);internalId=stored.docs[0].id
    assert.notEqual(String(internalId),vId)
    evidence.checks.push('18 nodes / 11 catalogue types imported; dry-run no writes; replay unchanged')
  })
  await t.test('relationships, legacy IDs, date, enum and private isolation',async()=>{
    const v=await video(vId);assert.equal(v.id,vId);assert.match(v.publishedAt,/^\d{4}-\d{2}-\d{2}$/)
    assert.ok(v.guests.length);assert.ok(v.technologies.length);assert.ok(v.chapters.length);assert.ok(v.episode.show.id)
    assert.ok(['recorded','live'].includes(v.type))
    assert.equal(await video(id('fixture-video-private')),null)
    const a=await query('{me{id} getLatestVideos(limit:2,offset:0){id}}');assert.equal(a.data.me,null);assert.equal(a.errors,undefined)
    const all=await gql('{getLatestVideos(limit:1000){id}}');const paged=await gql('{getLatestVideos(limit:1,offset:1){id}}');assert.deepEqual(paged.getLatestVideos,all.getLatestVideos.slice(1,2))
    assert.deepEqual((await gql('{getLatestVideos(limit:0){id}}')).getLatestVideos,[])
    assert.equal((await query('{videoByID(id:"missing"){id}}')).data.videoByID,null)
    const unsupported=await query(`{videoByID(id:"${vId}"){id watchPosition(userId:"someone-else"){videoId}}}`);assert.equal(unsupported.errors[0].extensions.code,'DOMAIN_NOT_IMPLEMENTED')
    evidence.checks.push('legacy IDs, nullable misses, dates, enums, pagination, nested relations, draft exclusion')
  })
  await t.test('REST draft edit does not replace public revision; explicit publish does',async()=>{
    const before=await video(vId)
    await ok(`/api/videos/${internalId}?draft=true`,'PATCH',{title:'Edited private draft '+stamp})
    assert.equal((await video(vId)).title,before.title)
    const draft=await ok(`/api/videos/${internalId}?draft=true&depth=0`);assert.equal(draft.title,'Edited private draft '+stamp)
    await ok(`/api/videos/${internalId}`,'PATCH',{title:draft.title,_status:'published'})
    assert.equal((await video(vId)).title,draft.title)
    const reimport=await ok('/api/poc/import','POST',{snapshot,dryRun:false})
    assert.ok(reimport.conflicts.some((x:any)=>x.legacyId===vId));assert.equal((await video(vId)).title,draft.title)
    const denied=await request(`/api/videos/${internalId}`,'PATCH',{title:'anonymous'},false);assert.equal(denied.response.status,403)
    evidence.checks.push('REST draft -> publish verified; edited import conflict; anonymous mutation denied')
  })
  await t.test('relationship edit and deletion cannot silently resurrect',async()=>{
    await ok(`/api/videos/${internalId}`,'PATCH',{guests:[],_status:'published'})
    assert.deepEqual((await video(vId)).guests,[])
    await ok(`/api/videos/${internalId}`,'DELETE')
    assert.equal(await video(vId),null)
    const replay=await ok('/api/poc/import','POST',{snapshot,dryRun:false});assert.ok(replay.conflicts.some((x:any)=>x.legacyId===vId&&x.reason.includes('deleted')))
    assert.equal(await video(vId),null)
    evidence.checks.push('relationship update and real DELETE; durable deletion marker prevents reimport resurrection')
  })
  await t.test('stale source, explicit clearing, tombstone and unresolved replay',async()=>{
    const person={collection:'people',legacyId:`edge-person-${stamp}`,legacyType:'Person',slug:`edge-person-${stamp}`,sourceRevision:'1',status:'published',data:{name:'Initial',biography:'Clear me'}}
    const edge:any={sourceSystem:'edge-fixture',mappingVersion:'1',sequence:1,records:[person]}
    assert.equal((await ok('/api/poc/import','POST',{snapshot:edge,dryRun:false})).counts.created,1)
    const changed=structuredClone(edge);changed.records[0].data.name='Changed'
    assert.equal((await ok('/api/poc/import','POST',{snapshot:changed,dryRun:false})).counts.conflicts,1)
    changed.sequence=2;changed.records[0].sourceRevision='2';delete changed.records[0].data.biography
    assert.equal((await ok('/api/poc/import','POST',{snapshot:changed,dryRun:false})).counts.conflicts,1)
    changed.records[0].data.biography=null
    assert.equal((await ok('/api/poc/import','POST',{snapshot:changed,dryRun:false})).counts.updated,1)
    assert.equal((await ok('/api/poc/import','POST',{snapshot:edge,dryRun:false})).counts.conflicts,1)
    const personPath=`/api/people?where[legacyId][equals]=${person.legacyId}`
    assert.equal((await ok(personPath,'GET',undefined,false)).docs[0].biography,null)
    changed.sequence=3;changed.records[0].tombstone=true
    assert.equal((await ok('/api/poc/import','POST',{snapshot:changed,dryRun:false})).counts.tombstoned,1)
    assert.equal((await ok(personPath,'GET',undefined,false)).docs.length,0)
    const pending:any={sourceSystem:'edge-fixture',mappingVersion:'1',sequence:1,records:[{collection:'videos',legacyId:`pending-${stamp}`,legacyType:'Video',slug:`pending-${stamp}`,sourceRevision:'1',status:'published',data:{title:'Pending relationship',publishedAt:'2025-01-01T00:00:00Z'},relationships:{guests:[{collection:'people',legacyId:`target-${stamp}`}]}}]}
    const first=await ok('/api/poc/import','POST',{snapshot:pending,dryRun:false});assert.equal(first.counts.pending,1);assert.equal(first.unresolved.length,1)
    assert.equal(await video(`pending-${stamp}`),null)
    pending.records.push({...person,legacyId:`target-${stamp}`,slug:`target-${stamp}`})
    const resumed=await ok('/api/poc/import','POST',{snapshot:pending,dryRun:false});assert.equal(resumed.counts.pending,0);assert.equal(resumed.unresolved.length,0)
    assert.equal((await video(`pending-${stamp}`)).guests[0].id,`target-${stamp}`)
    const graph:any={sourceSystem:'edge-fixture',mappingVersion:'1',sequence:1,records:[
      {collection:'videos',legacyId:`graph-video-${stamp}`,legacyType:'Video',slug:`graph-video-${stamp}`,sourceRevision:'1',status:'published',data:{title:'Blocked parent'},relationships:{technologies:[{collection:'technologies',legacyId:`graph-tech-${stamp}`}]}},
      {collection:'technologies',legacyId:`graph-tech-${stamp}`,legacyType:'Technology',slug:`graph-tech-${stamp}`,sourceRevision:'1',status:'published',data:{name:'Blocked child'},relationships:{learningResources:{collection:'learning-resources',legacyId:`graph-resource-${stamp}`}}}
    ]}
    const blocked=await ok('/api/poc/import','POST',{snapshot:graph,dryRun:false});assert.equal(blocked.counts.pending,2)
    assert.equal(await video(`graph-video-${stamp}`),null)
    graph.records.push({collection:'learning-resources',legacyId:`graph-resource-${stamp}`,legacyType:'LearningResources',slug:`graph-resource-${stamp}`,sourceRevision:'1',status:'published',data:{title:'Resolved'}})
    const resolved=await ok('/api/poc/import','POST',{snapshot:graph,dryRun:false});assert.equal(resolved.counts.pending,0)
    assert.equal((await video(`graph-video-${stamp}`)).technologies[0].id,`graph-tech-${stamp}`)
    evidence.checks.push('stale and inconsistent snapshots rejected; explicit clearing; tombstone; unresolved node stays private then replay resolves')
  })
  await t.test('generated Payload GraphQL serves real collections and CRUD',async()=>{
    const introspection=await ok('/api/graphql','POST',{query:getIntrospectionQuery()});assert.equal(introspection.errors,undefined,JSON.stringify(introspection.errors))
    const schema=buildClientSchema(introspection.data)
    writeFileSync('evidence/payload-generated.graphql',printSchema(schema)+'\n')
    const mutations=Object.keys(schema.getMutationType()!.getFields());assert.ok(mutations.some(n=>n.startsWith('create')))
    const articleType=Object.entries(schema.getMutationType()!.getFields()).find(([name])=>name.toLowerCase()==='createarticle')
    assert.ok(articleType,mutations.join(','))
    const field=articleType[1];const dataArg=field.args.find(a=>a.name==='data')!
    const result=await ok('/api/graphql','POST',{query:`mutation($data:${dataArg.type}){${articleType[0]}(data:$data){id legacyId title}}`,variables:{data:{legacyId:`gql-${stamp}`,legacyType:'Article',slug:`gql-${stamp}`,title:'GraphQL-created draft',_status:'draft'}}})
    assert.equal(result.errors,undefined,JSON.stringify(result.errors));assert.equal(result.data[articleType[0]].legacyId,`gql-${stamp}`)
    evidence.checks.push('generated GraphQL introspection + authenticated createArticle executed in workerd')
  })
  await t.test('D1 preference upsert persists create and update',async()=>{
    const path=`/api/payload-preferences/poc-${stamp}`
    await ok(path,'POST',{value:{order:'first'}})
    assert.equal((await ok(path)).value.order,'first')
    await ok(path,'POST',{value:{order:'updated'}})
    assert.equal((await ok(path)).value.order,'updated')
    await ok(path,'DELETE')
    evidence.checks.push('D1 preference upsert persisted first insert and later update across requests')
  })
  await t.test('local R2 upload stays authenticated',async()=>{
    const form=new FormData();form.set('file',new File(['Synthetic public fixture bytes; not private media.'],`fixture-${stamp}.txt`,{type:'text/plain'}));form.set('_payload',JSON.stringify({alt:'Synthetic fixture'}))
    const response=await fetch(base+'/api/media',{method:'POST',headers:{cookie,origin:base},body:form});const result:any=await response.json();assert.ok(response.ok,JSON.stringify(result))
    const media=result.doc
    assert.ok(media.filename)
    const privateRead=await fetch(base+media.url);assert.ok([401,403,404].includes(privateRead.status),String(privateRead.status))
    const staffRead=await fetch(base+media.url,{headers:{cookie,origin:base}});assert.equal(staffRead.status,200);assert.match(await staffRead.text(),/Synthetic public fixture/)
    evidence.checks.push('R2 adapter upload/read and anonymous denial in local Workers runtime')
  })
  writeFileSync('evidence/worker-tests.json',JSON.stringify(evidence,null,2)+'\n')
})
