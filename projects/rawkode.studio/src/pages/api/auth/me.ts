import type { APIRoute } from "astro";

export const GET: APIRoute = async ({ locals }) => {
	if (!locals.user) {
		return Response.json({ authenticated: false }, { status: 401 });
	}

	return Response.json({
		authenticated: true,
		user: locals.user,
	});
};
