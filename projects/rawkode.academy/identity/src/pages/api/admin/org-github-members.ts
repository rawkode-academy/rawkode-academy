import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "../../../db/schema";
import { checkAdminAuth } from "../../../lib/admin-auth";
import {
	isOrgRole,
	lookupGithubProfile,
	normaliseGithubLogin,
} from "../../../lib/github-profile";
import { addMemberByGithub } from "../../../lib/org-github-members";

export const prerender = false;

const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json" },
	});

/** GET /api/admin/org-github-members?organizationId=... lists pending memberships. */
export const GET: APIRoute = async (context) => {
	const authCheck = await checkAdminAuth(context);
	if (!authCheck.authorized) return authCheck.response;

	const organizationId = new URL(context.request.url).searchParams.get(
		"organizationId",
	);
	if (!organizationId) return json({ error: "organizationId is required" }, 400);

	const db = drizzle(env.DB, { schema });
	const rows = await db
		.select({
			id: schema.pendingMember.id,
			githubLogin: schema.pendingMember.githubLogin,
			role: schema.pendingMember.role,
			createdAt: schema.pendingMember.createdAt,
		})
		.from(schema.pendingMember)
		.where(eq(schema.pendingMember.organizationId, organizationId));
	return json(rows);
};

/**
 * POST /api/admin/org-github-members
 * { organizationId, githubLogin, role? }: adds the GitHub account to the
 * organisation now, or as a pending membership claimed on first sign-in.
 */
export const POST: APIRoute = async (context) => {
	const authCheck = await checkAdminAuth(context);
	if (!authCheck.authorized) return authCheck.response;

	const body = (await context.request.json()) as {
		organizationId?: unknown;
		githubLogin?: unknown;
		role?: unknown;
	};
	const login =
		typeof body.githubLogin === "string"
			? normaliseGithubLogin(body.githubLogin)
			: null;
	if (typeof body.organizationId !== "string" || !login) {
		return json({ error: "organizationId and a valid githubLogin are required" }, 400);
	}
	const role = body.role ?? "member";
	if (!isOrgRole(role)) return json({ error: "Unknown role" }, 400);

	const db = drizzle(env.DB, { schema });
	const org = await db.query.organization.findFirst({
		where: eq(schema.organization.id, body.organizationId),
	});
	if (!org) return json({ error: "Organization not found" }, 404);

	let profile;
	try {
		profile = await lookupGithubProfile(login);
	} catch (error) {
		console.error("[org-github-members] GitHub lookup failed:", error);
		return json({ error: "GitHub lookup failed, try again" }, 502);
	}
	if (!profile) return json({ error: `No GitHub user named ${login}` }, 404);

	const result = await addMemberByGithub(db, {
		organizationId: org.id,
		profile,
		role,
		invitedByUserId: authCheck.userId,
	});
	return json({ ...result, githubLogin: profile.login }, 201);
};

/** DELETE /api/admin/org-github-members?id=... cancels a pending membership. */
export const DELETE: APIRoute = async (context) => {
	const authCheck = await checkAdminAuth(context);
	if (!authCheck.authorized) return authCheck.response;

	const id = new URL(context.request.url).searchParams.get("id");
	if (!id) return json({ error: "id is required" }, 400);
	const db = drizzle(env.DB, { schema });
	await db
		.delete(schema.pendingMember)
		.where(eq(schema.pendingMember.id, id));
	return json({ deleted: id });
};
