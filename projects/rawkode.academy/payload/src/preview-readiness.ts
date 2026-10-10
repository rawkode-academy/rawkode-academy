import type { Payload } from 'payload'
import { diagramObjectKey, d2SourceHash } from './diagrams'

type PreviewPayload = Pick<Payload, 'find' | 'create' | 'update'>

type PreviewIdentity = { pullRequest: number; sha: string }

function validIdentity(identity: PreviewIdentity): boolean {
	return Number.isSafeInteger(identity.pullRequest) && identity.pullRequest > 0 && /^[0-9a-f]{40}$/.test(identity.sha)
}

/**
 * Seed a deterministic scheduled video in the isolated PR database. When a
 * D2 renderer is bound, also exercise the normal editorial save hook and
 * prove it leaves a checksum-verified artifact in that PR's R2 bucket.
 */
export async function cmsPreviewReadiness(
	request: Request,
	payload: PreviewPayload,
	bucket: R2Bucket,
	identity: PreviewIdentity,
	d2RendererAvailable: boolean,
): Promise<Response> {
	const url = new URL(request.url)
	if (
		request.method !== 'POST' ||
		url.pathname !== '/v1/preview/readiness' ||
		url.searchParams.size > 0 ||
		!validIdentity(identity) ||
		request.headers.get('x-preview-pr') !== String(identity.pullRequest) ||
		request.headers.get('x-preview-sha') !== identity.sha
	) {
		return Response.json({ error: 'Not found' }, { status: 404, headers: { 'Cache-Control': 'no-store' } })
	}

	const suffix = `pr-${identity.pullRequest}-${identity.sha.slice(0, 12)}`
	const videoSlug = `preview-scheduled-${suffix}`
	const existingVideo = await payload.find({
		collection: 'videos',
		where: { slug: { equals: videoSlug } },
		depth: 0,
		limit: 1,
		page: 1,
		draft: true,
		overrideAccess: true,
		user: null,
	} as never)
	const video = existingVideo.docs[0] as Record<string, unknown> | undefined
	// Leave a five-minute window for the serial SSR, D2, and Images checks before
	// the post-boundary request proves scheduled visibility.
	const priorPublishedAt = video?.publishedAt
	const priorRelease = typeof priorPublishedAt === 'string' ? Date.parse(priorPublishedAt) : Number.NaN
	const publishedAt = new Date(priorRelease > Date.now() + 10_000 ? priorRelease : Date.now() + 5 * 60_000).toISOString()
	const videoData = {
		slug: videoSlug,
		title: `Scheduled CMS preview ${identity.sha.slice(0, 12)}`,
		description: 'Isolated future-dated video fixture for scheduled publication readiness.',
		type: 'recorded',
		publishedAt,
		tombstone: false,
		_status: 'published',
	}
	const savedVideo = video
		? await payload.update({
				collection: 'videos',
				id: video.id,
				depth: 0,
				draft: false,
				overrideAccess: true,
				data: videoData,
			} as never)
		: await payload.create({
				collection: 'videos',
				depth: 0,
				draft: false,
				overrideAccess: true,
				data: videoData,
			} as never)

	let d2Save: Record<string, string> | undefined
	if (d2RendererAvailable) {
		const d2Slug = `preview-d2-save-${suffix}`
		const source = `preview_${identity.pullRequest}_${identity.sha.slice(0, 12)} -> saved`
		const body = `\`\`\`d2\n${source}\n\`\`\``
		const sourceHash = await d2SourceHash(source)
		const existingArticle = await payload.find({
			collection: 'articles',
			where: { slug: { equals: d2Slug } },
			depth: 0,
			limit: 1,
			page: 1,
			draft: true,
			overrideAccess: true,
			user: null,
		} as never)
		const article = existingArticle.docs[0] as Record<string, unknown> | undefined
		const articleData = {
			slug: d2Slug,
			title: `CMS D2 save hook preview ${identity.sha.slice(0, 12)}`,
			description: 'Isolated CMS preview fixture for save-time D2 rendering.',
			body,
			_status: 'draft',
		}
		const savedArticle = article
			? await payload.update({
					collection: 'articles',
					id: article.id,
					depth: 0,
					draft: true,
					overrideAccess: true,
					data: articleData,
				} as never)
			: await payload.create({
					collection: 'articles',
					depth: 0,
					draft: true,
					overrideAccess: true,
					data: articleData,
				} as never)

		const d2Object = await bucket.head(diagramObjectKey(sourceHash))
		const d2Checksum = d2Object?.customMetadata?.svgChecksum
		if (
			!d2Object ||
			d2Object.customMetadata?.sourceChecksum !== sourceHash ||
			typeof d2Checksum !== 'string' ||
			!/^[a-f0-9]{64}$/.test(d2Checksum)
		) {
			throw new Error('The CMS D2 save hook did not persist a checksum-verified artifact to preview R2.')
		}
		d2Save = {
			articleSlug: d2Slug,
			articleId: String(savedArticle.id),
			articleStatus: String((savedArticle as Record<string, unknown>)._status ?? 'draft'),
			sourceHash,
			svgChecksum: d2Checksum,
		}
	}

	return Response.json(
		{
			d2SaveCapability: d2RendererAvailable ? 'available' : 'unavailable',
			...(d2Save ? { d2Save } : {}),
			scheduledVideo: {
				id: String(savedVideo.id),
				slug: videoSlug,
				title: videoData.title,
				publishedAt,
			},
		},
		{ headers: { 'Cache-Control': 'no-store' } },
	)
}
