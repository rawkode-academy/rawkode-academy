import { createClient } from "@supabase/supabase-js";
import type { AstroCookies } from "astro";
import type { Database } from "../database.types";

export const supabase = createClient<Database>(
	import.meta.env.SUPABASE_URL,
	import.meta.env.SUPABASE_ANON_KEY,
	{
		auth: {
			flowType: "pkce",
		},
	},
);
export const isAuthenticated = async (cookies: AstroCookies): Promise<boolean> => {
	const accessToken = cookies.get("sb-access-token");
	const refreshToken = cookies.get("sb-refresh-token");

	return accessToken && refreshToken ? true : false;
};
