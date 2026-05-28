import type { APIRoute } from "astro";
import { ACCESS_APPLICATIONS } from "../../../lib/access-applications";
import { checkAdminAuth } from "../../../lib/admin-auth";

export const prerender = false;

export const GET: APIRoute = async (context) => {
	const authCheck = await checkAdminAuth(context);
	if (!authCheck.authorized) {
		return authCheck.response;
	}

	return Response.json({
		data: ACCESS_APPLICATIONS.map((app) => ({
			id: app.clientId,
			...app,
		})),
		total: ACCESS_APPLICATIONS.length,
	});
};
