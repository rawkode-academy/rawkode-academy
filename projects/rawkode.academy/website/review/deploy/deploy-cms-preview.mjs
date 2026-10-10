import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { appendFile, readFile, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import {
	ensurePrPreviewResources,
	namesForPullRequest,
	pullRequestIdentity,
} from '../../../payload/scripts/pr-preview-resources.mjs'

const identity = pullRequestIdentity()
const resources = await ensurePrPreviewResources()
if (resources.pullRequestNumber !== identity.pullRequestNumber || resources.sha !== identity.sha) {
	throw new Error('The Payload preview resources are not keyed to this website workflow PR/SHA.')
}

const names = namesForPullRequest(identity.pullRequestNumber, identity.sha)
const waitSeconds = Number(process.env.PR_PREVIEW_WAIT_SECONDS ?? '1500')
if (!Number.isSafeInteger(waitSeconds) || waitSeconds < 1 || waitSeconds > 7200) {
	throw new Error('PR_PREVIEW_WAIT_SECONDS must be between 1 and 7200.')
}

async function hasWebpSignature(response) {
	const reader = response.body?.getReader()
	if (!reader) return false
	const signature = []
	try {
		for (let reads = 0; reads < 8 && signature.length < 12; reads += 1) {
			const { value, done } = await reader.read()
			if (done) break
			for (const byte of value ?? []) {
				if (signature.length === 12) break
				signature.push(byte)
			}
		}
	} finally {
		await reader.cancel().catch(() => {})
		reader.releaseLock()
	}
	return (
		String.fromCharCode(...signature.slice(0, 4)) === 'RIFF' &&
		String.fromCharCode(...signature.slice(8, 12)) === 'WEBP'
	)
}

function hasValidD2SaveEvidence(value) {
	return Boolean(
		value &&
		value.articleStatus === 'draft' &&
		value.hiddenFromPublic === true &&
		typeof value.articleId === 'string' &&
		typeof value.articleSlug === 'string' &&
		/^[a-f0-9]{64}$/i.test(value.sourceHash ?? '') &&
		/^[a-f0-9]{64}$/i.test(value.svgChecksum ?? ''),
	)
}

function assertPublicSsrCachePolicy(response) {
	// Cloudflare consumes and strips Cloudflare-CDN-Cache-Control before the
	// response reaches clients. Check the client-visible policies and verify
	// the actual release boundary with CF-Cache-Status below.
	const headers = ['cache-control', 'cdn-cache-control']
		.map(name => [name, response.headers.get(name)])
		.filter(([, value]) => value)
	if (!headers.length) throw new Error('The Astro SSR response did not expose cache-control headers.')
	if (!headers.some(([name, value]) => name === 'cache-control' && /(?:^|,)\s*public(?:,|$)/i.test(value))) {
		throw new Error('The Astro SSR response is missing its public Cache-Control directive.')
	}
	let foundMaxAge = false
	for (const [name, value] of headers) {
		const directives = value.split(',').map(part => part.trim())
		if (directives.some(part => /^stale-(?:while-revalidate|if-error)(?:=|$)/i.test(part))) {
			throw new Error(`The Astro SSR ${name} header includes a stale-serving directive.`)
		}
		for (const directive of directives) {
			const key = directive.split('=', 1)[0]?.trim().toLowerCase()
			if (key !== 'max-age' && key !== 's-maxage') continue
			const rawSeconds = directive.slice(directive.indexOf('=') + 1).trim().replace(/^"|"$/g, '')
			const seconds = Number(rawSeconds)
			if (!Number.isSafeInteger(seconds) || seconds < 0 || seconds > 30) {
				throw new Error(`The Astro SSR ${name} ${key} must be between 0 and 30 seconds.`)
			}
			foundMaxAge = true
		}
	}
	if (!foundMaxAge) throw new Error('The Astro SSR response did not expose a max-age or s-maxage freshness bound.')
	const cachePolicy = response.headers.get('cache-control')?.toLowerCase() ?? ''
	if (!/(?:^|,)\s*must-revalidate(?:,|$)/i.test(cachePolicy)) {
		throw new Error('The client-visible Cache-Control policy must forbid stale responses; the scheduled release probe verifies Cloudflare edge behavior.')
	}
}

function responseCacheAges(response) {
	return ['cache-control', 'cdn-cache-control', 'cloudflare-cdn-cache-control']
		.flatMap(name => (response.headers.get(name) ?? '').split(',').map(part => part.trim()))
		.filter(part => /^(?:s-maxage|max-age)=/i.test(part))
		.map(part => Number(part.slice(part.indexOf('=') + 1).replace(/^"|"$/g, '')))
		.filter(Number.isSafeInteger)
}

// Both PR workflows are triggered by changes under either project. Wait for
// the exact SHA's Payload job to finish before uploading the website Worker;
// its success includes D1 migrations, static import and Payload deployment.
const repository = process.env.GITHUB_REPOSITORY
const githubToken = process.env.GITHUB_TOKEN
const apiUrl = process.env.GITHUB_API_URL ?? 'https://api.github.com'
if (!repository || !/^[^/]+\/[^/]+$/.test(repository) || !githubToken) {
	throw new Error('GITHUB_REPOSITORY and GITHUB_TOKEN are required to wait for the paired Payload PR workflow.')
}
const payloadCheckUrl = new URL(`${apiUrl.replace(/\/+$/, '')}/repos/${repository}/commits/${identity.sha}/check-runs?per_page=100`)
const payloadCheckDeadline = Date.now() + waitSeconds * 1000
let payloadReady = false
let payloadCheckState = 'Payload workflow check has not appeared yet'
let payloadCheckLogAt = 0
while (Date.now() < payloadCheckDeadline) {
	try {
		const response = await fetch(payloadCheckUrl, {
			headers: {
				accept: 'application/vnd.github+json',
				authorization: `Bearer ${githubToken}`,
				'x-github-api-version': '2022-11-28',
			},
			signal: AbortSignal.timeout(10_000),
		})
		const body = await response.json().catch(() => null)
		if (!response.ok) {
			if (response.status === 401 || response.status === 403) throw new Error(`GitHub check-run API denied access (HTTP ${response.status}).`)
			payloadCheckState = `GitHub check-run API returned HTTP ${response.status}`
		} else {
			const check = (body?.check_runs ?? [])
				.filter(candidate => candidate.name === 'rawkode-academy-payload-pullRequest')
				.sort((left, right) => Date.parse(right.started_at ?? right.created_at) - Date.parse(left.started_at ?? left.created_at))[0]
			if (check?.status === 'completed') {
				if (check.conclusion !== 'success') throw new Error(`The paired Payload PR workflow completed with conclusion ${check.conclusion ?? 'unknown'} for ${identity.sha}.`)
				payloadReady = true
				break
			}
			payloadCheckState = check ? `Payload workflow is ${check.status}` : 'Payload workflow check has not appeared yet'
		}
	} catch (error) {
		if (error instanceof Error && /GitHub check-run API denied|paired Payload PR workflow completed/.test(error.message)) throw error
		payloadCheckState = error instanceof Error ? error.message : String(error)
	}
	if (Date.now() - payloadCheckLogAt >= 60_000) {
		console.log(`Waiting for Payload PR workflow on ${identity.sha}: ${payloadCheckState}`)
		payloadCheckLogAt = Date.now()
	}
	await new Promise(resolve => setTimeout(resolve, 5_000))
}
if (!payloadReady) throw new Error(`Timed out waiting for successful Payload PR workflow on ${identity.sha}: ${payloadCheckState}`)

const configPath = path.resolve('dist/server/wrangler.json')
const previewConfigPath = path.resolve('dist/server/wrangler.pr-preview.json')
const isolationConfigPath = path.resolve('dist/server/wrangler.isolation.pr-preview.json')
const config = JSON.parse(await readFile(configPath, 'utf8'))
if (!Array.isArray(config.compatibility_flags) || !config.compatibility_flags.includes('enable_ctx_exports')) {
	throw new Error('The generated Astro Wrangler config must preserve enable_ctx_exports for the custom WorkerEntrypoint exports.')
}
if (typeof config.main !== 'string' || !config.main.trim() || config.main === '@astrojs/cloudflare/entrypoints/server') {
	throw new Error('The generated Astro Wrangler config must point at the custom Astro Worker entrypoint.')
}
const generatedWorkerEntrypoint = path.resolve(path.dirname(configPath), config.main)
let generatedWorkerSource
try {
	generatedWorkerSource = await readFile(generatedWorkerEntrypoint, 'utf8')
} catch (error) {
	throw new Error(`The generated custom Astro Worker entrypoint is not readable at ${generatedWorkerEntrypoint}: ${error instanceof Error ? error.message : String(error)}`)
}
if (!generatedWorkerSource.includes('CachedAstro') || !generatedWorkerSource.includes('PUBLIC_SSR_CACHE_ENABLED')) {
	throw new Error(`The generated Wrangler main ${config.main} does not contain the custom CachedAstro WorkerEntrypoint.`)
}
config.name = names.websiteWorkerName
config.workers_dev = true
config.preview_urls = true
// Never route a PR preview through the production website hostname.
delete config.routes

// Astro SSR sessions are isolated per PR/SHA. A preview must never write to
// the production SESSION namespace.
const sessions = (config.kv_namespaces ?? []).filter(binding => binding.binding === 'SESSION')
if (sessions.length !== 1 || !resources.sessionNamespaceId) {
	throw new Error('The generated Astro Worker must have exactly one SESSION KV binding and a PR-isolated namespace.')
}
sessions[0].id = resources.sessionNamespaceId
delete sessions[0].preview_id

// PR previews must not write to any production service. Keep only the three
// explicitly read-only models used by server-rendered public pages. Identity
// goes to a per-PR deny-all Worker so auth helpers cannot fall back to direct
// requests to the production identity service.
const previewReadModels = new Set(['BRACKETS_READ', 'LEADERBOARD_READ', 'ACHIEVEMENTS_READ'])
config.services = (config.services ?? []).filter(binding => previewReadModels.has(binding.binding))
config.services.push({ binding: 'IDENTITY', service: names.websiteIsolationWorkerName })
config.services.push({ binding: 'PAYLOAD_CONTENT', service: names.workerName, entrypoint: 'PublicContentBridge' })
config.images = { ...(config.images ?? {}), binding: 'IMAGES' }
// Applications and newsletter preferences must not send external email.
delete config.send_email
config.vars = {
	...(config.vars ?? {}),
	PAYLOAD_PREVIEW_PR: String(identity.pullRequestNumber),
	PAYLOAD_PREVIEW_SHA: identity.sha,
	PUBLIC_SSR_CACHE_ENABLED: 'true',
}
// Keep the public request gateway uncached. Only its named inner Astro entrypoint
// uses Workers Cache after the gateway has excluded credentials and interactive routes.
config.exports = { ...(config.exports ?? {}) }
config.exports.default = { ...(config.exports.default ?? {}), type: 'worker', cache: { ...(config.exports.default?.cache ?? {}), enabled: false } }
config.exports.CachedAstro = { ...(config.exports.CachedAstro ?? {}), type: 'worker', cache: { ...(config.exports.CachedAstro?.cache ?? {}), enabled: true } }

const accountId = config.account_id ?? config.vars?.CLOUDFLARE_ACCOUNT_ID
if (typeof accountId !== 'string' || !/^[0-9a-f]{32}$/i.test(accountId)) {
	throw new Error('The generated website Worker config must provide its Cloudflare account ID for the isolated identity guard.')
}
config.account_id = accountId
// Preview traces/logs must not be forwarded to the production Grafana workers.
delete config.observability
const isolationConfig = {
	name: names.websiteIsolationWorkerName,
	account_id: accountId,
	main: '../../scripts/preview-isolation-worker.mjs',
	compatibility_date: config.compatibility_date,
	compatibility_flags: config.compatibility_flags,
	workers_dev: false,
	preview_urls: false,
}
await writeFile(previewConfigPath, `${JSON.stringify(config, null, 2)}\n`)
await writeFile(isolationConfigPath, `${JSON.stringify(isolationConfig, null, 2)}\n`)

try {
	const guard = spawn('node', [
		'node_modules/wrangler/bin/wrangler.js',
		'deploy',
		'--config',
		isolationConfigPath,
	], { env: { ...process.env, CI: 'true' }, stdio: ['ignore', 'pipe', 'pipe'] })
	let guardStatus = 0
	guard.stdout.setEncoding('utf8')
	guard.stderr.setEncoding('utf8')
	guard.stdout.on('data', chunk => process.stdout.write(chunk))
	guard.stderr.on('data', chunk => process.stderr.write(chunk))
	guardStatus = await new Promise((resolve, reject) => {
		guard.once('error', reject)
		guard.once('close', code => resolve(code))
	})
	if (guardStatus !== 0) throw new Error(`Wrangler failed to deploy the per-PR identity isolation Worker (exit ${guardStatus}).`)

	const child = spawn('node', [
		'node_modules/wrangler/bin/wrangler.js',
		'versions',
		'upload',
		'--config',
		previewConfigPath,
	], { env: { ...process.env, CI: 'true' }, stdio: ['ignore', 'pipe', 'pipe'] })
	let stdout = ''
	let stderr = ''
	child.stdout.setEncoding('utf8')
	child.stderr.setEncoding('utf8')
	child.stdout.on('data', chunk => { stdout += chunk; process.stdout.write(chunk) })
	child.stderr.on('data', chunk => { stderr += chunk; process.stderr.write(chunk) })
	const status = await new Promise((resolve, reject) => {
		child.once('error', reject)
		child.once('close', code => resolve(code))
	})
	if (status !== 0) throw new Error(`Wrangler versions upload failed with exit code ${status}.`)

	const output = `${stdout}\n${stderr}`
	const matches = [...output.matchAll(/Version Preview URL:\s*(https?:\/\/\S+)/g)]
	const previewUrl = matches.at(-1)?.[1]?.replace(/[),]+$/, '')
	if (!previewUrl) throw new Error('Wrangler did not print a Version Preview URL for the Astro SSR preview.')

	// This preview-only POST proves the paired bridge is reachable and returns a
	// future publication fixture. It also exercises the CMS D2 save hook when
	// the isolated preview has a D2_RENDERER binding.
	const diagnosticUrl = new URL('/__cms-preview-check', previewUrl)
	const diagnosticDeadline = Date.now() + Math.min(waitSeconds, 120) * 1000
	let sentinel
	let scheduledVideo
	let d2Save
	let d2SaveCapability
	let diagnosticState = 'no response'
	while (Date.now() < diagnosticDeadline) {
		try {
			const response = await fetch(diagnosticUrl, {
				method: 'POST',
				headers: { accept: 'application/json', 'cache-control': 'no-store' },
				signal: AbortSignal.timeout(15_000),
			})
			const body = await response.json().catch(() => null)
			const d2CapabilityValid = body?.d2SaveCapability === 'available'
				? hasValidD2SaveEvidence(body?.d2Save)
				: body?.d2SaveCapability === 'unavailable' &&
					body &&
					!Object.prototype.hasOwnProperty.call(body, 'd2Save')
			if (
				response.ok &&
				typeof body?.video?.id === 'string' &&
				typeof body?.video?.slug === 'string' && body.video.slug.trim() &&
				typeof body?.video?.title === 'string' && body.video.title.trim() &&
				typeof body?.scheduledVideo?.id === 'string' &&
				typeof body?.scheduledVideo?.slug === 'string' && body.scheduledVideo.slug.trim() &&
				typeof body?.scheduledVideo?.title === 'string' && body.scheduledVideo.title.trim() &&
				typeof body?.scheduledVideo?.publishedAt === 'string' &&
				d2CapabilityValid
			) {
				sentinel = body.video
				scheduledVideo = body.scheduledVideo
				d2SaveCapability = body.d2SaveCapability
				d2Save = d2SaveCapability === 'available' ? body.d2Save : undefined
				break
			}
			diagnosticState = `HTTP ${response.status}, Payload preview diagnostic returned incomplete content, D2 capability, or schedule evidence`
		} catch (error) {
			diagnosticState = error instanceof Error ? error.message : String(error)
		}
		console.log(`Waiting for Astro PAYLOAD_CONTENT diagnostic ${names.workerName}: ${diagnosticState}`)
		await new Promise(resolve => setTimeout(resolve, 5_000))
	}
	if (!sentinel) throw new Error(`Astro preview diagnostic did not return Payload content at ${diagnosticUrl}: ${diagnosticState}`)

	// Verify a route rendered the content returned by the bridge-backed
	// diagnostic before surfacing the preview URL.
	const sentinelPath = `/watch/${encodeURIComponent(sentinel.slug)}`
	const sentinelUrl = new URL(sentinelPath, previewUrl)
	sentinelUrl.searchParams.set('cmsCacheProbe', `${identity.sha.slice(0, 12)}-${Date.now()}`)
	const renderedDeadline = Date.now() + Math.min(waitSeconds, 120) * 1000
	let rendered = false
	let renderState = 'no response'
	while (Date.now() < renderedDeadline) {
		try {
			const response = await fetch(sentinelUrl, { headers: { accept: 'text/html' }, signal: AbortSignal.timeout(15_000) })
			const html = await response.text()
			const escapedTitle = sentinel.title.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character])
			if (response.ok && (html.includes(sentinel.title) || html.includes(escapedTitle))) {
				assertPublicSsrCachePolicy(response)
				const cacheProbe = await fetch(sentinelUrl, { headers: { accept: 'text/html' }, signal: AbortSignal.timeout(15_000) })
				const cacheProbeHtml = await cacheProbe.text()
				const cacheStatus = cacheProbe.headers.get('cf-cache-status')?.toUpperCase()
				if (
					cacheProbe.ok &&
					(cacheProbeHtml.includes(sentinel.title) || cacheProbeHtml.includes(escapedTitle)) &&
					cacheStatus === 'HIT'
				) {
					assertPublicSsrCachePolicy(cacheProbe)
					const cookieProbe = await fetch(sentinelUrl, {
						headers: { accept: 'text/html', cookie: 'rawkode-session=cache-bypass-probe' },
						signal: AbortSignal.timeout(15_000),
					})
					const cookieProbeHtml = await cookieProbe.text()
					const cookieCacheControl = cookieProbe.headers.get('cache-control')?.toLowerCase() ?? ''
					const cookieCacheState = cookieProbe.headers.get('x-website-cache-route')?.toUpperCase()
					const cookieEdgeCacheState = cookieProbe.headers.get('cf-cache-status')?.toUpperCase()
					if (
						!cookieProbe.ok ||
						(!cookieProbeHtml.includes(sentinel.title) && !cookieProbeHtml.includes(escapedTitle)) ||
						cookieCacheState !== 'BYPASS' ||
						cookieEdgeCacheState === 'HIT' ||
						!/(?:^|,)\s*private(?:,|$)/i.test(cookieCacheControl) ||
						!/(?:^|,)\s*no-store(?:,|$)/i.test(cookieCacheControl)
					) {
						throw new Error(`Cookie-bearing Astro requests must bypass the public response cache and return private, no-store responses (HTTP ${cookieProbe.status}, gateway ${cookieCacheState ?? 'missing'}, edge ${cookieEdgeCacheState ?? 'missing'}, Cache-Control ${cookieCacheControl || 'missing'}).`)
					}
					for (const [label, authHeaders] of [
						['Authorization', { authorization: 'Bearer preview-cache-bypass' }],
						['Cloudflare Access', { 'cf-access-jwt-assertion': 'preview-cache-bypass' }],
					]) {
						const privateProbe = await fetch(sentinelUrl, { headers: { accept: 'text/html', ...authHeaders }, signal: AbortSignal.timeout(15_000) })
						const privateHeaders = privateProbe.headers.get('cache-control')?.toLowerCase() ?? ''
						const privateRoute = privateProbe.headers.get('x-website-cache-route')?.toUpperCase()
						const privateEdge = privateProbe.headers.get('cf-cache-status')?.toUpperCase()
						await privateProbe.body?.cancel().catch(() => {})
						if (privateRoute !== 'BYPASS' || privateEdge === 'HIT' || !/(?:^|,)\s*private(?:,|$)/i.test(privateHeaders) || !/(?:^|,)\s*no-store(?:,|$)/i.test(privateHeaders)) {
							throw new Error(`${label}-bearing Astro requests must bypass Workers Cache and return private, no-store responses.`)
						}
					}
					rendered = true
					break
				}
				renderState = `SSR rendered, but the second request did not hit Cloudflare Workers Cache (HTTP ${cacheProbe.status}, CF-Cache-Status ${cacheStatus ?? 'missing'})`
			}
			else renderState = `HTTP ${response.status}, expected Payload video title was absent from SSR HTML`
		} catch (error) {
			renderState = error instanceof Error ? error.message : String(error)
		}
		console.log(`Waiting for Astro SSR to render Payload sentinel ${sentinel.slug}: ${renderState}`)
		await new Promise(resolve => setTimeout(resolve, 5_000))
	}
	if (!rendered) throw new Error(`Astro preview SSR/cache checks did not pass at ${sentinelUrl}: ${renderState}`)
	console.log(`SSR content and cache checks passed: ${sentinelPath} rendered Payload video “${sentinel.title}”; a repeat request hit Cloudflare Workers Cache, while cookie, Authorization, and Cloudflare Access requests bypassed it. Public TTL is at most 30 seconds.`)

	// This imported course demo proves its title and file contents come through
	// the Payload-only endpoint on the SSR route. COOP/COEP are required by the
	// browser WebContainer runtime and are added by the embed route middleware.
	const webContainerPath = '/embed/webcontainer?course=complete-guide-zitadel&module=01-introduction&resource=oauth-pkce-app'
	const webContainerUrl = new URL(webContainerPath, previewUrl)
	const webContainerDeadline = Date.now() + Math.min(waitSeconds, 120) * 1000
	let webContainerReady = false
	let webContainerState = 'no response'
	while (Date.now() < webContainerDeadline) {
		try {
			const response = await fetch(webContainerUrl, {
				headers: { accept: 'text/html' },
				signal: AbortSignal.timeout(15_000),
			})
			const html = await response.text()
			const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? ''
			const titleRendered = title.includes('OAuth PKCE Interactive Demo')
			const demoContentRendered = html.includes('public/index.html') && html.includes('OAuth PKCE Authentication')
			const coop = response.headers.get('cross-origin-opener-policy')?.toLowerCase()
			const coep = response.headers.get('cross-origin-embedder-policy')?.toLowerCase()
			if (response.ok && titleRendered && demoContentRendered && coop === 'same-origin' && coep === 'require-corp') {
				webContainerReady = true
				break
			}
			webContainerState = `HTTP ${response.status}, title ${titleRendered ? 'present' : 'missing'}, demo file content ${demoContentRendered ? 'present' : 'missing'}, COOP ${coop ?? 'missing'}, COEP ${coep ?? 'missing'}`
		} catch (error) {
			webContainerState = error instanceof Error ? error.message : String(error)
		}
		console.log(`Waiting for the Payload-backed WebContainer SSR route ${webContainerPath}: ${webContainerState}`)
		await new Promise(resolve => setTimeout(resolve, 5_000))
	}
	if (!webContainerReady) {
		throw new Error(`The Payload-backed WebContainer SSR check failed at ${webContainerUrl}: ${webContainerState}`)
	}
	console.log(`WebContainer SSR check passed: ${webContainerPath} rendered the imported demo title and file content with COOP same-origin and COEP require-corp.`)

	// Verify the scheduled fixture is hidden while its explicit publishedAt
	// remains comfortably in the future. This happens before slower media checks.
	const releaseAt = Date.parse(scheduledVideo.publishedAt)
	if (!Number.isFinite(releaseAt) || releaseAt <= Date.now() + 10_000) {
		throw new Error(`The scheduled video fixture did not leave enough time to observe its pre-release state: ${scheduledVideo.publishedAt}`)
	}
	const scheduledUrl = new URL(`/watch/${encodeURIComponent(scheduledVideo.slug)}`, previewUrl)
	scheduledUrl.searchParams.set('cmsPreviewProbe', String(Date.now()))
	const preRelease = await fetch(scheduledUrl, {
		headers: { accept: 'text/html', 'cache-control': 'no-store' },
		signal: AbortSignal.timeout(15_000),
	})
	if (preRelease.status !== 404) {
		await preRelease.body?.cancel().catch(() => {})
		throw new Error(`Scheduled video ${scheduledVideo.slug} should be hidden before ${scheduledVideo.publishedAt}; Astro returned HTTP ${preRelease.status}.`)
	}
	console.log(`Scheduled publication pre-check passed: ${scheduledVideo.slug} is hidden until ${scheduledVideo.publishedAt}.`)

	// Warm the public archive while the video is still scheduled. Its cached
	// response must expire at the next Payload release boundary, then re-render
	// the archive with the newly published video without a deployment.
	const archiveUrl = new URL('/watch', previewUrl)
	archiveUrl.searchParams.set('cmsReleaseProbe', `${identity.sha.slice(0, 12)}-${Date.now()}`)
	const archiveBefore = await fetch(archiveUrl, {
		headers: { accept: 'text/html' },
		signal: AbortSignal.timeout(15_000),
	})
	const archiveBeforeHtml = await archiveBefore.text()
	const scheduledHref = `/watch/${encodeURIComponent(scheduledVideo.slug)}`
	if (!archiveBefore.ok || archiveBeforeHtml.includes(scheduledHref)) {
		throw new Error(`The watch archive should hide the future-dated video ${scheduledVideo.slug} before ${scheduledVideo.publishedAt}; Astro returned HTTP ${archiveBefore.status}.`)
	}
	const archiveWarm = await fetch(archiveUrl, {
		headers: { accept: 'text/html' },
		signal: AbortSignal.timeout(15_000),
	})
	await archiveWarm.body?.cancel().catch(() => {})
	if (!archiveWarm.ok || archiveWarm.headers.get('cf-cache-status')?.toUpperCase() !== 'HIT') {
		throw new Error(`The pre-release watch archive response did not warm Cloudflare Workers Cache (HTTP ${archiveWarm.status}, CF-Cache-Status ${archiveWarm.headers.get('cf-cache-status') ?? 'missing'}).`)
	}
	console.log(`Scheduled publication cache probe passed: warmed /watch hides ${scheduledVideo.slug} until ${scheduledVideo.publishedAt}.`)

	if (d2SaveCapability === 'available') {
		// The preview diagnostic creates a draft article through Payload's normal
		// Local API. Its save hook must render and persist the D2 artifact in the
		// isolated per-PR R2 bucket, and the website must serve those exact bytes.
		const saveHookSourceHash = d2Save.sourceHash
		const saveHookDiagramUrl = new URL(`/cms-diagrams/${saveHookSourceHash}.svg`, previewUrl)
		const saveHookDiagramDeadline = Date.now() + Math.min(waitSeconds, 120) * 1000
		let saveHookDiagramReady = false
		let saveHookDiagramState = 'no response'
		while (Date.now() < saveHookDiagramDeadline) {
			try {
				const response = await fetch(saveHookDiagramUrl, {
					headers: { accept: 'image/svg+xml', 'cache-control': 'no-store' },
					signal: AbortSignal.timeout(15_000),
				})
				const contentType = response.headers.get('content-type')?.split(';')[0]?.trim()
				const returnedSourceHash = response.headers.get('x-source-checksum')
				const returnedSvgChecksum = response.headers.get('x-content-checksum')
				const etag = response.headers.get('etag')?.replace(/^W\//, '').replace(/^"|"$/g, '')
				const svg = response.ok && contentType === 'image/svg+xml' ? await response.text() : ''
				const svgChecksum = svg ? createHash('sha256').update(svg.trim()).digest('hex') : ''
				if (
					response.ok &&
					contentType === 'image/svg+xml' &&
					returnedSourceHash === saveHookSourceHash &&
					returnedSvgChecksum === d2Save.svgChecksum &&
					etag === d2Save.svgChecksum &&
					svgChecksum === d2Save.svgChecksum &&
					svg.trim().startsWith('<svg') && svg.trim().endsWith('</svg>')
				) {
					saveHookDiagramReady = true
					break
				}
				saveHookDiagramState = `HTTP ${response.status}, D2 save-hook artifact checksum or SVG body did not match`
			} catch (error) {
				saveHookDiagramState = error instanceof Error ? error.message : String(error)
			}
			console.log(`Waiting for D2 CMS save-hook artifact ${saveHookSourceHash}: ${saveHookDiagramState}`)
			await new Promise(resolve => setTimeout(resolve, 5_000))
		}
		if (!saveHookDiagramReady) {
			throw new Error(`Astro preview did not serve the checksum-verified D2 CMS save-hook artifact at ${saveHookDiagramUrl}: ${saveHookDiagramState}`)
		}
		console.log(`CMS D2 save-hook check passed: draft ${d2Save.articleSlug} produced ${saveHookSourceHash}.`)
	} else {
		console.log('CMS D2 editing: unverified/unavailable in this preview')
	}

	// The seeded article exercises the CMS runtime D2 source hash and the same
	// immutable media URL contract used by article covers and body images.
	const articlePath = '/read/federated-graphql-microservices'
	const articleUrl = new URL(articlePath, previewUrl)
	const articleDeadline = Date.now() + Math.min(waitSeconds, 120) * 1000
	let articleHtml
	let diagramUrl
	let assetUrl
	let articleState = 'no response'
	while (Date.now() < articleDeadline) {
		try {
			const response = await fetch(articleUrl, {
				headers: { accept: 'text/html', 'cache-control': 'no-store' },
				signal: AbortSignal.timeout(15_000),
			})
			const html = await response.text()
			const diagram = html.match(/(?:src|href)=["']([^"']*\/cms-diagrams\/([a-f0-9]{64})\.svg)["']/i)
			const asset = html.match(/(\/cms-assets\/[A-Za-z0-9_-]{8,128}\?[^"'<>\s]+)/i)
			if (response.ok && diagram && asset) {
				articleHtml = html
				diagramUrl = new URL(diagram[1].replaceAll('&amp;', '&'), previewUrl)
				assetUrl = new URL(asset[1].replaceAll('&amp;', '&'), previewUrl)
				break
			}
			articleState = `HTTP ${response.status}, article SSR was missing a D2 diagram or CMS image URL`
		} catch (error) {
			articleState = error instanceof Error ? error.message : String(error)
		}
		console.log(`Waiting for Astro D2 and CMS image SSR ${articlePath}: ${articleState}`)
		await new Promise(resolve => setTimeout(resolve, 5_000))
	}
	if (!articleHtml || !diagramUrl || !assetUrl) {
		throw new Error(`Astro preview did not render seeded D2 and CMS image URLs at ${articleUrl}: ${articleState}`)
	}
	if (diagramUrl.origin !== new URL(previewUrl).origin || assetUrl.origin !== new URL(previewUrl).origin) {
		throw new Error('Astro CMS media references must resolve to the isolated website preview origin.')
	}
	const sourceHash = diagramUrl.pathname.match(/\/cms-diagrams\/([a-f0-9]{64})\.svg$/i)?.[1]
	const assetChecksum = assetUrl.searchParams.get('v')
	const assetWidth = Number(assetUrl.searchParams.get('w'))
	if (
		!sourceHash ||
		!assetChecksum ||
		!/^[a-f0-9]{64}$/i.test(assetChecksum) ||
		![320, 640, 960, 1280, 1600, 2048].includes(assetWidth)
	) {
		throw new Error('The article SSR media references are missing valid D2 or image checksums.')
	}

	const diagramDeadline = Date.now() + Math.min(waitSeconds, 120) * 1000
	let diagramReady = false
	let diagramState = 'no response'
	while (Date.now() < diagramDeadline) {
		try {
			const response = await fetch(diagramUrl, {
				headers: { accept: 'image/svg+xml' },
				signal: AbortSignal.timeout(15_000),
			})
			const contentType = response.headers.get('content-type')?.split(';')[0]?.trim()
			const returnedSourceHash = response.headers.get('x-source-checksum')
			const returnedSvgChecksum = response.headers.get('x-content-checksum')
			const etag = response.headers.get('etag')?.replace(/^W\//, '').replace(/^"|"$/g, '')
			if (
				response.ok &&
				contentType === 'image/svg+xml' &&
				returnedSourceHash === sourceHash &&
				/^[a-f0-9]{64}$/i.test(returnedSvgChecksum ?? '') &&
				etag === returnedSvgChecksum
			) {
				await response.body?.cancel().catch(() => {})
				const cacheProbe = await fetch(diagramUrl, {
					headers: { accept: 'image/svg+xml' },
					signal: AbortSignal.timeout(15_000),
				})
				const cacheStatus = cacheProbe.headers.get('cf-cache-status')?.toUpperCase()
				const cacheProbeEtag = cacheProbe.headers.get('etag')?.replace(/^W\//, '').replace(/^"|"$/g, '')
				await cacheProbe.body?.cancel().catch(() => {})
				if (cacheProbe.ok && cacheProbeEtag === returnedSvgChecksum && cacheStatus === 'HIT') {
					diagramReady = true
					break
				}
				diagramState = `D2 SVG passed, but its second request did not hit Cloudflare Workers Cache (HTTP ${cacheProbe.status}, CF-Cache-Status ${cacheStatus ?? 'missing'})`
			}
			else diagramState = `HTTP ${response.status}, D2 SVG type/checksum headers were missing or mismatched`
		} catch (error) {
			diagramState = error instanceof Error ? error.message : String(error)
		}
		console.log(`Waiting for CMS D2 artifact ${sourceHash}: ${diagramState}`)
		await new Promise(resolve => setTimeout(resolve, 5_000))
	}
	if (!diagramReady) throw new Error(`Astro preview did not serve a checksum-verified D2 SVG at ${diagramUrl}: ${diagramState}`)

	const imageDeadline = Date.now() + Math.min(waitSeconds, 120) * 1000
	const expectedImageEtag = `${assetChecksum.toLowerCase()}-${assetWidth}-webp`
	let imageReady = false
	let imageState = 'no response'
	while (Date.now() < imageDeadline) {
		try {
			const response = await fetch(assetUrl, {
				headers: { accept: 'image/webp' },
				signal: AbortSignal.timeout(15_000),
			})
			const contentType = response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase()
			const etag = response.headers.get('etag')?.replace(/^W\//, '').replace(/^"|"$/g, '').toLowerCase()
			const signatureValid =
				response.ok &&
				contentType === 'image/webp' &&
				etag === expectedImageEtag
				? await hasWebpSignature(response)
				: false
			if (response.ok && contentType === 'image/webp' && etag === expectedImageEtag && signatureValid) {
				const cacheProbe = await fetch(assetUrl, {
					headers: { accept: 'image/webp' },
					signal: AbortSignal.timeout(15_000),
				})
				const cacheStatus = cacheProbe.headers.get('cf-cache-status')?.toUpperCase()
				const cacheProbeEtag = cacheProbe.headers.get('etag')?.replace(/^W\//, '').replace(/^"|"$/g, '').toLowerCase()
				await cacheProbe.body?.cancel().catch(() => {})
				if (cacheProbe.ok && cacheProbeEtag === expectedImageEtag && cacheStatus === 'HIT') {
					imageReady = true
					break
				}
				imageState = `WebP transform passed, but its second request did not hit Cloudflare Workers Cache (HTTP ${cacheProbe.status}, CF-Cache-Status ${cacheStatus ?? 'missing'})`
				await response.body?.cancel().catch(() => {})
			} else {
				await response.body?.cancel().catch(() => {})
				imageState = `HTTP ${response.status}, expected image/webp with ETag ending -${assetWidth}-webp and a RIFF/WEBP body signature; received ${contentType ?? 'no content type'} and ${etag ?? 'no ETag'}`
			}
		} catch (error) {
			imageState = error instanceof Error ? error.message : String(error)
		}
		console.log(`Waiting for Cloudflare Images transform ${assetUrl.pathname}: ${imageState}`)
		await new Promise(resolve => setTimeout(resolve, 5_000))
	}
	if (!imageReady) {
		throw new Error(`Astro preview did not serve a verified Cloudflare Images WebP transform at ${assetUrl}: ${imageState}`)
	}
	console.log(`CMS media checks passed: D2 SVG ${sourceHash} and Cloudflare Images WebP ${assetUrl.pathname} at ${assetWidth}px.`)

	// The first /watch entry was warmed earlier in this run. Re-render that same
	// URL in the final 20 seconds before release and prove every shared TTL is
	// clipped to the remaining time, then confirm that response is cached.
	const boundaryProbeAt = releaseAt - 15_000
	while (Date.now() < boundaryProbeAt) {
		await new Promise(resolve => setTimeout(resolve, Math.min(5_000, boundaryProbeAt - Date.now())))
	}
	const boundaryRequestStartedAt = Date.now()
	const secondsUntilRelease = Math.floor((releaseAt - boundaryRequestStartedAt) / 1000)
	if (secondsUntilRelease < 1 || secondsUntilRelease > 20) {
		throw new Error(`The scheduled archive cache probe did not run in its final 20 seconds before ${scheduledVideo.publishedAt}.`)
	}
	const boundaryWarm = await fetch(archiveUrl, {
		headers: { accept: 'text/html' },
		signal: AbortSignal.timeout(15_000),
	})
	const boundaryHtml = await boundaryWarm.text()
	const boundaryCacheState = boundaryWarm.headers.get('cf-cache-status')?.toUpperCase()
	const boundaryAges = responseCacheAges(boundaryWarm)
	if (
		!boundaryWarm.ok ||
		boundaryHtml.includes(scheduledHref) ||
		!['MISS', 'EXPIRED'].includes(boundaryCacheState ?? '') ||
		!boundaryAges.length ||
		boundaryAges.some(age => age > secondsUntilRelease)
	) {
		throw new Error(`The pre-release /watch response must be a cache MISS without ${scheduledVideo.slug}, with every shared TTL at or below ${secondsUntilRelease}s (HTTP ${boundaryWarm.status}, CF-Cache-Status ${boundaryCacheState ?? 'missing'}, TTLs ${boundaryAges.join(',') || 'missing'}).`)
	}
	const boundaryHit = await fetch(archiveUrl, {
		headers: { accept: 'text/html' },
		signal: AbortSignal.timeout(15_000),
	})
	const boundaryHitHtml = await boundaryHit.text()
	if (
		!boundaryHit.ok ||
		boundaryHitHtml.includes(scheduledHref) ||
		boundaryHit.headers.get('cf-cache-status')?.toUpperCase() !== 'HIT'
	) {
		throw new Error(`The clipped pre-release /watch response did not produce a cache HIT without ${scheduledVideo.slug} on the same URL (HTTP ${boundaryHit.status}, CF-Cache-Status ${boundaryHit.headers.get('cf-cache-status') ?? 'missing'}).`)
	}
	console.log(`Scheduled archive boundary warm passed: /watch was re-rendered ${secondsUntilRelease}s before release with clipped TTLs (${boundaryAges.join('/')}s), then served from cache.`)

	// Wait through the saved future boundary and verify live Astro SSR sees it.
	const scheduledDeadline = releaseAt + Math.min(waitSeconds, 90) * 1000
	let scheduledVisible = false
	let scheduledState = 'waiting for the scheduled release time'
	while (Date.now() < scheduledDeadline) {
		if (Date.now() < releaseAt) {
			await new Promise(resolve => setTimeout(resolve, Math.min(5_000, releaseAt - Date.now())))
			continue
		}
		try {
			const response = await fetch(scheduledUrl, {
				headers: { accept: 'text/html', 'cache-control': 'no-store' },
				signal: AbortSignal.timeout(15_000),
			})
			const html = await response.text()
			const escapedTitle = scheduledVideo.title.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character])
			if (response.ok && (html.includes(scheduledVideo.title) || html.includes(escapedTitle))) {
				scheduledVisible = true
				break
			}
			scheduledState = `HTTP ${response.status}, scheduled Payload video title was absent from Astro SSR HTML`
		} catch (error) {
			scheduledState = error instanceof Error ? error.message : String(error)
		}
		console.log(`Waiting for scheduled Payload publication ${scheduledVideo.slug}: ${scheduledState}`)
		await new Promise(resolve => setTimeout(resolve, 5_000))
	}
	if (!scheduledVisible) {
		throw new Error(`Astro preview did not reveal scheduled Payload video ${scheduledVideo.slug} after ${scheduledVideo.publishedAt}: ${scheduledState}`)
	}
	console.log(`Scheduled publication check passed: ${scheduledUrl.pathname} rendered after ${scheduledVideo.publishedAt}.`)
	const archiveAfterDeadline = releaseAt + Math.min(waitSeconds, 90) * 1000
	let scheduledArchiveVisible = false
	let scheduledArchiveState = 'waiting for the scheduled archive response'
	while (Date.now() < archiveAfterDeadline) {
		try {
			const response = await fetch(archiveUrl, {
				headers: { accept: 'text/html' },
				signal: AbortSignal.timeout(15_000),
			})
			const html = await response.text()
			const cacheState = response.headers.get('cf-cache-status')?.toUpperCase()
			if (response.ok && html.includes(scheduledHref) && ['MISS', 'EXPIRED'].includes(cacheState ?? '')) {
				scheduledArchiveVisible = true
				break
			}
			scheduledArchiveState = `HTTP ${response.status}, scheduled archive link ${html.includes(scheduledHref) ? 'was present' : 'is absent'}; CF-Cache-Status ${cacheState ?? 'missing'}`
		} catch (error) {
			scheduledArchiveState = error instanceof Error ? error.message : String(error)
		}
		console.log(`Waiting for the warmed watch archive to expire at ${scheduledVideo.publishedAt}: ${scheduledArchiveState}`)
		await new Promise(resolve => setTimeout(resolve, 5_000))
	}
	if (!scheduledArchiveVisible) {
		throw new Error(`The warmed /watch archive did not reveal scheduled video ${scheduledVideo.slug} after ${scheduledVideo.publishedAt}: ${scheduledArchiveState}`)
	}
	console.log(`Scheduled archive cache check passed: warmed /watch hid ${scheduledVideo.slug} before release and showed it after its Payload publishedAt boundary.`)
	console.log(`Version Preview URL: ${previewUrl}`)
	if (process.env.GITHUB_OUTPUT) {
		await appendFile(process.env.GITHUB_OUTPUT, `website_preview_url=${previewUrl}\nwebsite_preview_worker=${names.websiteWorkerName}\n`)
	}
	if (process.env.GITHUB_STEP_SUMMARY) {
		const d2EditingSummary = d2SaveCapability === 'available'
			? 'CMS D2 save hook verified'
			: 'CMS D2 editing: unverified/unavailable in this preview'
		await appendFile(process.env.GITHUB_STEP_SUMMARY, `## Website preview\n\n[Open the Astro SSR preview](${previewUrl})\n\nPaired Payload preview SHA: \`${identity.sha}\`. SSR verified ${sentinelPath}, a Workers Cache hit for SSR/D2/Cloudflare Images, cookie-bearing bypass, ${d2EditingSummary}, the warmed /watch archive hiding then revealing ${scheduledVideo.slug} at its Payload release boundary, and a public cache TTL of at most 30 seconds.\n`)
	}
} finally {
	await unlink(previewConfigPath).catch(() => {})
	await unlink(isolationConfigPath).catch(() => {})
}
