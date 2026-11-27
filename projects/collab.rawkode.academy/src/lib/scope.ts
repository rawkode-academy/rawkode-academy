import type { Session } from "./types.ts";

export interface Scope {
	/** Staff see every collaborator; a partner sees only their organisations'. */
	all: boolean;
	orgIds: ReadonlySet<string>;
	/** True while an admin is viewing as a partner: nothing can be changed. */
	readOnly: boolean;
	/** Staff, acting as themselves, triage comments and open reviews. */
	canTriage: boolean;
}

export const scopeFor = (session: Session): Scope => {
	const { principal, viewAs } = session;
	if (principal.admin && viewAs) {
		return { all: false, orgIds: new Set([viewAs.orgId]), readOnly: true, canTriage: false };
	}
	if (principal.admin) return { all: true, orgIds: new Set(), readOnly: false, canTriage: true };
	return { all: false, orgIds: new Set(principal.orgs.map((org) => org.orgId)), readOnly: false, canTriage: false };
};

export const sees = (scope: Scope, organizationId: string | null) =>
	scope.all || (organizationId !== null && scope.orgIds.has(organizationId));
