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

	return {
		roles,
		groups: roles,
		[ROLE_NAMESPACE]: roles,
		[CLIENT_NAMESPACE]: clientId,
	};
}
