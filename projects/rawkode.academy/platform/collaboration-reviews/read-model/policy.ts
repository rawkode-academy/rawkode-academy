import type { Review, ReviewComment } from "../data-model/schema";

/** What the gateway verified about the caller. */
export interface Caller {
	userId: string | null;
	username: string | null;
	roles: string[];
	orgs: { id: string; role: string }[];
}

export const ADMIN_ROLE = "collab_admin";
const SIGN_OFF_ROLES = new Set(["owner", "admin"]);
export const MAX_COMMENT_LENGTH = 2000;

export const isAdmin = (caller: Caller) => caller.roles.includes(ADMIN_ROLE);

const membership = (caller: Caller, review: Review) =>
	caller.orgs.find((org) => org.id === review.organizationId);

export const canView = (caller: Caller, review: Review) =>
	caller.userId !== null && (isAdmin(caller) || membership(caller, review) !== undefined);

export const canComment = (caller: Caller, review: Review) =>
	canView(caller, review) && review.state !== "published" && review.state !== "scheduled";

/** Partner owners and admins record that they are happy; staff publish. */
export const canSignOff = (caller: Caller, review: Review) =>
	review.state === "in_review" &&
	!isAdmin(caller) &&
	SIGN_OFF_ROLES.has(membership(caller, review)?.role ?? "");

export const authorSide = (caller: Caller): ReviewComment["authorSide"] =>
	isAdmin(caller) ? "staff" : "partner";

export type Triage = ReviewComment["triage"];
export const TRIAGE_STATES: readonly Triage[] = ["new", "actionable", "not_actionable", "fixed", "withdrawn"];

/** A partner may withdraw their own untriaged comment; only staff triage. */
export const canTriageTo = (caller: Caller, comment: ReviewComment, to: Triage) => {
	if (isAdmin(caller)) return to !== "withdrawn";
	return to === "withdrawn" && comment.authorId === caller.userId && comment.triage === "new";
};

export const cleanComment = (
	body: string,
	timestampMs: number | null | undefined,
): { body: string; timestampMs: number | null } => {
	const text = body.trim();
	if (text === "") throw new Error("Write a comment first");
	if (text.length > MAX_COMMENT_LENGTH) throw new Error("That comment is too long");
	if (timestampMs === null || timestampMs === undefined) return { body: text, timestampMs: null };
	if (!Number.isFinite(timestampMs) || timestampMs < 0) throw new Error("Invalid timestamp");
	return { body: text, timestampMs: Math.round(timestampMs) };
};
