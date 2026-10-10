import {readFileSync, writeFileSync} from 'node:fs'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {createCuid2} from '../src/cuid2'

type Fixture = {videoId:string;staff:string;customer:string;tokens:{staff:string;customer:string};origin:string;runId:string}
type JsonRecord = Record<string, any>
const projectDir = process.cwd()
const fixture = JSON.parse(readFileSync(path.join(projectDir, '.runtime/hosted-review-fixture.json'), 'utf8')) as Fixture
const media = readFileSync(path.join(projectDir, 'fixtures/synthetic.mp4'))
const checksum = createHash('sha256').update(media).digest('hex')
const cookieName = '__Host-poc-oidc-session'
const baseHeaders = (token:string, json = false) => {
  const headers = new Headers({origin: fixture.origin, cookie: `${cookieName}=${token}`})
  if (json) headers.set('content-type', 'application/json')
  return headers
}
async function request(pathname:string, token:string, init:RequestInit = {}, expected = 200):Promise<JsonRecord> {
  const headers = new Headers(baseHeaders(token, init.body !== undefined && !(init.body instanceof Uint8Array)))
  for (const [key, value] of new Headers(init.headers).entries()) headers.set(key, value)
  const response = await fetch(`${fixture.origin}${pathname}`, {...init, headers})
  const text = await response.text()
  let body:JsonRecord
  try { body = text ? JSON.parse(text) : {} } catch { body = {raw: text.slice(0, 500)} }
  if (response.status !== expected) throw new Error(`${init.method ?? 'GET'} ${pathname}: expected ${expected}, got ${response.status}: ${JSON.stringify(body)}`)
  return body
}
const command = (token:string, body:JsonRecord) => request('/api/review', token, {method:'POST', body:JSON.stringify(body)})
const sleep = (milliseconds:number) => new Promise(resolve => setTimeout(resolve, milliseconds))

const report:JsonRecord = {runId: fixture.runId, videoId: fixture.videoId, origin: fixture.origin, checks: []}
const staff = fixture.tokens.staff
const customer = fixture.tokens.customer

const targets = await request('/api/review/upload-targets?q=hosted-review-', staff)
if (!targets.videos?.some((video:JsonRecord) => video.videoId === fixture.videoId)) throw new Error('Synthetic video was not visible to staff upload targets')
report.checks.push('staff can enumerate the assigned synthetic upload target')

const reviewers = await request('/api/review/reviewers', staff)
if (!reviewers.reviewers?.some((reviewer:JsonRecord) => reviewer.userId === fixture.customer)) throw new Error('Synthetic customer was not visible to staff')
report.checks.push('staff can enumerate the synthetic customer reviewer')

const begin = await request('/api/review/uploads', staff, {method:'POST', body:JSON.stringify({
  action:'begin', commandId:createCuid2(), videoId:fixture.videoId, bytes:media.byteLength, checksum,
  contentType:'video/mp4', metadata:{title:'Hosted review acceptance fixture',description:'Synthetic end-to-end review artifact.',transcript:'',chapters:[]},
})})
const sessionId = String(begin.sessionId)
if (!sessionId || begin.processingAvailable !== true) throw new Error(`Upload intake is not configured: ${JSON.stringify(begin)}`)
report.checks.push('staff can begin an upload and receive a durable session')

const uploaded = await request(`/api/review/uploads?sessionId=${encodeURIComponent(sessionId)}`, staff, {
  method:'PUT', headers:{'content-type':'video/mp4','x-upload-length':String(media.byteLength)}, body:media,
})
if (uploaded.state !== 'uploaded') throw new Error(`Upload did not reach uploaded state: ${JSON.stringify(uploaded)}`)
report.checks.push('staff upload is stored in the deployed Preview R2 binding')

let processed:JsonRecord = {}
const processingStates:string[] = []
for (let attempt = 0; attempt < 45; attempt++) {
  processed = await request('/api/review/uploads', staff, {method:'POST', body:JSON.stringify({action:'process',sessionId})})
  processingStates.push(String(processed.state))
  if (processed.revision?.revisionId) break
  await sleep(4000)
}
if (!processed.revision?.revisionId) throw new Error(`Processing did not produce a revision: ${JSON.stringify({processingStates,processed})}`)
const revisionId = String(processed.revision.revisionId)
report.processingStates = processingStates
report.checks.push('Cloudflare Workflow completed Container/Workers AI processing and attached a review revision')

const share = await command(staff, {action:'share', commandId:createCuid2(), videoId:fixture.videoId, revisionId, userId:fixture.customer, canApprove:true, expiresAt:new Date(Date.now() + 86400000).toISOString()})
if (share.action !== 'share') throw new Error(`Share failed: ${JSON.stringify(share)}`)
report.checks.push('staff shared this revision with the customer with approval rights')

const customerList = await request('/api/review', customer)
if (!customerList.items?.some((item:JsonRecord) => item.videoId === fixture.videoId)) throw new Error('Customer cannot see the granted review')
const customerReview = await request(`/api/review?videoId=${fixture.videoId}`, customer)
if (customerReview.currentRevisionId !== revisionId || customerReview.canApprove !== true) throw new Error(`Customer review access is wrong: ${JSON.stringify(customerReview)}`)
report.checks.push('customer sees only the granted review and can approve it')

const comment = await command(customer, {action:'comment', commandId:createCuid2(), videoId:fixture.videoId, revisionId, startMs:0, body:'Please keep this opening frame; synthetic acceptance comment.'})
const commentId = String(comment.commentId)
if (!commentId) throw new Error(`Comment was not created: ${JSON.stringify(comment)}`)
report.checks.push('customer added a timestamped comment at 00:00')

const beforeResolve = await request(`/api/review?videoId=${fixture.videoId}`, staff)
if (!beforeResolve.comments?.some((item:JsonRecord) => item.id === commentId && item.startMs === 0)) throw new Error('Timestamped comment was not visible to staff')
const resolved = await command(staff, {action:'resolve-comment', commandId:createCuid2(), videoId:fixture.videoId, commentId, resolved:true})
if (resolved.resolved !== true) throw new Error(`Comment was not resolved: ${JSON.stringify(resolved)}`)
report.checks.push('staff can resolve the timestamped comment before publication')

const decision = await command(customer, {action:'decide', commandId:createCuid2(), videoId:fixture.videoId, revisionId, expectedReviewVersion:1, decision:'approved', note:'Approved synthetic review fixture.'})
if (decision.decision !== 'approved') throw new Error(`Approval failed: ${JSON.stringify(decision)}`)
const decisionId = String(decision.decisionId)
report.checks.push('customer approved the exact current revision')

const publish = await command(staff, {action:'publish', commandId:createCuid2(), videoId:fixture.videoId, revisionId, expectedReviewVersion:1, decisionId})
const publicationId = String(publish.publicationId)
if (!publicationId || publish.revisionId !== revisionId) throw new Error(`Publication failed: ${JSON.stringify(publish)}`)
report.checks.push('staff published only the customer-approved revision')

const published = await fetch(`${fixture.origin}/api/review/published-media?videoId=${fixture.videoId}&publicationId=${encodeURIComponent(publicationId)}`, {method:'HEAD'})
if (published.status !== 200 || published.headers.get('content-type') !== 'video/mp4') throw new Error(`Published artifact is not playable: ${published.status} ${published.headers.get('content-type')}`)
const range = await fetch(`${fixture.origin}/api/review/published-media?videoId=${fixture.videoId}&publicationId=${encodeURIComponent(publicationId)}`, {headers:{range:'bytes=0-15'}})
if (range.status !== 206 || (await range.arrayBuffer()).byteLength !== 16) throw new Error(`Published byte-range playback failed: ${range.status}`)
report.checks.push('published artifact is publicly playable with byte-range support')

const finalReview = await request(`/api/review?videoId=${fixture.videoId}`, staff)
const finalRevision = finalReview.revisions?.find((item:JsonRecord) => item.id === revisionId)
if (finalRevision?.state !== 'published' || finalReview.comments?.find((item:JsonRecord) => item.id === commentId)?.resolved !== 1) throw new Error(`Final review state is wrong: ${JSON.stringify(finalReview)}`)
report.final = {sessionId, revisionId, commentId, decisionId, publicationId, mediaBytes:Number(published.headers.get('content-length') ?? 0)}
writeFileSync(path.join(projectDir, '.runtime/hosted-review-e2e.json'), JSON.stringify(report, null, 2) + '\n', {mode:0o600})
console.log(JSON.stringify({runId:report.runId, videoId:report.videoId, checks:report.checks.length, processingStates, final:report.final}))
