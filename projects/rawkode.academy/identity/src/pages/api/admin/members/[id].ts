import type { APIRoute } from "astro";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import * as schema from "../../../../db/schema";
import { checkAdminAuth } from "../../../../lib/admin-auth";
import type { AuthEnv } from "../../../../lib/auth";

export const prerender = false;

interface UpdateMemberBody {
	role?: string;
}

/**
 * GET /api/admin/members/:id
 * Get a single member by ID
 */
export const GET: APIRoute = async (context) => {
	const authCheck = await checkAdminAuth(context);
	if (!authCheck.authorized) {
		return authCheck.response;
	}

	const { id } = context.params;
	if (!id) {
		return new Response("Member ID is required", { status: 400 });
	}

	const env = context.locals.runtime.env as AuthEnv;
	const db = drizzle(env.DB, { schema });

	const [member] = await db
		.select({
			id: schema.member.id,
			organizationId: schema.member.organizationId,
			userId: schema.member.userId,
			role: schema.member.role,
			createdAt: schema.member.createdAt,
			userName: schema.user.name,
			userEmail: schema.user.email,
			userImage: schema.user.image,
		})
		.from(schema.member)
		.innerJoin(schema.user, eq(schema.member.userId, schema.user.id))
		.where(eq(schema.member.id, id))
		.limit(1);

	if (!member) {
		return new Response("Member not found", { status: 404 });
	}

	return Response.json(member);
};

/**
 * PATCH /api/admin/members/:id
 * Update a member's role
 */
export const PATCH: APIRoute = async (context) => {
	const authCheck = await checkAdminAuth(context);
	if (!authCheck.authorized) {
		return authCheck.response;
	}

	const { id } = context.params;
	if (!id) {
		return new Response("Member ID is required", { status: 400 });
	}

	const env = context.locals.runtime.env as AuthEnv;
	const db = drizzle(env.DB, { schema });

	// Check if member exists
	const [existing] = await db
		.select()
		.from(schema.member)
		.where(eq(schema.member.id, id))
		.limit(1);

	if (!existing) {
		return new Response("Member not found", { status: 404 });
	}

	const body = (await context.request.json()) as UpdateMemberBody;

	if (body.role !== undefined) {
		const validRoles = ["owner", "admin", "moderator", "contributor", "member"];
		if (!validRoles.includes(body.role)) {
			return new Response(
				`Invalid role. Must be one of: ${validRoles.join(", ")}`,
				{ status: 400 },
			);
		}
	}

	const updateData: Partial<typeof schema.member.$inferInsert> = {};
	if (body.role !== undefined) updateData.role = body.role;

	const [updated] = await db
		.update(schema.member)
		.set(updateData)
		.where(eq(schema.member.id, id))
		.returning();

	// Get user info
	const [user] = await db
		.select()
		.from(schema.user)
		.where(eq(schema.user.id, updated.userId))
		.limit(1);

	return Response.json({
		...updated,
		userName: user?.name,
		userEmail: user?.email,
		userImage: user?.image,
	});
};

/**
 * DELETE /api/admin/members/:id
 * Remove a member from an organization
 */
export const DELETE: APIRoute = async (context) => {
	const authCheck = await checkAdminAuth(context);
	if (!authCheck.authorized) {
		return authCheck.response;
	}

	const { id } = context.params;
	if (!id) {
		return new Response("Member ID is required", { status: 400 });
	}

	const env = context.locals.runtime.env as AuthEnv;
	const db = drizzle(env.DB, { schema });

	// Check if member exists
	const [existing] = await db
		.select()
		.from(schema.member)
		.where(eq(schema.member.id, id))
		.limit(1);

	if (!existing) {
		return new Response("Member not found", { status: 404 });
	}

	await db.delete(schema.member).where(eq(schema.member.id, id));

	return new Response(null, { status: 204 });
};
