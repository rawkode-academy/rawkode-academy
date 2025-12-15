import type { APIRoute } from "astro";
import { drizzle } from "drizzle-orm/d1";
import { sql, eq, like, or, asc, desc } from "drizzle-orm";
import * as schema from "../../../db/schema";
import { checkAdminAuth } from "../../../lib/admin-auth";
import type { AuthEnv } from "../../../lib/auth";

export const prerender = false;

interface CreateOrganizationBody {
	name: string;
	slug: string;
	logo?: string | null;
	metadata?: Record<string, unknown>;
}

/**
 * GET /api/admin/organizations
 * List organizations with pagination, sorting, and filtering
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

	let query = db.select().from(schema.organization).$dynamic();

	// Apply filters
	if (ids) {
		const idList = ids.split(",");
		query = query.where(
			or(...idList.map((id) => eq(schema.organization.id, id))),
		);
	} else if (search) {
		query = query.where(
			or(
				like(schema.organization.name, `%${search}%`),
				like(schema.organization.slug, `%${search}%`),
			),
		);
	}

	// Apply sorting
	const sortColumn =
		sortField === "name"
			? schema.organization.name
			: sortField === "slug"
				? schema.organization.slug
				: schema.organization.createdAt;

	if (sortOrder === "asc") {
		query = query.orderBy(asc(sortColumn));
	} else {
		query = query.orderBy(desc(sortColumn));
	}

	// Get total count
	const countResult = await db
		.select({ count: sql<number>`count(*)` })
		.from(schema.organization);
	const total = countResult[0]?.count ?? 0;

	// Apply pagination
	const data = await query.limit(limit).offset(start);

	return Response.json({ data, total });
};

/**
 * POST /api/admin/organizations
 * Create a new organization
 */
export const POST: APIRoute = async (context) => {
	const authCheck = await checkAdminAuth(context);
	if (!authCheck.authorized) {
		return authCheck.response;
	}

	const env = context.locals.runtime.env as AuthEnv;
	const db = drizzle(env.DB, { schema });

	const body = (await context.request.json()) as CreateOrganizationBody;

	if (!body.name || !body.slug) {
		return new Response("Name and slug are required", { status: 400 });
	}

	// Check if slug is unique
	const existing = await db
		.select()
		.from(schema.organization)
		.where(eq(schema.organization.slug, body.slug))
		.limit(1);

	if (existing.length > 0) {
		return new Response("Organization with this slug already exists", {
			status: 409,
		});
	}

	const [org] = await db
		.insert(schema.organization)
		.values({
			id: crypto.randomUUID(),
			name: body.name,
			slug: body.slug,
			logo: body.logo ?? null,
			metadata: body.metadata ? JSON.stringify(body.metadata) : null,
			createdAt: new Date(),
		})
		.returning();

	return Response.json(org, { status: 201 });
};
