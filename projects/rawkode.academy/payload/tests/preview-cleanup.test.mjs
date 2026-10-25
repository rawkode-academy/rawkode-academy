import assert from 'node:assert/strict'
import test from 'node:test'
import {
	PAYLOAD_ACCOUNT_ID,
	PAYLOAD_WORKER_NAME,
	assertPayloadConfig,
	classifyPreviewName,
	containerBelongsToPreview,
	containerSlugsForDeletion,
	deletionCommand,
	isContainerAlreadyGone,
	isPreviewAlreadyGone,
	parseContainerPage,
	parseGitHubPull,
	parsePreviewPage,
	planClosedPullRequest,
	previewSlugFromContainer,
	readOptions,
} from '../scripts/preview-cleanup.mjs'
import { legacyPreviewName, previewNameFromContext, pullRequestPreviewName, sanitizeBranch } from '../scripts/preview-name.mjs'

const open = (number, branch) => ({ number, branch, state: 'open' })
const closed = (number, branch) => ({ number, branch, state: 'closed' })

test('pull request builds are named by pull request number', () => {
	const event = { pull_request: { number: 1419, head: { ref: 'feat/payload' } } }
	const name = previewNameFromContext({
		env: { GITHUB_HEAD_REF: 'feat/payload', GITHUB_REF: 'refs/pull/1419/merge', GITHUB_REF_NAME: '1419/merge' },
		event,
	})
	assert.equal(name, 'pr-1419')
	assert.equal(pullRequestPreviewName('1419'), 'pr-1419')
})

test('the merge ref supplies the pull request number when the event has none', () => {
	assert.equal(previewNameFromContext({ env: { GITHUB_REF: 'refs/pull/42/merge', GITHUB_REF_NAME: '42/merge', GITHUB_HEAD_REF: 'feat/payload' }, event: {} }), 'pr-42')
	assert.equal(previewNameFromContext({ env: { GITHUB_REF_NAME: '42/merge' }, event: undefined }), 'pr-42')
})

test('an explicit preview name and a local run keep the branch spelling', () => {
	assert.equal(previewNameFromContext({ env: { CLOUDFLARE_PREVIEW_NAME: 'local', GITHUB_REF: 'refs/pull/9/merge' }, event: { pull_request: { number: 9 } } }), 'pr-local')
	assert.equal(previewNameFromContext({ env: { GITHUB_HEAD_REF: 'Feature/My_Branch' }, event: undefined }), 'pr-feature-my-branch')
	assert.equal(previewNameFromContext({ env: {}, event: undefined }), 'pr-local')
	assert.equal(sanitizeBranch('---'), 'local')
	assert.equal(legacyPreviewName('a'.repeat(80)), `pr-${'a'.repeat(48)}`)
})

test('pr-local and production names are never deleted', () => {
	const lists = { openPullRequests: [], closedPullRequests: [closed(1, 'local'), closed(2, 'main')] }
	assert.equal(classifyPreviewName('pr-local', lists).action, 'skip')
	assert.equal(classifyPreviewName('rawkode-academy-payload', lists).action, 'skip')
	assert.equal(classifyPreviewName('pr-main', lists).action, 'delete')
	assert.equal(classifyPreviewName('PR-2', lists).action, 'skip')
})

test('a numbered preview is deleted only when that pull request is closed', () => {
	assert.equal(classifyPreviewName('pr-10', { openPullRequests: [open(10, 'feat')], closedPullRequests: [] }).action, 'skip')
	assert.equal(classifyPreviewName('pr-10', { openPullRequests: [], closedPullRequests: [closed(10, 'feat')] }).reason, 'pull request 10 is closed')
	assert.equal(classifyPreviewName('pr-10', { openPullRequests: [], closedPullRequests: [closed(11, 'other')] }).action, 'skip')
})

test('a legacy branch preview survives while any open pull request still uses it', () => {
	const name = 'pr-feat-a'
	assert.equal(classifyPreviewName(name, { openPullRequests: [open(3, 'feat/a')], closedPullRequests: [closed(2, 'feat_a')] }).action, 'skip')
	assert.equal(classifyPreviewName(name, { openPullRequests: [open(3, 'other')], closedPullRequests: [closed(2, 'feat_a')] }).action, 'delete')
	const plan = planClosedPullRequest({ number: 2, branch: 'local', openPullRequests: [] })
	assert.deepEqual(plan.map((item) => [item.name, item.action]), [['pr-2', 'delete'], ['pr-local', 'skip']])
	const collision = planClosedPullRequest({ number: 8, branch: 'feat/a', openPullRequests: [open(3, 'feat_a')] })
	assert.equal(collision.find((item) => item.name === 'pr-feat-a').action, 'skip')
	assert.equal(collision.find((item) => item.name === 'pr-8').action, 'delete')
})

test('container apps match only the preview slug segment of the payload worker', () => {
	const app = `${PAYLOAD_WORKER_NAME}_pr-10_ReviewFFmpegContainer`
	assert.equal(previewSlugFromContainer(app), 'pr-10')
	assert.equal(containerBelongsToPreview(app, 'pr-10'), true)
	assert.equal(containerBelongsToPreview(`${PAYLOAD_WORKER_NAME}_pr-10_ReviewFFmpegContainer_ab12`, 'pr-10'), true)
	assert.equal(containerBelongsToPreview(`${PAYLOAD_WORKER_NAME}_pr-100_ReviewFFmpegContainer`, 'pr-10'), false)
	assert.equal(previewSlugFromContainer(`${PAYLOAD_WORKER_NAME}_ReviewFFmpegContainer`), null)
	assert.equal(previewSlugFromContainer(`${PAYLOAD_WORKER_NAME}-review-runtime_pr-10_ReviewFFmpegContainer`), null)
	assert.equal(previewSlugFromContainer(`${PAYLOAD_WORKER_NAME}_pr-local_ReviewFFmpegContainer`), null)
	const slugs = containerSlugsForDeletion(
		[{ name: 'pr-10', action: 'delete' }],
		[{ name: 'pr-10', slug: 'pr-10-ab' }, { name: 'pr-local', slug: 'pr-local' }],
	)
	assert.deepEqual([...slugs].sort(), ['pr-10', 'pr-10-ab'])
	const blocked = containerSlugsForDeletion(
		[{ name: 'pr-10', action: 'delete' }],
		[{ name: 'pr-10', slug: 'pr-11' }],
		[{ number: 11, branch: 'feat' }],
	)
	assert.deepEqual([...blocked], ['pr-10'])
})

test('deletion commands cannot target the worker, D1, R2, or KV', () => {
	assert.deepEqual(deletionCommand('preview', 'pr-10'), [
		'preview', 'delete', '--config', 'wrangler.jsonc', '--worker-name', PAYLOAD_WORKER_NAME, '--name', 'pr-10', '--skip-confirmation',
	])
	assert.deepEqual(deletionCommand('container', '0123456789abcdef0123456789abcdef'), [
		'containers', 'delete', '0123456789abcdef0123456789abcdef', '--config', 'wrangler.jsonc',
	])
	for (const kind of ['worker', 'd1', 'r2', 'kv', 'namespace']) {
		assert.throws(() => deletionCommand(kind, 'pr-10'), /refusing to delete/)
	}
	assert.throws(() => deletionCommand('preview', 'pr-local'), /protected/)
	assert.throws(() => deletionCommand('container', 'not an id'), /refusing container id/)
})

test('the payload config is the only accepted target', () => {
	assert.deepEqual(assertPayloadConfig({ name: PAYLOAD_WORKER_NAME, account_id: PAYLOAD_ACCOUNT_ID }), {
		workerName: PAYLOAD_WORKER_NAME,
		accountId: PAYLOAD_ACCOUNT_ID,
	})
	assert.throws(() => assertPayloadConfig({ name: 'rawkode-academy-website', account_id: PAYLOAD_ACCOUNT_ID }), /refusing to clean/)
	assert.throws(() => assertPayloadConfig({ name: PAYLOAD_WORKER_NAME, account_id: 'other' }), /unexpected Cloudflare account/)
})

test('cleanup options must name a mode and a dry-run flag', () => {
	assert.deepEqual(readOptions({ PREVIEW_CLEANUP_MODE: 'sweep', PREVIEW_CLEANUP_DRY_RUN: 'true' }), {
		mode: 'sweep', dryRun: true, pullRequest: null, branch: '',
	})
	assert.equal(readOptions({ PREVIEW_CLEANUP_MODE: 'pr', PREVIEW_CLEANUP_DRY_RUN: 'false', PREVIEW_CLEANUP_PR: '15', PREVIEW_CLEANUP_BRANCH: 'feat/x' }).pullRequest, 15)
	assert.throws(() => readOptions({ PREVIEW_CLEANUP_MODE: 'sweep', PREVIEW_CLEANUP_DRY_RUN: 'yes' }), /DRY_RUN/)
	assert.throws(() => readOptions({ PREVIEW_CLEANUP_MODE: 'pr', PREVIEW_CLEANUP_DRY_RUN: 'false', PREVIEW_CLEANUP_PR: '0' }), /pull request number/)
})

test('list parsers accept the Cloudflare envelope and stop at the last page', () => {
	const page = parsePreviewPage({
		success: true,
		result: [{ id: 'p1', name: 'pr-10', slug: 'pr-10' }],
		result_info: { page: 1, per_page: 100, total_count: 1 },
	})
	assert.equal(page.done, true)
	assert.equal(page.previews[0].slug, 'pr-10')
	const more = parsePreviewPage({ success: true, result: [{ name: 'pr-11' }], result_info: { page: 1, per_page: 1, total_count: 3 } })
	assert.equal(more.done, false)
	assert.equal(more.previews[0].slug, 'pr-11')
	const containers = parseContainerPage({
		success: true,
		result: [{ id: '0123456789abcdef0123456789abcdef', name: `${PAYLOAD_WORKER_NAME}_pr-10_ReviewFFmpegContainer` }],
		result_info: { next_page_token: 'next' },
	})
	assert.equal(containers.nextPageToken, 'next')
	assert.equal(parseContainerPage({ success: true, result: [] }).nextPageToken, null)
	assert.throws(() => parsePreviewPage({ success: false, errors: [{ message: 'nope' }] }), /nope/)
})

test('missing previews are recognised without treating every failure as gone', () => {
	assert.equal(isPreviewAlreadyGone('Preview not found [code: 10025]'), true)
	assert.equal(isPreviewAlreadyGone('Authentication error'), false)
	assert.equal(isContainerAlreadyGone('There has been an error deleting the container.\napplication not found'), true)
	assert.equal(isContainerAlreadyGone('wrangler.jsonc not found'), false)
	assert.deepEqual(parseGitHubPull({ number: 4, state: 'closed', head: { ref: 'feat/x' } }), { number: 4, branch: 'feat/x', state: 'closed' })
	assert.throws(() => parseGitHubPull({ number: 4, state: 'merged', head: { ref: 'feat/x' } }), /missing a state/)
})
