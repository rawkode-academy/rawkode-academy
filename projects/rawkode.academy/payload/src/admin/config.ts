import type { Config } from 'payload'

// Pure admin configuration: component paths, dashboard widgets and metadata.
// No runtime imports, so node:test and scripts/check-importmap.ts can load it.
type Admin = NonNullable<Config['admin']>

const component = (path: string) => `./src/admin/${path}`

export const adminComponents = {
	graphics: { Logo: component('graphics/Logo#Logo'), Icon: component('graphics/Icon#Icon') },
	beforeLogin: ['./src/components/AcademyLogin#AcademyLogin'],
	beforeNavLinks: [component('nav/ReviewNav#ReviewNav')],
	afterNavLinks: [component('nav/QuickLinks#QuickLinks')],
	// No settingsMenu: Payload draws its gear button whenever the slot is
	// configured, so a developer-only entry left non-developers an empty popup.
	// Developer tables already sit in the System nav group, hidden from staff.
	views: {
		reviewQueue: {
			Component: component('views/ReviewQueue#ReviewQueueView'),
			path: '/review' as const,
			meta: { title: 'Review queue', description: 'Client review status for videos in the review flow' },
		},
	},
} satisfies NonNullable<Admin['components']>

// Field-level components registered on collections (src/collections.ts).
export const fieldComponents = {
	reviewPanel: component('fields/ReviewPanel#ReviewPanel'),
	reviewFreezeNotice: component('fields/ReviewFreeze#ReviewFreezeNotice'),
	videoPublishControl: component('fields/ReviewFreeze#VideoPublishControl'),
	videoSaveDraftControl: component('fields/ReviewFreeze#VideoSaveDraftControl'),
	videoUnpublishControl: component('fields/ReviewFreeze#VideoUnpublishControl'),
}

// Widgets render above Payload's built-in `collections` widget. Saved
// per-user layouts in payload-preferences override defaultLayout.
export const dashboard = {
	widgets: [
		{ slug: 'review-queue', label: 'Review queue', Component: component('widgets/ReviewQueue#ReviewQueueWidget'), minWidth: 'medium', maxWidth: 'full' },
		{ slug: 'recent-edits', label: 'Recent edits', Component: component('widgets/RecentEdits#RecentEditsWidget'), minWidth: 'small', maxWidth: 'large' },
		{ slug: 'import-health', label: 'Import health', Component: component('widgets/ImportHealth#ImportHealthWidget'), minWidth: 'small', maxWidth: 'medium' },
		{ slug: 'quick-links', label: 'Elsewhere', Component: component('widgets/QuickLinks#QuickLinksWidget'), minWidth: 'small', maxWidth: 'full' },
	],
	defaultLayout: [
		{ widgetSlug: 'review-queue', width: 'full' },
		{ widgetSlug: 'recent-edits', width: 'medium' },
		{ widgetSlug: 'import-health', width: 'medium' },
		{ widgetSlug: 'quick-links', width: 'full' },
		{ widgetSlug: 'collections', width: 'full' },
	],
} satisfies NonNullable<Admin['dashboard']>

export const adminMeta = {
	titleSuffix: ' · Rawkode Academy CMS',
	description: 'Rawkode Academy content management',
	icons: [
		{ rel: 'icon', type: 'image/png', sizes: '32x32', url: 'https://rawkode.academy/favicon-32x32.png' },
		{ rel: 'icon', type: 'image/png', sizes: '16x16', url: 'https://rawkode.academy/favicon-16x16.png' },
		{ rel: 'apple-touch-icon', url: 'https://rawkode.academy/apple-touch-icon.png' },
	],
	openGraph: { siteName: 'Rawkode Academy CMS', title: 'Rawkode Academy CMS', description: 'Rawkode Academy content management' },
	robots: 'noindex, nofollow',
	defaultOGImageType: 'off',
} satisfies NonNullable<Admin['meta']>

export const adminConfig = {
	components: adminComponents,
	dashboard,
	meta: adminMeta,
	theme: 'all',
	dateFormat: 'd MMM yyyy, HH:mm',
	avatar: 'default',
} satisfies Partial<Admin>

// Every component path the admin can render. scripts/check-importmap.ts and
// tests/admin-importmap.test.ts compare this (plus field components found by
// walking the collections) against the committed importMap.js.
export function adminComponentPaths(): string[] {
	return [
		adminComponents.graphics.Logo,
		adminComponents.graphics.Icon,
		...adminComponents.beforeLogin,
		...adminComponents.beforeNavLinks,
		...adminComponents.afterNavLinks,
		...Object.values(adminComponents.views).map(view => view.Component),
		...dashboard.widgets.map(widget => widget.Component),
	]
}
