import type { Comment, Org, Principal, Review } from "./types.ts";

/**
 * Fictional data for the pull-request preview only. The organisations, people
 * and comments are invented; the sample clip is MDN's CC0 flower video.
 */
export const SAMPLE_VIDEO =
	"https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4";

export const seedOrgs: Org[] = [
	{ id: "acme-cloud", name: "Acme Cloud (sample partner)", kind: "partner" },
	{ id: "globex-db", name: "Globex DB (sample supporter)", kind: "supporter" },
];

const inDays = (days: number) => new Date(Date.UTC(2026, 10, 27 + days)).toISOString();

export const seedReviews: Review[] = [
	{
		id: "hands-on-acme-cloud",
		orgId: "acme-cloud",
		title: "Hands-on introduction to Acme Cloud (draft cut 1)",
		videoUrl: SAMPLE_VIDEO,
		state: "in_review",
		draftVersion: 1,
		dueAt: inDays(5),
	},
];

export const seedComments: Comment[] = [
	{
		id: "seed-1",
		reviewId: "hands-on-acme-cloud",
		draftVersion: 1,
		authorLogin: "sample-acme-pm",
		authorName: "Sample Acme PM",
		authorSide: "partner",
		timestampMs: 2000,
		body: "The logo is clipped here on a narrow screen.",
		triage: "actionable",
		createdAt: inDays(0),
	},
	{
		id: "seed-2",
		reviewId: "hands-on-acme-cloud",
		draftVersion: 1,
		authorLogin: "sample-acme-pm",
		authorName: "Sample Acme PM",
		authorSide: "partner",
		timestampMs: 5000,
		body: "Could this cut be a little tighter?",
		triage: "new",
		createdAt: inDays(0),
	},
];

/** The personas the preview sign-in offers. Real sign-in is GitHub through identity. */
export const previewPersonas: { key: string; label: string; principal: Principal }[] = [
	{
		key: "david",
		label: "David (portal admin)",
		principal: { userId: "preview-david", login: "sample-admin", name: "David (sample)", admin: true, orgs: [] },
	},
	{
		key: "partner-owner",
		label: "Sample partner owner (Acme Cloud)",
		principal: {
			userId: "preview-acme-owner",
			login: "sample-acme-pm",
			name: "Sample Acme PM",
			admin: false,
			orgs: [{ orgId: "acme-cloud", role: "owner" }],
		},
	},
	{
		key: "partner-member",
		label: "Sample partner reviewer (Acme Cloud, member)",
		principal: {
			userId: "preview-acme-member",
			login: "sample-acme-dev",
			name: "Sample Acme Developer",
			admin: false,
			orgs: [{ orgId: "acme-cloud", role: "member" }],
		},
	},
	{
		key: "supporter",
		label: "Sample supporter (Globex DB)",
		principal: {
			userId: "preview-globex-owner",
			login: "sample-globex",
			name: "Sample Globex Owner",
			admin: false,
			orgs: [{ orgId: "globex-db", role: "owner" }],
		},
	},
];
