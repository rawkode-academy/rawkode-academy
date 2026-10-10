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
}

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
				rendered = true
				break
			}
			renderState = `HTTP ${response.status}, expected Payload video title was absent from SSR HTML`
		} catch (error) {
			renderState = error instanceof Error ? error.message : String(error)
		}
		console.log(`Waiting for Astro SSR to render Payload sentinel ${sentinel.slug}: ${renderState}`)
		await new Promise(resolve => setTimeout(resolve, 5_000))
	}
	if (!rendered) throw new Error(`Astro preview SSR/cache checks did not pass at ${sentinelUrl}: ${renderState}`)
	console.log(`SSR content check passed: ${sentinelPath} rendered Payload video “${sentinel.title}”; public cache TTL is at most 30 seconds with no stale directives.`)

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
				headers: { accept: 'image/svg+xml', 'cache-control': 'no-store' },
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
				diagramReady = true
				break
			}
			diagramState = `HTTP ${response.status}, D2 SVG type/checksum headers were missing or mismatched`
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
				headers: { accept: 'image/webp', 'cache-control': 'no-store' },
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
				imageReady = true
				break
			}
			await response.body?.cancel().catch(() => {})
			imageState = `HTTP ${response.status}, expected image/webp with ETag ending -${assetWidth}-webp and a RIFF/WEBP body signature; received ${contentType ?? 'no content type'} and ${etag ?? 'no ETag'}`
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
	console.log(`Version Preview URL: ${previewUrl}`)
	if (process.env.GITHUB_OUTPUT) {
		await appendFile(process.env.GITHUB_OUTPUT, `website_preview_url=${previewUrl}\nwebsite_preview_worker=${names.websiteWorkerName}\n`)
	}
	if (process.env.GITHUB_STEP_SUMMARY) {
		const d2EditingSummary = d2SaveCapability === 'available'
			? 'CMS D2 save hook verified'
			: 'CMS D2 editing: unverified/unavailable in this preview'
		await appendFile(process.env.GITHUB_STEP_SUMMARY, `## Website preview\n\n[Open the Astro SSR preview](${previewUrl})\n\nPaired Payload preview SHA: \`${identity.sha}\`. SSR verified ${sentinelPath}, ${d2EditingSummary}, Cloudflare Images delivery, scheduled visibility for ${scheduledVideo.slug}, and a public cache TTL of at most 30 seconds without stale directives.\n`)
	}
} finally {
	await unlink(previewConfigPath).catch(() => {})
	await unlink(isolationConfigPath).catch(() => {})
}
