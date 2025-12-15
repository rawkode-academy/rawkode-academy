import type { APIRoute } from "astro";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import * as schema from "../../../../db/schema";
import { checkAdminAuth } from "../../../../lib/admin-auth";
import type { AuthEnv } from "../../../../lib/auth";

export const prerender = false;

interface UpdateTeamBody {
	name?: string;
}

/**
 * GET /api/admin/teams/:id
 * Get a single team by ID
 */
export const GET: APIRoute = async (context) => {
	const authCheck = await checkAdminAuth(context);
	if (!authCheck.authorized) {
		return authCheck.response;
	}

	const { id } = context.params;
	if (!id) {
		return new Response("Team ID is required", { status: 400 });
	}

	const env = context.locals.runtime.env as AuthEnv;
	const db = drizzle(env.DB, { schema });

	const [team] = await db
		.select({
			id: schema.team.id,
			name: schema.team.name,
			organizationId: schema.team.organizationId,
			createdAt: schema.team.createdAt,
			updatedAt: schema.team.updatedAt,
			organizationName: schema.organization.name,
		})
		.from(schema.team)
		.innerJoin(
			schema.organization,
			eq(schema.team.organizationId, schema.organization.id),
		)
		.where(eq(schema.team.id, id))
		.limit(1);

	if (!team) {
		return new Response("Team not found", { status: 404 });
	}

	return Response.json(team);
};

/**
 * PATCH /api/admin/teams/:id
 * Update a team
 */
export const PATCH: APIRoute = async (context) => {
	const authCheck = await checkAdminAuth(context);
	if (!authCheck.authorized) {
		return authCheck.response;
	}

	const { id } = context.params;
	if (!id) {
		return new Response("Team ID is required", { status: 400 });
	}

	const env = context.locals.runtime.env as AuthEnv;
	const db = drizzle(env.DB, { schema });

	// Check if team exists
	const [existing] = await db
		.select()
		.from(schema.team)
		.where(eq(schema.team.id, id))
		.limit(1);

	if (!existing) {
		return new Response("Team not found", { status: 404 });
	}

	const body = (await context.request.json()) as UpdateTeamBody;

	const updateData: Partial<typeof schema.team.$inferInsert> = {};
	if (body.name !== undefined) updateData.name = body.name;

	const [updated] = await db
		.update(schema.team)
		.set(updateData)
		.where(eq(schema.team.id, id))
		.returning();

	// Get organization name
	const [org] = await db
		.select()
		.from(schema.organization)
		.where(eq(schema.organization.id, updated.organizationId))
		.limit(1);

	return Response.json({
		...updated,
		organizationName: org?.name,
	});
};

/**
 * DELETE /api/admin/teams/:id
 * Delete a team
 */
export const DELETE: APIRoute = async (context) => {
	const authCheck = await checkAdminAuth(context);
	if (!authCheck.authorized) {
		return authCheck.response;
	}

	const { id } = context.params;
	if (!id) {
		return new Response("Team ID is required", { status: 400 });
	}

	const env = context.locals.runtime.env as AuthEnv;
	const db = drizzle(env.DB, { schema });

	// Check if team exists
	const [existing] = await db
		.select()
		.from(schema.team)
		.where(eq(schema.team.id, id))
		.limit(1);

	if (!existing) {
		return new Response("Team not found", { status: 404 });
	}

	// Delete the team (cascades to team members)
	await db.delete(schema.team).where(eq(schema.team.id, id));

	return new Response(null, { status: 204 });
};
