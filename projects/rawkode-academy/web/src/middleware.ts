import { defineMiddleware } from "astro:middleware";
import { supabase } from "./lib/supabase";

export const onRequest = defineMiddleware(async (context, next) => {
	const cookies = context.cookies;
	const locals = context.locals;

	const accessToken = cookies.get("sb-access-token");
	const refreshToken = cookies.get("sb-refresh-token");

	if (!accessToken || !refreshToken) {
		return next();
	}

	const { data, error } = await supabase.auth.setSession({
		refresh_token: refreshToken.value,
		access_token: accessToken.value,
	});

	if (error || (!data.user || !data.user.email || !data.user.user_metadata || !data.user.user_metadata.full_name)) {
		cookies.delete("sb-access-token");
		cookies.delete("sb-refresh-token");

		return next();
	}

	locals.user = {
		name: data.user.user_metadata.full_name,
		email: data.user.email,
		avatarUrl: data.user.user_metadata.avatar_url,
	};

	return next();
});
