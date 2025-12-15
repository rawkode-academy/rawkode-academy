import type { APIRoute } from "astro";
import { drizzle } from "drizzle-orm/d1";
import { sql, eq, or, asc, desc, like } from "drizzle-orm";
import * as schema from "../../../db/schema";
import { checkAdminAuth } from "../../../lib/admin-auth";
import type { AuthEnv } from "../../../lib/auth";

export const prerender = false;

/**
 * GET /api/admin/users
 * List users (read-only, for member selection)
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
	const search = url.searchParams.get("q");
	const ids = url.searchParams.get("ids");

	let query = db
		.select({
			id: schema.user.id,
			name: schema.user.name,
			email: schema.user.email,
			image: schema.user.image,
			createdAt: schema.user.createdAt,
		})
		.from(schema.user)
		.$dynamic();

	// Apply filters
	if (ids) {
		const idList = ids.split(",");
		query = query.where(or(...idList.map((id) => eq(schema.user.id, id))));
	} else if (search) {
		query = query.where(
			or(
				like(schema.user.name, `%${search}%`),
				like(schema.user.email, `%${search}%`),
			),
		);
	}

	// Apply sorting
	const sortColumn =
		sortField === "name"
			? schema.user.name
			: sortField === "email"
				? schema.user.email
				: schema.user.createdAt;

	if (sortOrder === "asc") {
		query = query.orderBy(asc(sortColumn));
	} else {
		query = query.orderBy(desc(sortColumn));
	}

	// Get total count
	const countResult = await db
		.select({ count: sql<number>`count(*)` })
		.from(schema.user);
	const total = countResult[0]?.count ?? 0;

	// Apply pagination
	const data = await query.limit(limit).offset(start);

	return Response.json({ data, total });
};
