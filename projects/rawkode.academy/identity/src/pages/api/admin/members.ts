import type { APIRoute } from "astro";
import { drizzle } from "drizzle-orm/d1";
import { sql, eq, and, or, asc, desc } from "drizzle-orm";
import * as schema from "../../../db/schema";
import { checkAdminAuth } from "../../../lib/admin-auth";
import type { AuthEnv } from "../../../lib/auth";

export const prerender = false;

interface CreateMemberBody {
	organizationId: string;
	userId: string;
	role?: string;
}

/**
 * GET /api/admin/members
 * List members with pagination, sorting, and filtering
 */
export const GET: APIRoute = async (context) => {
	const authCheck = await checkAdminAuth(context);
	if (!authCheck.authorized) {
		return authCheck.response;
	}

	const env = context.locals.runtime.env as AuthEnv;
	const db = drizzle(env.DB, { schema });
	const url = new URL(context.request.url);

	// Pagination
	const start = parseInt(url.searchParams.get("_start") || "0", 10);
	const end = parseInt(url.searchParams.get("_end") || "10", 10);
	const limit = end - start;

	// Sorting
	const sortField = url.searchParams.get("_sort") || "createdAt";
	const sortOrder = url.searchParams.get("_order") || "desc";

	// Filtering
	const organizationId = url.searchParams.get("organizationId");
	const ids = url.searchParams.get("ids");

	// Build query with user join for name/email
	let conditions: ReturnType<typeof eq>[] = [];

	if (ids) {
		const idList = ids.split(",");
		conditions.push(or(...idList.map((id) => eq(schema.member.id, id)))!);
	}

	if (organizationId) {
		conditions.push(eq(schema.member.organizationId, organizationId));
	}

	const whereClause =
		conditions.length > 0 ? and(...conditions) : undefined;

	// Get members with user info
	const membersQuery = db
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
		.innerJoin(schema.user, eq(schema.member.userId, schema.user.id));

	let query = whereClause
		? membersQuery.where(whereClause).$dynamic()
		: membersQuery.$dynamic();

	// Apply sorting
	const sortColumn =
		sortField === "role"
			? schema.member.role
			: sortField === "userName"
				? schema.user.name
				: schema.member.createdAt;

	if (sortOrder === "asc") {
		query = query.orderBy(asc(sortColumn));
	} else {
		query = query.orderBy(desc(sortColumn));
	}

	// Get total count
	const countQuery = db
		.select({ count: sql<number>`count(*)` })
		.from(schema.member);

	const countResult = whereClause
		? await countQuery.where(whereClause)
		: await countQuery;

	const total = countResult[0]?.count ?? 0;

	// Apply pagination
	const data = await query.limit(limit).offset(start);

	return Response.json({ data, total });
};

/**
 * POST /api/admin/members
 * Add a member to an organization
 */
export const POST: APIRoute = async (context) => {
	const authCheck = await checkAdminAuth(context);
	if (!authCheck.authorized) {
		return authCheck.response;
	}

	const env = context.locals.runtime.env as AuthEnv;
	const db = drizzle(env.DB, { schema });

	const body = (await context.request.json()) as CreateMemberBody;

	if (!body.organizationId || !body.userId) {
		return new Response("organizationId and userId are required", {
			status: 400,
		});
	}

	// Check if organization exists
	const [org] = await db
		.select()
		.from(schema.organization)
		.where(eq(schema.organization.id, body.organizationId))
		.limit(1);

	if (!org) {
		return new Response("Organization not found", { status: 404 });
	}

	// Check if user exists
	const [user] = await db
		.select()
		.from(schema.user)
		.where(eq(schema.user.id, body.userId))
		.limit(1);

	if (!user) {
		return new Response("User not found", { status: 404 });
	}

	// Check if user is already a member
	const [existing] = await db
		.select()
		.from(schema.member)
		.where(
			and(
				eq(schema.member.organizationId, body.organizationId),
				eq(schema.member.userId, body.userId),
			),
		)
		.limit(1);

	if (existing) {
		return new Response("User is already a member of this organization", {
			status: 409,
		});
	}

	const validRoles = ["owner", "admin", "moderator", "contributor", "member"];
	const role = body.role || "member";

	if (!validRoles.includes(role)) {
		return new Response(`Invalid role. Must be one of: ${validRoles.join(", ")}`, {
			status: 400,
		});
	}

	const [member] = await db
		.insert(schema.member)
		.values({
			id: crypto.randomUUID(),
			organizationId: body.organizationId,
			userId: body.userId,
			role,
			createdAt: new Date(),
		})
		.returning();

	// Return member with user info
	return Response.json(
		{
			...member,
			userName: user.name,
			userEmail: user.email,
			userImage: user.image,
		},
		{ status: 201 },
	);
};
