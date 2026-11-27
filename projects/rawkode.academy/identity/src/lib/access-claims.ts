import { and, asc, eq, gt, isNull, or } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "../db/schema";

const ROLE_NAMESPACE = "https://rawkode.academy/roles";
const CLIENT_NAMESPACE = "https://rawkode.academy/client_id";

export async function getUserAccessClaims(
	db: DrizzleD1Database<typeof schema>,
	userId: string,
	clientId: string,
): Promise<Record<string, unknown>> {
	const now = new Date();
	const rows = await db
		.select({ role: schema.accessAssignment.role })
		.from(schema.accessAssignment)
		.where(
			and(
				eq(schema.accessAssignment.userId, userId),
				eq(schema.accessAssignment.clientId, clientId),
				or(
					isNull(schema.accessAssignment.expiresAt),
					gt(schema.accessAssignment.expiresAt, now),
				),
			),
		)
		.orderBy(asc(schema.accessAssignment.role));

	const roles = [...new Set(rows.map((row) => row.role))];
	if (roles.length === 0) {
		return {};
	}

	// Each claim needs its own array. Better Auth serialises the userinfo
	// response with a cycle-safe encoder that replaces a repeated reference to
	// the same object with the string "[Circular ref-1]", so sharing one array
	// turned `groups` and the namespaced roles claim into strings.
	return {
		roles,
		groups: [...roles],
		[ROLE_NAMESPACE]: [...roles],
		[CLIENT_NAMESPACE]: clientId,
	};
}

const ORGS_NAMESPACE = "https://rawkode.academy/orgs";

/**
 * The organisations a user belongs to and their role in each, for clients that
 * scope by organisation (the partner portal). Ids and roles only: no names or
 * emails leave identity.
 */
export async function getUserOrganisationClaims(
	db: DrizzleD1Database<typeof schema>,
	userId: string,
): Promise<Record<string, unknown>> {
	const rows = await db
		.select({
			id: schema.member.organizationId,
			role: schema.member.role,
		})
		.from(schema.member)
		.where(eq(schema.member.userId, userId))
		.orderBy(asc(schema.member.organizationId));
	return { [ORGS_NAMESPACE]: rows.map((row) => ({ id: row.id, role: row.role })) };
}
