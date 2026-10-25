// Payload Worker Preview names. Pull-request builds use pr-<number> so cleanup
// can find them after the branch is gone. Anything else keeps the older
// pr-<branch> spelling, including the long-lived pr-local preview.

const BRANCH_LIMIT = 48

export function sanitizeBranch(sourceName) {
	const safe = String(sourceName ?? '')
		.toLowerCase()
		.replace(/[^a-z0-9-]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, BRANCH_LIMIT)
	return safe || 'local'
}

export function legacyPreviewName(branch) {
	return `pr-${sanitizeBranch(branch)}`
}

export function pullRequestPreviewName(number) {
	const parsed = asPullRequestNumber(number)
	if (parsed === null) throw new Error(`invalid pull request number ${number}`)
	return `pr-${parsed}`
}

export function asPullRequestNumber(value) {
	if (typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 999999999) return value
	if (typeof value === 'string' && /^[1-9][0-9]{0,8}$/.test(value)) return Number(value)
	return null
}

export async function loadGitHubEvent(env, readFile) {
	const eventPath = env.GITHUB_EVENT_PATH
	if (!eventPath) return undefined
	return JSON.parse(await readFile(eventPath, 'utf8'))
}

export function previewNameFromContext({ env, event }) {
	const explicit = typeof env.CLOUDFLARE_PREVIEW_NAME === 'string' ? env.CLOUDFLARE_PREVIEW_NAME.trim() : ''
	if (explicit) return legacyPreviewName(explicit)
	const number = pullRequestNumber(env, event)
	if (number) return pullRequestPreviewName(number)
	return legacyPreviewName(branchFromEnv(env))
}

function pullRequestNumber(env, event) {
	const fromEvent = asPullRequestNumber(event?.pull_request?.number)
	if (fromEvent) return fromEvent
	const ref = String(env.GITHUB_REF ?? '')
	const refMatch = ref.match(/^refs\/pull\/([1-9][0-9]*)\//)
	if (refMatch) return Number(refMatch[1])
	const refName = String(env.GITHUB_REF_NAME ?? '')
	const mergeMatch = refName.match(/^([1-9][0-9]*)\/merge$/)
	if (mergeMatch) return Number(mergeMatch[1])
	return null
}

function branchFromEnv(env) {
	if (env.GITHUB_HEAD_REF) return env.GITHUB_HEAD_REF
	const refName = env.GITHUB_REF_NAME
	if (refName && !/^[1-9][0-9]*\/merge$/.test(refName)) return refName
	const heads = String(env.GITHUB_REF ?? '').match(/^refs\/heads\/(.+)$/)
	if (heads) return heads[1]
	return 'local'
}
