// Destinations outside the CMS, shared by the nav, dashboard and Review queue.
export const adminRoute = '/admin'
export const reviewQueuePath = `${adminRoute}/review`
export const previewReviewUrl = 'https://preview.rawkode.academy/review'

export type ExternalLink = { label: string; href: string; description: string }
export const elsewhere: ExternalLink[] = [
	{ label: 'Preview review', href: previewReviewUrl, description: 'Client review UI' },
	{ label: 'Studio', href: 'https://rawkode.studio', description: 'Recording and streaming' },
	{ label: 'Website', href: 'https://rawkode.academy', description: 'The public site' },
	{ label: 'GraphQL', href: '/api/graphql', description: 'Payload GraphQL endpoint' },
]

export const collectionPath = (slug: string) => `${adminRoute}/collections/${slug}`
export const documentPath = (slug: string, id: string | number) => `${collectionPath(slug)}/${encodeURIComponent(String(id))}`
