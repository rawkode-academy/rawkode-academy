import type { APIRoute } from "astro";

export const GET: APIRoute = async ({ locals }) => {
	const user = locals.user;

	if (!user) {
		return new Response(JSON.stringify({ authenticated: false }), {
			status: 401,
			headers: {
				"Content-Type": "application/json",
			},
		});
	}

	return new Response(
		JSON.stringify({
			authenticated: true,
			user: {
				sub: user.sub,
				name: user.name,
			},
		}),
		{
			status: 200,
			headers: {
				"Content-Type": "application/json",
			},
		},
	);
};
