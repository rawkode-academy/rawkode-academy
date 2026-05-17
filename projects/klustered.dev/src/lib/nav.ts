export const ADMIN_NAV = [
	{ href: "/admin", label: "Overview" },
	{ href: "/admin/seasons", label: "Seasons" },
	{ href: "/admin/competitors", label: "Competitors" },
	{ href: "/admin/teams", label: "Teams" },
	{ href: "/admin/scenarios", label: "Scenarios" },
	{ href: "/admin/brackets", label: "Brackets" },
	{ href: "/admin/matches", label: "Matches" },
	{ href: "/admin/registrations", label: "Registrations" },
] as const;

export const COMPETITOR_NAV = [
	{ href: "/me", label: "Overview" },
	{ href: "/me/matches", label: "My matches" },
	{ href: "/me/profile", label: "Profile" },
] as const;
