import { spawn } from 'node:child_process'
import { appendFile, readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import {
	assertContainerId,
	assertPayloadConfig,
	classifyPreviewName,
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
} from './preview-cleanup.mjs'
import { legacyPreviewName, pullRequestPreviewName } from './preview-name.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PAGE_LIMIT = 50

async function main() {
	process.chdir(root)
	const options = readOptions(process.env)
	const config = assertPayloadConfig(JSON.parse(await readFile(resolve(root, 'wrangler.jsonc'), 'utf8')))
	const cloudflareToken = process.env.CLOUDFLARE_API_TOKEN
	const githubToken = process.env.GITHUB_TOKEN
	const repository = process.env.GITHUB_REPOSITORY ?? ''
	if (!cloudflareToken) throw new Error('CLOUDFLARE_API_TOKEN is not set')
	if (!githubToken) throw new Error('GITHUB_TOKEN is not set')
	const [owner, repo, extra] = repository.split('/')
	if (!owner || !repo || extra !== undefined) throw new Error('GITHUB_REPOSITORY must be owner/name')

	const cloudflare = cloudflareClient(cloudflareToken)
	const github = githubClient(githubToken)
	console.log(`mode: ${options.mode}`)
	console.log(`dry-run: ${options.dryRun}`)
	console.log(`worker: ${config.workerName}`)
	console.log('leaving the production worker, rawkode-academy-payload-review-runtime, shared preview D1/R2, and pr-local untouched')

	const open = await listPullRequests(github, owner, repo, 'open')
	if (open.truncated) throw new Error('open pull request list was truncated; refusing to delete')

	const closed = await closedPullRequests(github, owner, repo, options)
	if (!closed) return
	const previews = await loadPreviews(options, cloudflare, config, open.pulls, closed.pulls)
	const containers = await loadContainers(options, cloudflare, config.accountId)
	const decisions = await decisionsFor({ options, open: open.pulls, closed, previews, containers, github, owner, repo })
	const deleting = decisions.filter((decision) => decision.action === 'delete')
	const skipping = decisions.filter((decision) => decision.action === 'skip')
	for (const decision of [...deleting, ...skipping]) {
		console.log(`${decision.action} ${showName(decision.name)}: ${decision.reason}`)
	}
	const slugs = containerSlugsForDeletion(decisions, previews, open.pulls)
	const containerTargets = containers.filter((app) => {
		const slug = previewSlugFromContainer(app.name)
		return slug !== null && slugs.has(slug)
	})
	const uniqueContainers = [...new Map(containerTargets.map((app) => [app.id, app])).values()]
	for (const app of uniqueContainers) console.log(`delete container ${app.id} ${showName(app.name)}`)
	if (deleting.length === 0 && uniqueContainers.length === 0) console.log('nothing to delete')
	await writeSummary(options, deleting, uniqueContainers)
	if (options.dryRun) return

	const wrangler = createRequire(import.meta.url).resolve('wrangler/bin/wrangler.js')
	const failures = []
	for (const decision of deleting) {
		const known = previews.some((preview) => preview.name === decision.name || preview.slug === decision.name)
		const explicit = options.mode === 'pr' && explicitPreviewNames(options, closed.pulls[0].branch, open.pulls).includes(decision.name)
		if (!known && !explicit) continue
		const result = await runWrangler(wrangler, deletionCommand('preview', decision.name))
		if (result.status !== 0 && !isPreviewAlreadyGone(result.output)) failures.push(`preview ${decision.name} exited ${result.status}`)
		else console.log(result.status === 0 ? `deleted preview ${decision.name}` : `preview ${decision.name} was already gone`)
	}
	for (const app of uniqueContainers) {
		let args
		try {
			args = deletionCommand('container', assertContainerId(app.id))
		} catch (error) {
			failures.push(`container ${showName(app.name)}: ${error instanceof Error ? error.message : error}`)
			continue
		}
		const result = await runWrangler(wrangler, args)
		if (result.status !== 0 && !isContainerAlreadyGone(result.output)) failures.push(`container ${app.id} exited ${result.status}`)
		else console.log(result.status === 0 ? `deleted container ${app.id}` : `container ${app.id} was already gone`)
	}
	if (failures.length > 0) {
		for (const failure of failures) console.error(`failed: ${failure}`)
		process.exitCode = 1
	}
}

async function closedPullRequests(github, owner, repo, options) {
	if (options.mode === 'sweep') {
		const listed = await listPullRequests(github, owner, repo, 'closed')
		if (listed.truncated) console.log('closed pull request list was truncated; numeric previews missing from it are checked individually')
		return listed
	}
	const pullRequest = await getPullRequest(github, owner, repo, options.pullRequest)
	if (!pullRequest) {
		console.log(`pull request ${options.pullRequest} was not found; nothing to delete`)
		return null
	}
	if (pullRequest.state !== 'closed') {
		console.log(`pull request ${pullRequest.number} is ${pullRequest.state}; nothing to delete`)
		return null
	}
	return { pulls: [{ ...pullRequest, branch: pullRequest.branch || options.branch }], truncated: false }
}

async function loadPreviews(options, cloudflare, config, openPullRequests, closedPullRequests) {
	try {
		const listed = await listPreviews(cloudflare, config)
		if (listed) return listed
		if (options.mode === 'pr') {
			console.log('Worker Preview list endpoint was unavailable; deleting this pull request by name')
			return []
		}
		console.log('Worker Preview list endpoint was unavailable; checking closed pull requests directly')
	} catch (error) {
		if (options.mode === 'sweep') throw error
		console.log(`preview list failed (${error instanceof Error ? error.message : error}); deleting this pull request by name`)
		return []
	}
	const found = []
	for (const name of candidateNames(closedPullRequests)) {
		const decision = classifyPreviewName(name, { openPullRequests, closedPullRequests })
		if (decision.action !== 'delete') continue
		if (await previewExists(cloudflare, config, name)) found.push({ name, slug: name, id: '' })
	}
	return found
}

async function loadContainers(options, cloudflare, accountId) {
	try {
		return await listContainers(cloudflare, accountId)
	} catch (error) {
		if (options.mode === 'sweep') throw error
		console.log(`container list failed (${error instanceof Error ? error.message : error}); deleting the preview record anyway`)
		return []
	}
}

function candidateNames(pullRequests) {
	const names = []
	for (const pullRequest of pullRequests) {
		names.push(pullRequestPreviewName(pullRequest.number))
		if (pullRequest.branch) names.push(legacyPreviewName(pullRequest.branch))
	}
	return [...new Set(names)]
}

function explicitPreviewNames(options, branch, openPullRequests) {
	return planClosedPullRequest({ number: options.pullRequest, branch, openPullRequests })
		.filter((item) => item.action === 'delete')
		.map((item) => item.name)
}

async function decisionsFor({ options, open, closed, previews, containers, github, owner, repo }) {
	const names = new Set(options.mode === 'pr' ? explicitPreviewNames(options, closed.pulls[0].branch, open) : [])
	for (const preview of previews) {
		names.add(preview.name)
		if (preview.slug) names.add(preview.slug)
	}
	for (const app of containers) {
		const slug = previewSlugFromContainer(app.name)
		if (slug) names.add(slug)
	}
	const decisions = [...names].sort().map((name) => ({ name, ...classifyPreviewName(name, { openPullRequests: open, closedPullRequests: closed.pulls }) }))
	if (options.mode !== 'sweep' || !closed.truncated) return decisions
	for (const decision of decisions) {
		const match = decision.name.match(/^pr-([1-9][0-9]{0,8})$/)
		if (!match || decision.action === 'delete') continue
		if (decision.reason.endsWith('is open') || decision.reason.includes('open pull request still uses this name')) continue
		const pullRequest = await getPullRequest(github, owner, repo, Number(match[1]))
		if (pullRequest?.state === 'closed') {
			decision.action = 'delete'
			decision.reason = `pull request ${pullRequest.number} is closed`
		} else if (pullRequest?.state === 'open') {
			decision.action = 'skip'
			decision.reason = `pull request ${pullRequest.number} is open`
		}
	}
	return decisions
}

async function listPreviews(cloudflare, config) {
	const previews = []
	const seen = new Set()
	for (let page = 1; page <= PAGE_LIMIT; page += 1) {
		const response = await cloudflare(`/accounts/${config.accountId}/workers/workers/${config.workerName}/previews?per_page=100&page=${page}`)
		if (page === 1 && (response.status === 404 || response.status === 405)) return null
		if (response.status !== 200) throw new Error(`preview list failed (${response.status})`)
		const parsed = parsePreviewPage(response.body)
		const fresh = parsed.previews.filter((preview) => {
			const key = preview.id || preview.name
			if (seen.has(key)) return false
			seen.add(key)
			return true
		})
		if (parsed.previews.length > 0 && fresh.length === 0) return previews
		previews.push(...fresh)
		if (parsed.done) return previews
	}
	throw new Error('preview list exceeded 50 pages; refusing to delete')
}

async function previewExists(cloudflare, config, name) {
	const response = await cloudflare(`/accounts/${config.accountId}/workers/workers/${config.workerName}/previews/${encodeURIComponent(name)}`)
	if (response.status === 200 && response.body?.success !== false && response.body?.result?.name) return true
	const code = response.body?.errors?.[0]?.code
	const message = response.body?.errors?.[0]?.message ?? ''
	if (response.status === 404 || code === 10025 || /Preview not found/i.test(message)) return false
	throw new Error(`preview lookup for ${name} failed (${response.status})`)
}

async function listContainers(cloudflare, accountId) {
	const first = await cloudflare(`/accounts/${accountId}/containers/dash/applications?per_page=100`)
	if (first.status === 404 || first.status === 405) {
		const plain = await cloudflare(`/accounts/${accountId}/containers/applications`)
		if (plain.status !== 200) throw new Error(`container list failed (${plain.status})`)
		return parseContainerPage(plain.body).apps
	}
	if (first.status !== 200) throw new Error(`container list failed (${first.status})`)
	const apps = []
	const seenTokens = new Set()
	let response = first
	let token = null
	for (let page = 0; page < PAGE_LIMIT; page += 1) {
		if (page > 0) {
			response = await cloudflare(`/accounts/${accountId}/containers/dash/applications?per_page=100&page_token=${encodeURIComponent(token)}`)
			if (response.status !== 200) throw new Error(`container list failed (${response.status})`)
		}
		const parsed = parseContainerPage(response.body)
		apps.push(...parsed.apps)
		if (!parsed.nextPageToken) return apps
		if (seenTokens.has(parsed.nextPageToken)) throw new Error('container pagination did not advance')
		seenTokens.add(parsed.nextPageToken)
		token = parsed.nextPageToken
	}
	throw new Error('container list exceeded 50 pages; refusing to delete')
}

async function listPullRequests(github, owner, repo, state) {
	const pulls = []
	for (let page = 1; page <= 20; page += 1) {
		const response = await github(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls?state=${state}&per_page=100&page=${page}`)
		if (response.status !== 200 || !Array.isArray(response.body)) throw new Error(`GitHub ${state} pull request list failed (${response.status})`)
		pulls.push(...response.body.map(parseGitHubPull))
		if (response.body.length < 100) return { pulls, truncated: false }
	}
	return { pulls, truncated: true }
}

async function getPullRequest(github, owner, repo, number) {
	const response = await github(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls/${number}`)
	if (response.status === 404) return null
	if (response.status !== 200) throw new Error(`GitHub pull request ${number} lookup failed (${response.status})`)
	const pullRequest = parseGitHubPull(response.body)
	if (pullRequest.number !== number) throw new Error(`GitHub returned pull request ${pullRequest.number} for ${number}`)
	return pullRequest
}

function cloudflareClient(token) {
	return async (path) => readJson(await fetch(`https://api.cloudflare.com/client/v4${path}`, {
		headers: { Authorization: `Bearer ${token}` },
		signal: AbortSignal.timeout(30_000),
	}))
}

function githubClient(token) {
	return async (path) => readJson(await fetch(`https://api.github.com${path}`, {
		headers: {
			Authorization: `Bearer ${token}`,
			Accept: 'application/vnd.github+json',
			'User-Agent': 'rawkode-academy-preview-cleanup',
			'X-GitHub-Api-Version': '2022-11-28',
		},
		signal: AbortSignal.timeout(30_000),
	}))
}

async function readJson(response) {
	const text = await response.text()
	let body = {}
	if (text) {
		try {
			body = JSON.parse(text)
		} catch {
			throw new Error(`response was not JSON (${response.status})`)
		}
	}
	return { status: response.status, body }
}

function runWrangler(wrangler, args) {
	return new Promise((resolvePromise, reject) => {
		const child = spawn(process.execPath, [wrangler, ...args], {
			cwd: root,
			env: { ...process.env, CI: 'true' },
			stdio: ['ignore', 'pipe', 'pipe'],
		})
		let output = ''
		const onData = (chunk) => {
			const text = redact(String(chunk))
			output += text
			process.stdout.write(text)
		}
		child.stdout.setEncoding('utf8')
		child.stderr.setEncoding('utf8')
		child.stdout.on('data', onData)
		child.stderr.on('data', onData)
		child.once('error', reject)
		child.once('close', (status) => resolvePromise({ status: status ?? 1, output }))
	})
}

function redact(text) {
	return [process.env.CLOUDFLARE_API_TOKEN, process.env.GITHUB_TOKEN].filter(Boolean).reduce(
		(current, secret) => current.split(secret).join('[redacted]'),
		text,
	)
}

function showName(name) {
	return /^[A-Za-z0-9_-]+$/.test(name) ? name : JSON.stringify(name)
}

async function writeSummary(options, deleting, containers) {
	const path = process.env.GITHUB_STEP_SUMMARY
	if (!path) return
	const previewLines = deleting.length === 0 ? ['- no previews'] : deleting.map((decision) => `- preview \`${decision.name}\` — ${decision.reason}`)
	const containerLines = containers.length === 0 ? ['- no container apps'] : containers.map((app) => `- container \`${app.id}\` \`${app.name}\``)
	const heading = options.dryRun ? 'Cloudflare preview cleanup (dry run)' : 'Cloudflare preview cleanup'
	const body = [`### ${heading}`, '', ...previewLines, ...containerLines, ''].join('\n')
	await appendFile(path, body)
}

const isDirect = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href
if (isDirect) {
	main().catch((error) => {
		console.error(error instanceof Error ? error.message : error)
		process.exit(1)
	})
}
