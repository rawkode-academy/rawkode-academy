import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";
import { drizzle } from "drizzle-orm/d1";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { eq, and } from "drizzle-orm";
import * as schema from "../../../../db/schema";
import { checkAdminAuth } from "../../../../lib/admin-auth";

export const prerender = false;

async function revokeClientTokens(
	db: DrizzleD1Database<typeof schema>,
	userId: string,
	clientId: string,
) {
	await db
		.delete(schema.oauthAccessToken)
		.where(
			and(
				eq(schema.oauthAccessToken.userId, userId),
				eq(schema.oauthAccessToken.clientId, clientId),
			),
		);
}

/**
 * DELETE /api/admin/access-assignments/:id
 * Remove a per-application role assignment from a user.
 */
export const DELETE: APIRoute = async (context) => {
	const authCheck = await checkAdminAuth(context);
	if (!authCheck.authorized) {
		return authCheck.response;
	}

	const { id } = context.params;
	if (!id) {
		return new Response("Access assignment ID is required", { status: 400 });
	}

	const db = drizzle(env.DB, { schema });

	const [existing] = await db
		.select()
		.from(schema.accessAssignment)
		.where(eq(schema.accessAssignment.id, id))
		.limit(1);
	if (!existing) {
		return new Response("Access assignment not found", { status: 404 });
	}

	await db
		.delete(schema.accessAssignment)
		.where(eq(schema.accessAssignment.id, id));
	await revokeClientTokens(db, existing.userId, existing.clientId);

	return new Response(null, { status: 204 });
};
