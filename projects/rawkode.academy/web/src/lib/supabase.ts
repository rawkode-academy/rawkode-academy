import { createClient } from "@supabase/supabase-js";
import type { AstroCookies } from "astro";

export const supabase = createClient(
	import.meta.env.SUPABASE_URL,
	import.meta.env.SUPABASE_ANON_KEY,
	{
		auth: {
			flowType: "pkce",
		},
	},
);
export const isAuthenticated = (cookies: AstroCookies): boolean => {
	const accessToken = cookies.get("sb-access-token");
	const refreshToken = cookies.get("sb-refresh-token");

	return accessToken && refreshToken ? true :false;
}
