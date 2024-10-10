import type { APIRoute } from "astro";

export const prerender = false;

export const GET: APIRoute = ({ cookies, redirect }) => {
	cookies.delete("accessToken", {
		secure: import.meta.env.MODE === "production",
		httpOnly: true,
		path: "/",
		sameSite: "strict",
	});

	return redirect(import.meta.env.SITE);
};
