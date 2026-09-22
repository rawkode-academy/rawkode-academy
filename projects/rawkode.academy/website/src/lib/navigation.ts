/** One route inventory for the production header, drawer, and footer. */
export const primaryNavigation = [
	{ label: "Watch", href: "/watch" },
	{ label: "Read", href: "/read" },
	{ label: "Learn", href: "/learning-paths" },
	{ label: "Matrix", href: "/technology/matrix" },
];

export const navigationGroups = [
	{ label: "Learn", items: [
		{ label: "Videos", href: "/watch" },
		{ label: "Articles", href: "/read" },
		{ label: "Courses", href: "/courses" },
		{ label: "Learning paths", href: "/learning-paths" },
	] },
	{ label: "Explore", items: [
		{ label: "Search", href: "/search" },
		{ label: "Technology Matrix", href: "/technology/matrix" },
		{ label: "Technologies", href: "/technology" },
		{ label: "Shows", href: "/shows" },
		{ label: "News", href: "/news" },
	] },
	{ label: "Community", items: [
		{ label: "People", href: "/people" },
		{ label: "Partnerships", href: "/organizations/partnerships" },
		{ label: "Share your project", href: "/maintainers/share-your-project" },
		{ label: "CNIcon", href: "/games/cnicon" },
		{ label: "Join the Academy", href: "/#join" },
	] },
	{ label: "Academy", items: [
		{ label: "About", href: "/about" },
		{ label: "Branding", href: "/organizations/branding" },
		{ label: "Changelog", href: "/changelog" },
		{ label: "ADRs", href: "/adrs" },
		{ label: "Feeds", href: "/feeds" },
		{ label: "Privacy", href: "/privacy" },
		{ label: "Your account", href: "/settings" },
	] },
];

export const isCurrentRoute = (path: string, href: string) =>
	href === "/" ? path === href : path === href || path.startsWith(`${href}/`);
