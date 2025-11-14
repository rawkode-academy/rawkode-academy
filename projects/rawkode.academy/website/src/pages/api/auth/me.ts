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
				id: user.id,
				name: user.name,
				email: user.email,
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
