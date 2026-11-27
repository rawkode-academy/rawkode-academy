import type {
	Comment,
	Org,
	Persona,
	Principal,
	Review,
	Session,
	Triage,
} from "./types.ts";

/** What the signed-in person may see and do, decided in one place. */
export interface Scope {
	/** Organisations whose data is visible. */
	orgIds: ReadonlySet<string>;
	persona: Persona | "staff";
	/** Writes are disabled while an admin is viewing as someone else. */
	readOnly: boolean;
	banner?: { orgName: string; persona: Persona };
	canTriage: boolean;
}

const REVIEW_ROLES = new Set(["owner", "admin"]);

export const scopeFor = (session: Session, orgs: readonly Org[]): Scope => {
	const { principal, viewAs } = session;
	if (principal.admin && viewAs) {
		const org = orgs.find((item) => item.id === viewAs.orgId);
		return {
			orgIds: new Set(org ? [org.id] : []),
			persona: viewAs.persona,
			readOnly: true,
			banner: org ? { orgName: org.name, persona: viewAs.persona } : undefined,
			canTriage: false,
		};
	}
	if (principal.admin) {
		return {
			orgIds: new Set(orgs.map((org) => org.id)),
			persona: "staff",
			readOnly: false,
			canTriage: true,
		};
	}
	const own = new Set(principal.orgs.map((membership) => membership.orgId));
	const mine = orgs.filter((org) => own.has(org.id));
	return {
		orgIds: new Set(mine.map((org) => org.id)),
		persona: mine.some((org) => org.kind !== "supporter") ? "partner" : "supporter",
		readOnly: false,
		canTriage: false,
	};
};

/** Draft review belongs to collaborations: only partner organisations have it. */
export const reviewsVisible = (scope: Scope, orgs: readonly Org[], reviews: readonly Review[]) => {
	const reviewable = new Set(
		orgs.filter((org) => org.kind !== "supporter").map((org) => org.id),
	);
	return reviews.filter((review) => scope.orgIds.has(review.orgId) && reviewable.has(review.orgId));
};

export const canSeeReview = (scope: Scope, orgs: readonly Org[], review: Review) =>
	reviewsVisible(scope, orgs, [review]).length === 1;

export const canComment = (scope: Scope, review: Review) =>
	!scope.readOnly && review.state !== "published" && review.state !== "scheduled";

/** Partner owners and admins record that they are happy. David still publishes. */
export const canSignOff = (scope: Scope, principal: Principal, review: Review) =>
	!scope.readOnly &&
	scope.persona === "partner" &&
	review.state === "in_review" &&
	principal.orgs.some(
		(membership) => membership.orgId === review.orgId && REVIEW_ROLES.has(membership.role),
	);

export const authorSide = (scope: Scope): Comment["authorSide"] =>
	scope.persona === "staff" ? "staff" : "partner";

export const TRIAGE_STATES: readonly Triage[] = [
	"new",
	"actionable",
	"not_actionable",
	"fixed",
	"withdrawn",
];

export const isTriage = (value: unknown): value is Triage =>
	typeof value === "string" && (TRIAGE_STATES as readonly string[]).includes(value);

/** A partner may withdraw their own comment; only staff triage the rest. */
export const canTriageTo = (scope: Scope, principal: Principal, comment: Comment, to: Triage) => {
	if (scope.readOnly) return false;
	if (scope.canTriage) return to !== "withdrawn";
	return to === "withdrawn" && comment.authorLogin === principal.login && comment.triage === "new";
};

export const MAX_COMMENT_LENGTH = 2000;

/** Validates a new comment's input; returns the cleaned fields or an error. */
export const parseNewComment = (
	input: unknown,
	durationMs?: number,
): { ok: true; timestampMs: number | null; body: string } | { ok: false; error: string } => {
	if (typeof input !== "object" || input === null) return { ok: false, error: "Invalid body" };
	const { body, timestampMs } = input as { body?: unknown; timestampMs?: unknown };
	if (typeof body !== "string" || body.trim() === "") return { ok: false, error: "Write a comment first" };
	if (body.length > MAX_COMMENT_LENGTH) return { ok: false, error: "That comment is too long" };
	if (timestampMs === null || timestampMs === undefined) {
		return { ok: true, timestampMs: null, body: body.trim() };
	}
	if (typeof timestampMs !== "number" || !Number.isFinite(timestampMs) || timestampMs < 0) {
		return { ok: false, error: "Invalid timestamp" };
	}
	if (durationMs !== undefined && timestampMs > durationMs + 1000) {
		return { ok: false, error: "That moment is past the end of the video" };
	}
	return { ok: true, timestampMs: Math.round(timestampMs), body: body.trim() };
};

export const formatTimestamp = (ms: number): string => {
	const total = Math.floor(ms / 1000);
	const h = Math.floor(total / 3600);
	const m = Math.floor((total % 3600) / 60);
	const s = total % 60;
	const pad = (n: number) => String(n).padStart(2, "0");
	return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
};
