// What each role may do. Admins write directly; everyone else's edits become
// proposals that an admin approves. Partners only ever touch the factual
// fields of their own technology: placement on the matrix, status and
// category are editorial and stay admin-only (independence is priced in).
import type { Principal } from "./auth";

export type Access = "write" | "propose" | "deny";

export interface Scope {
	/** The user's linked records, from access_links. */
	people: string[];
	technologies: string[];
}

/** Collections agents may write directly; their other writes are proposals. */
export const AGENT_DIRECT = new Set([
	"technologies",
	"videos",
	"people",
	"shows",
]);

/** Fields an agent's direct write may not touch: they become proposals. */
export const EDITORIAL_FIELDS: Record<string, ReadonlySet<string>> = {
	technologies: new Set(["matrix"]),
};

/** Technology fields a partner may propose changes to. */
export const PARTNER_FIELDS = new Set([
	"name",
	"body",
	"description",
	"website",
	"documentation",
	"source",
	"license",
	"logos",
	"community",
	"learningResources",
	"aliases",
	"features",
	"useCases",
]);

export const isAdmin = (p: Principal | null) =>
	!!p?.roles.includes("content_admin");

/** Whether the principal may read the CMS at all (every content role may). */
export const canRead = (p: Principal | null) => !!p && p.roles.length > 0;

/**
 * Access to change an entity (or create one when id is undefined) in a
 * collection. `fields` are the patched fields, checked for partners.
 */
export function accessFor(
	p: Principal | null,
	collection: string,
	id: string | undefined,
	scope: Scope,
	fields: string[] = [],
): Access {
	if (!p) return "deny";
	if (p.roles.includes("content_admin")) return "write";
	if (p.roles.includes("content_agent")) {
		if (!AGENT_DIRECT.has(collection)) return "propose";
		// Editorial judgement (the matrix) is reviewed even when an agent's
		// factual edits are not: an agent reads untrusted pages.
		const editorial = EDITORIAL_FIELDS[collection];
		return editorial && fields.some((f) => editorial.has(f))
			? "propose"
			: "write";
	}
	if (id && p.roles.includes("content_guest")) {
		if (collection === "people" && scope.people.includes(id)) return "propose";
	}
	if (id && p.roles.includes("content_partner")) {
		if (
			collection === "technologies" &&
			scope.technologies.includes(id) &&
			fields.every((f) => PARTNER_FIELDS.has(f))
		) {
			return "propose";
		}
	}
	return "deny";
}

/** Delete, restore, approvals, tokens and access links are admin-only. */
export const canAdminister = isAdmin;
