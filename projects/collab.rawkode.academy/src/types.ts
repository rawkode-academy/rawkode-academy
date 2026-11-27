export interface Env {
	STORE: KVNamespace;
	/** platform-video-collaborations, read-only here. Absent in the preview. */
	COLLABORATIONS_DB?: D1Database;
	/** platform-videos, read-only here. Absent in the preview. */
	VIDEOS_DB?: D1Database;
	/** platform-supporters, read-only here. Absent in the preview. */
	SUPPORTERS_DB?: D1Database;
	/** "true" only in the pull-request preview Worker. */
	PREVIEW?: string;
	/** Public origin registered with the OIDC client. Empty in the preview. */
	PUBLIC_ORIGIN: string;
	OIDC_ISSUER: string;
	OIDC_CLIENT_ID: string;
	/** Bearer secret the encode workflow presents to open or refresh a review. Unset disables ingest. */
	INGEST_TOKEN?: string;
}

/** What an organisation bought. Partners get draft review; supporters do not. */
export type OrgKind = "partner" | "supporter" | "both";
export type Persona = "partner" | "supporter";
export type OrgRole = "owner" | "admin" | "moderator" | "contributor" | "member";

export interface Org {
	id: string;
	name: string;
	kind: OrgKind;
}

/**
 * Ties an identity organisation to the company records it represents. An
 * organisation with a collaborator is a partner; one with a supporter is a
 * supporter; with both, it is both.
 */
export interface OrgLink {
	/** The identity organisation id. */
	orgId: string;
	collaboratorId?: string;
	supporterId?: string;
}

/** Who is signed in, as identity says. Never an email address. */
export interface Principal {
	userId: string;
	login: string;
	name: string;
	/** Holds the collab_admin role in identity. */
	admin: boolean;
	orgs: { orgId: string; role: OrgRole }[];
}

export type ReviewState =
	| "in_review"
	| "changes_requested"
	| "approved"
	| "scheduled"
	| "published";

export interface Review {
	id: string;
	orgId: string;
	/** The Academy video this review is for, when it has one. */
	videoId?: string;
	title: string;
	/** A playable source for the draft. Signed, short-lived CDN URLs come later. */
	videoUrl: string;
	state: ReviewState;
	draftVersion: number;
	dueAt: string;
	partnerApprovedBy?: string;
	partnerApprovedAt?: string;
	scheduledFor?: string;
}

export type Triage = "new" | "actionable" | "not_actionable" | "fixed" | "withdrawn";

export interface Comment {
	id: string;
	reviewId: string;
	draftVersion: number;
	authorLogin: string;
	authorName: string;
	/** Which side wrote it: the partner organisation, or Rawkode staff. */
	authorSide: "partner" | "staff";
	/** Null for a general note. */
	timestampMs: number | null;
	body: string;
	triage: Triage;
	triageNote?: string;
	createdAt: string;
}

export interface Session {
	principal: Principal;
	/** Set only by an admin: see exactly what this organisation sees, read-only. */
	viewAs?: { orgId: string; persona: Persona };
	expiresAt: number;
}
