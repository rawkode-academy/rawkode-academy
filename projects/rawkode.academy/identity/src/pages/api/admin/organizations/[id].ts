import type { APIRoute } from "astro";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import * as schema from "../../../../db/schema";
import { checkAdminAuth } from "../../../../lib/admin-auth";
import type { AuthEnv } from "../../../../lib/auth";

export const prerender = false;

interface UpdateOrganizationBody {
	name?: string;
	slug?: string;
	logo?: string | null;
	metadata?: Record<string, unknown> | null;
}

/**
 * GET /api/admin/organizations/:id
 * Get a single organization by ID
 */
export const GET: APIRoute = async (context) => {
	const authCheck = await checkAdminAuth(context);
	if (!authCheck.authorized) {
		return authCheck.response;
	}

	const { id } = context.params;
	if (!id) {
		return new Response("Organization ID is required", { status: 400 });
	}

	const env = context.locals.runtime.env as AuthEnv;
	const db = drizzle(env.DB, { schema });

	const [org] = await db
		.select()
		.from(schema.organization)
		.where(eq(schema.organization.id, id))
		.limit(1);

	if (!org) {
		return new Response("Organization not found", { status: 404 });
	}

	return Response.json(org);
};

/**
 * PATCH /api/admin/organizations/:id
 * Update an organization
 */
export const PATCH: APIRoute = async (context) => {
	const authCheck = await checkAdminAuth(context);
	if (!authCheck.authorized) {
		return authCheck.response;
	}

	const { id } = context.params;
	if (!id) {
		return new Response("Organization ID is required", { status: 400 });
	}

	const env = context.locals.runtime.env as AuthEnv;
	const db = drizzle(env.DB, { schema });

	// Check if org exists
	const [existing] = await db
		.select()
		.from(schema.organization)
		.where(eq(schema.organization.id, id))
		.limit(1);

	if (!existing) {
		return new Response("Organization not found", { status: 404 });
	}

	const body = (await context.request.json()) as UpdateOrganizationBody;

	// If slug is being changed, check uniqueness
	if (body.slug && body.slug !== existing.slug) {
		const slugExists = await db
			.select()
			.from(schema.organization)
			.where(eq(schema.organization.slug, body.slug))
			.limit(1);

		if (slugExists.length > 0) {
			return new Response("Organization with this slug already exists", {
				status: 409,
			});
		}
	}

	const updateData: Partial<typeof schema.organization.$inferInsert> = {};

	if (body.name !== undefined) updateData.name = body.name;
	if (body.slug !== undefined) updateData.slug = body.slug;
	if (body.logo !== undefined) updateData.logo = body.logo;
	if (body.metadata !== undefined) {
		updateData.metadata = body.metadata ? JSON.stringify(body.metadata) : null;
	}

	const [updated] = await db
		.update(schema.organization)
		.set(updateData)
		.where(eq(schema.organization.id, id))
		.returning();

	return Response.json(updated);
};

/**
 * DELETE /api/admin/organizations/:id
 * Delete an organization
 */
export const DELETE: APIRoute = async (context) => {
	const authCheck = await checkAdminAuth(context);
	if (!authCheck.authorized) {
		return authCheck.response;
	}

	const { id } = context.params;
	if (!id) {
		return new Response("Organization ID is required", { status: 400 });
	}

	const env = context.locals.runtime.env as AuthEnv;
	const db = drizzle(env.DB, { schema });

	// Check if org exists
	const [existing] = await db
		.select()
		.from(schema.organization)
		.where(eq(schema.organization.id, id))
		.limit(1);

	if (!existing) {
		return new Response("Organization not found", { status: 404 });
	}

	// Delete the organization (cascades to members, teams, invitations)
	await db.delete(schema.organization).where(eq(schema.organization.id, id));

	return new Response(null, { status: 204 });
};
