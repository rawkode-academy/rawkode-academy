import type { APIRoute } from "astro";
import { drizzle } from "drizzle-orm/d1";
import { sql, eq, and, or, asc, desc, like } from "drizzle-orm";
import * as schema from "../../../db/schema";
import { checkAdminAuth } from "../../../lib/admin-auth";
import type { AuthEnv } from "../../../lib/auth";

export const prerender = false;

interface CreateTeamBody {
	name: string;
	organizationId: string;
}

/**
 * GET /api/admin/teams
 * List teams with pagination, sorting, and filtering
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
	const search = url.searchParams.get("q");
	const ids = url.searchParams.get("ids");

	let conditions: ReturnType<typeof eq>[] = [];

	if (ids) {
		const idList = ids.split(",");
		conditions.push(or(...idList.map((id) => eq(schema.team.id, id)))!);
	}

	if (organizationId) {
		conditions.push(eq(schema.team.organizationId, organizationId));
	}

	if (search) {
		conditions.push(like(schema.team.name, `%${search}%`));
	}

	const whereClause =
		conditions.length > 0 ? and(...conditions) : undefined;

	// Get teams with organization name
	const teamsQuery = db
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
		);

	let query = whereClause
		? teamsQuery.where(whereClause).$dynamic()
		: teamsQuery.$dynamic();

	// Apply sorting
	const sortColumn =
		sortField === "name" ? schema.team.name : schema.team.createdAt;

	if (sortOrder === "asc") {
		query = query.orderBy(asc(sortColumn));
	} else {
		query = query.orderBy(desc(sortColumn));
	}

	// Get total count
	const countQuery = db.select({ count: sql<number>`count(*)` }).from(schema.team);

	const countResult = whereClause
		? await countQuery.where(whereClause)
		: await countQuery;

	const total = countResult[0]?.count ?? 0;

	// Apply pagination
	const data = await query.limit(limit).offset(start);

	return Response.json({ data, total });
};

/**
 * POST /api/admin/teams
 * Create a new team
 */
export const POST: APIRoute = async (context) => {
	const authCheck = await checkAdminAuth(context);
	if (!authCheck.authorized) {
		return authCheck.response;
	}

	const env = context.locals.runtime.env as AuthEnv;
	const db = drizzle(env.DB, { schema });

	const body = (await context.request.json()) as CreateTeamBody;

	if (!body.name || !body.organizationId) {
		return new Response("name and organizationId are required", {
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

	const [team] = await db
		.insert(schema.team)
		.values({
			id: crypto.randomUUID(),
			name: body.name,
			organizationId: body.organizationId,
			createdAt: new Date(),
		})
		.returning();

	return Response.json(
		{
			...team,
			organizationName: org.name,
		},
		{ status: 201 },
	);
};
