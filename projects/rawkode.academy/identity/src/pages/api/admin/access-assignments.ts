import type { APIRoute } from "astro";
import { drizzle } from "drizzle-orm/d1";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { sql, eq, and, or, asc, desc } from "drizzle-orm";
import * as schema from "../../../db/schema";
import {
	findAccessApplication,
	findAccessRole,
} from "../../../lib/access-applications";
import { checkAdminAuth } from "../../../lib/admin-auth";
import type { AuthEnv } from "../../../lib/auth";

export const prerender = false;

interface CreateAccessAssignmentBody {
	userId: string;
	clientId: string;
	role: string;
	reason?: string;
	expiresAt?: string | null;
}

const selectAssignment = {
	id: schema.accessAssignment.id,
	userId: schema.accessAssignment.userId,
	clientId: schema.accessAssignment.clientId,
	role: schema.accessAssignment.role,
	reason: schema.accessAssignment.reason,
	expiresAt: schema.accessAssignment.expiresAt,
	createdAt: schema.accessAssignment.createdAt,
	updatedAt: schema.accessAssignment.updatedAt,
	userName: schema.user.name,
	userEmail: schema.user.email,
	userImage: schema.user.image,
	grantedByUserId: schema.accessAssignment.grantedByUserId,
};

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
 * GET /api/admin/access-assignments
 * List per-application role assignments with pagination, sorting, and filtering.
 */
export const GET: APIRoute = async (context) => {
	const authCheck = await checkAdminAuth(context);
	if (!authCheck.authorized) {
		return authCheck.response;
	}

	const env = context.locals.runtime.env as AuthEnv;
	const db = drizzle(env.DB, { schema });
	const url = new URL(context.request.url);

	const start = parseInt(url.searchParams.get("_start") || "0", 10);
	const end = parseInt(url.searchParams.get("_end") || "25", 10);
	const limit = end - start;
	const sortField = url.searchParams.get("_sort") || "createdAt";
	const sortOrder = url.searchParams.get("_order") || "desc";

	const ids = url.searchParams.get("ids");
	const userId = url.searchParams.get("userId");
	const clientId = url.searchParams.get("clientId");
	const role = url.searchParams.get("role");

	let conditions: ReturnType<typeof eq>[] = [];
	if (ids) {
		const idList = ids.split(",");
		conditions.push(or(...idList.map((id) => eq(schema.accessAssignment.id, id)))!);
	}
	if (userId) {
		conditions.push(eq(schema.accessAssignment.userId, userId));
	}
	if (clientId) {
		conditions.push(eq(schema.accessAssignment.clientId, clientId));
	}
	if (role) {
		conditions.push(eq(schema.accessAssignment.role, role));
	}

	const whereClause =
		conditions.length > 0 ? and(...conditions) : undefined;

	const assignmentsQuery = db
		.select(selectAssignment)
		.from(schema.accessAssignment)
		.innerJoin(schema.user, eq(schema.accessAssignment.userId, schema.user.id));

	let query = whereClause
		? assignmentsQuery.where(whereClause).$dynamic()
		: assignmentsQuery.$dynamic();

	const sortColumn =
		sortField === "userName"
			? schema.user.name
			: sortField === "clientId"
				? schema.accessAssignment.clientId
				: sortField === "role"
					? schema.accessAssignment.role
					: schema.accessAssignment.createdAt;

	query =
		sortOrder === "asc"
			? query.orderBy(asc(sortColumn))
			: query.orderBy(desc(sortColumn));

	const countQuery = db
		.select({ count: sql<number>`count(*)` })
		.from(schema.accessAssignment);
	const countResult = whereClause
		? await countQuery.where(whereClause)
		: await countQuery;
	const total = countResult[0]?.count ?? 0;

	const data = await query.limit(limit).offset(start);
	return Response.json({ data, total });
};

/**
 * POST /api/admin/access-assignments
 * Assign a per-application role to a user.
 */
export const POST: APIRoute = async (context) => {
	const authCheck = await checkAdminAuth(context);
	if (!authCheck.authorized) {
		return authCheck.response;
	}

	const env = context.locals.runtime.env as AuthEnv;
	const db = drizzle(env.DB, { schema });
	const body = (await context.request.json()) as CreateAccessAssignmentBody;

	if (!body.userId || !body.clientId || !body.role) {
		return new Response("userId, clientId, and role are required", {
			status: 400,
		});
	}

	const application = findAccessApplication(body.clientId);
	if (!application) {
		return new Response("Unknown application clientId", { status: 400 });
	}

	const accessRole = findAccessRole(body.clientId, body.role);
	if (!accessRole) {
		return new Response(
			`Invalid role for ${application.name}. Must be one of: ${application.roles
				.map((role) => role.key)
				.join(", ")}`,
			{ status: 400 },
		);
	}

	const [user] = await db
		.select()
		.from(schema.user)
		.where(eq(schema.user.id, body.userId))
		.limit(1);
	if (!user) {
		return new Response("User not found", { status: 404 });
	}

	const expiresAt =
		body.expiresAt === undefined || body.expiresAt === null || body.expiresAt === ""
			? null
			: new Date(body.expiresAt);
	if (expiresAt && Number.isNaN(expiresAt.getTime())) {
		return new Response("expiresAt must be a valid date", { status: 400 });
	}

	const [existing] = await db
		.select()
		.from(schema.accessAssignment)
		.where(
			and(
				eq(schema.accessAssignment.userId, body.userId),
				eq(schema.accessAssignment.clientId, body.clientId),
				eq(schema.accessAssignment.role, body.role),
			),
		)
		.limit(1);

	if (existing) {
		const [updated] = await db
			.update(schema.accessAssignment)
			.set({
				reason: body.reason || null,
				expiresAt,
				grantedByUserId: authCheck.userId,
				updatedAt: new Date(),
			})
			.where(eq(schema.accessAssignment.id, existing.id))
			.returning();
		await revokeClientTokens(db, body.userId, body.clientId);

		return Response.json({
			...updated,
			userName: user.name,
			userEmail: user.email,
			userImage: user.image,
		});
	}

	const [assignment] = await db
		.insert(schema.accessAssignment)
		.values({
			id: crypto.randomUUID(),
			userId: body.userId,
			clientId: body.clientId,
			role: body.role,
			reason: body.reason || null,
			expiresAt,
			grantedByUserId: authCheck.userId,
			createdAt: new Date(),
			updatedAt: new Date(),
		})
		.returning();
	await revokeClientTokens(db, body.userId, body.clientId);

	return Response.json(
		{
			...assignment,
			userName: user.name,
			userEmail: user.email,
			userImage: user.image,
		},
		{ status: 201 },
	);
};
