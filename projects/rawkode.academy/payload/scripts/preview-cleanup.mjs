import { asPullRequestNumber, legacyPreviewName, pullRequestPreviewName } from './preview-name.mjs'

// Cleanup is allowlisted to this Worker and this account. The ids are the
// ones checked into wrangler.jsonc; a mismatch stops the run.
export const PAYLOAD_WORKER_NAME = 'rawkode-academy-payload'
export const PAYLOAD_ACCOUNT_ID = '0aeb879de8e3cdde5fb3d413025222ce'

// pr-local is the registered identity origin. It is not a pull-request preview.
export const PROTECTED_PREVIEW_NAMES = new Set(['pr-local'])

const PREVIEW_NAME_PATTERN = /^pr-[a-z0-9](?:[a-z0-9-]{0,62})?$/
const PR_NUMBER_PREVIEW = /^pr-([1-9][0-9]{0,8})$/
const CONTAINER_ID_PATTERN = /^(?:[0-9a-f]{32}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i

export function assertPayloadConfig(config) {
	if (config?.name !== PAYLOAD_WORKER_NAME) {
		throw new Error(`refusing to clean Cloudflare worker ${JSON.stringify(config?.name)}`)
	}
	if (config?.account_id !== PAYLOAD_ACCOUNT_ID) {
		throw new Error('refusing to clean an unexpected Cloudflare account')
	}
	return { workerName: config.name, accountId: config.account_id }
}

export function assertDeletablePreviewName(name) {
	if (typeof name !== 'string' || !PREVIEW_NAME_PATTERN.test(name)) {
		throw new Error(`refusing preview name ${JSON.stringify(name)}`)
	}
	if (PROTECTED_PREVIEW_NAMES.has(name)) {
		throw new Error(`refusing protected preview ${name}`)
	}
	return name
}

export function assertContainerId(id) {
	if (typeof id !== 'string' || !CONTAINER_ID_PATTERN.test(id)) {
		throw new Error(`refusing container id ${JSON.stringify(id)}`)
	}
	return id
}

export function readOptions(env) {
	const mode = env.PREVIEW_CLEANUP_MODE
	if (mode !== 'pr' && mode !== 'sweep') {
		throw new Error('PREVIEW_CLEANUP_MODE must be pr or sweep')
	}
	if (env.PREVIEW_CLEANUP_DRY_RUN !== 'true' && env.PREVIEW_CLEANUP_DRY_RUN !== 'false') {
		throw new Error('PREVIEW_CLEANUP_DRY_RUN must be true or false')
	}
	const pullRequest = mode === 'pr' ? asPullRequestNumber(env.PREVIEW_CLEANUP_PR) : null
	if (mode === 'pr' && pullRequest === null) {
		throw new Error('PREVIEW_CLEANUP_PR must be a pull request number')
	}
	const branch = typeof env.PREVIEW_CLEANUP_BRANCH === 'string' ? env.PREVIEW_CLEANUP_BRANCH.trim() : ''
	return { mode, dryRun: env.PREVIEW_CLEANUP_DRY_RUN === 'true', pullRequest, branch }
}

export function classifyPreviewName(name, { openPullRequests, closedPullRequests }) {
	if (PROTECTED_PREVIEW_NAMES.has(name)) {
		return { action: 'skip', reason: 'protected preview name' }
	}
	if (typeof name !== 'string' || !PREVIEW_NAME_PATTERN.test(name)) {
		return { action: 'skip', reason: 'name is outside the preview pattern' }
	}
	const numeric = name.match(PR_NUMBER_PREVIEW)
	if (numeric) {
		const number = Number(numeric[1])
		if (openPullRequests.some((pullRequest) => pullRequest.number === number)) {
			return { action: 'skip', reason: `pull request ${number} is open` }
		}
		if (openPullRequests.some((pullRequest) => legacyName(pullRequest) === name)) {
			return { action: 'skip', reason: 'an open pull request still uses this name' }
		}
		if (closedPullRequests.some((pullRequest) => pullRequest.number === number)) {
			return { action: 'delete', reason: `pull request ${number} is closed` }
		}
		if (closedPullRequests.some((pullRequest) => legacyName(pullRequest) === name)) {
			return { action: 'delete', reason: 'legacy branch preview belongs to a closed pull request' }
		}
		return { action: 'skip', reason: `pull request ${number} is not a known closed pull request` }
	}
	if (openPullRequests.some((pullRequest) => legacyName(pullRequest) === name)) {
		return { action: 'skip', reason: 'an open pull request still uses this legacy branch name' }
	}
	if (closedPullRequests.some((pullRequest) => legacyName(pullRequest) === name)) {
		return { action: 'delete', reason: 'legacy branch preview belongs to a closed pull request and no open pull request' }
	}
	return { action: 'skip', reason: 'no closed pull request uses this legacy branch name' }
}

export function planClosedPullRequest({ number, branch, openPullRequests }) {
	const parsed = asPullRequestNumber(number)
	if (parsed === null) throw new Error(`invalid pull request number ${number}`)
	const closedPullRequests = [{ number: parsed, branch }]
	const names = [pullRequestPreviewName(parsed)]
	if (branch) names.push(legacyPreviewName(branch))
	return unique(names).map((name) => ({
		name,
		...classifyPreviewName(name, { openPullRequests, closedPullRequests }),
	}))
}

export function previewSlugFromContainer(appName, workerName = PAYLOAD_WORKER_NAME) {
	if (workerName !== PAYLOAD_WORKER_NAME || typeof appName !== 'string') return null
	const prefix = `${workerName}_`
	if (!appName.startsWith(prefix)) return null
	const rest = appName.slice(prefix.length)
	const separator = rest.indexOf('_')
	if (separator <= 0) return null
	const slug = rest.slice(0, separator)
	if (!PREVIEW_NAME_PATTERN.test(slug) || PROTECTED_PREVIEW_NAMES.has(slug)) return null
	return slug
}

export function containerBelongsToPreview(appName, slug) {
	const parsed = previewSlugFromContainer(appName)
	return parsed !== null && parsed === slug
}

export function containerSlugsForDeletion(decisions, previews, openPullRequests = []) {
	const selected = new Set(decisions.filter((decision) => decision.action === 'delete').map((decision) => decision.name))
	const openNames = new Set(openPullRequests.flatMap((pullRequest) => {
		const names = [`pr-${pullRequest.number}`]
		if (pullRequest.branch) names.push(legacyPreviewName(pullRequest.branch))
		return names
	}))
	const slugs = new Set()
	for (const name of selected) {
		if (canBeContainerSlug(name)) slugs.add(name)
	}
	for (const preview of previews) {
		if (!selected.has(preview.name) || !canBeContainerSlug(preview.slug) || openNames.has(preview.slug)) continue
		slugs.add(preview.slug)
	}
	return slugs
}

function canBeContainerSlug(name) {
	try {
		assertDeletablePreviewName(name)
		return true
	} catch {
		return false
	}
}

export function deletionCommand(kind, target) {
	if (kind === 'preview') {
		return ['preview', 'delete', '--config', 'wrangler.jsonc', '--worker-name', PAYLOAD_WORKER_NAME, '--name', assertDeletablePreviewName(target), '--skip-confirmation']
	}
	if (kind === 'container') {
		return ['containers', 'delete', assertContainerId(target), '--config', 'wrangler.jsonc']
	}
	throw new Error(`refusing to delete ${kind}`)
}

export function isPreviewAlreadyGone(text) {
	return /\b10025\b|Preview not found/i.test(text)
}

export function isContainerAlreadyGone(text) {
	return /\b404\b|application (was )?not found|could not find the container/i.test(text)
}

export function parsePreviewPage(body, requestedPerPage = 100) {
	assertSuccess(body, 'preview list')
	let result = Array.isArray(body) ? body : body.result
	if (result && !Array.isArray(result) && Array.isArray(result.previews)) result = result.previews
	if (!Array.isArray(result)) {
		throw new Error(`preview list returned an unexpected shape (${Object.keys(body).join(', ')})`)
	}
	const previews = result.map((item) => {
		if (!item || typeof item.name !== 'string') throw new Error('preview list entry is missing a name')
		const slug = typeof item.slug === 'string' && item.slug ? item.slug : item.name
		return { name: item.name, slug, id: typeof item.id === 'string' ? item.id : '' }
	})
	const info = body.result_info
	const done = info && Number.isFinite(info.total_count) && Number.isFinite(info.page) && Number.isFinite(info.per_page)
		? info.page * info.per_page >= info.total_count || previews.length === 0
		: previews.length < requestedPerPage
	return { previews, done }
}

export function parseContainerPage(body) {
	assertSuccess(body, 'container list')
	const result = Array.isArray(body) ? body : body.result
	if (!Array.isArray(result)) {
		throw new Error(`container list returned an unexpected shape (${Object.keys(body).join(', ')})`)
	}
	const apps = result.map((item) => {
		const id = item?.id ?? item?.application_id
		const name = item?.name
		if (typeof id !== 'string' || typeof name !== 'string') {
			throw new Error('container list entry is missing id or name')
		}
		return { id, name }
	})
	const token = body.result_info?.next_page_token || body.result_info?.cursor || ''
	return { apps, nextPageToken: token || null }
}

export function parseGitHubPull(pullRequest) {
	const number = asPullRequestNumber(pullRequest?.number)
	if (number === null) throw new Error('GitHub pull request is missing a number')
	const branch = typeof pullRequest.head?.ref === 'string' ? pullRequest.head.ref : ''
	const state = pullRequest.state === 'open' || pullRequest.state === 'closed' ? pullRequest.state : ''
	if (!state) throw new Error(`GitHub pull request ${number} is missing a state`)
	return { number, branch, state }
}

function legacyName(pullRequest) {
	return pullRequest.branch ? legacyPreviewName(pullRequest.branch) : null
}

function unique(values) {
	return [...new Set(values)]
}

function assertSuccess(body, label) {
	if (!body || typeof body !== 'object' || body.success === false) {
		const message = Array.isArray(body?.errors) ? body.errors.map((error) => error.message).filter(Boolean).join('; ') : ''
		throw new Error(message || `${label} failed`)
	}
}
