import type { APIRoute } from "astro";
import { supabase } from "../../../lib/supabase";

export const socialAuth: APIRoute = async ({ redirect }) => {
	const { data, error } = await supabase.auth.signInWithOAuth({
		provider: "github",
		options: {
			redirectTo: "http://localhost:4321/api/auth/callback",
		},
	});

	if (error) {
		return new Response(error.message, { status: 500 });
	}

	return redirect(data.url);
};

export const localAuth: APIRoute = async ({ request, cookies, redirect }) => {
	const email = "jack@sg1.online";
	const password = "duringmybackswing!";

	const { data, error } = await supabase.auth.signInWithPassword({
		email,
		password,
	});

	if (error) {
		return new Response(error.message, { status: 500 });
	}

	const { access_token, refresh_token } = data.session;

	cookies.set("sb-access-token", access_token, {
		path: "/",
	});

	cookies.set("sb-refresh-token", refresh_token, {
		path: "/",
	});

	return redirect(request.headers.get("Referer") || "/");
};

console.log(process.env.SUPABASE_URL);
export const GET = process.env.SUPABASE_URL?.includes("localhost")
	? localAuth
	: socialAuth;
