import type { APIRoute, GetStaticPaths, GetStaticPathsResult } from "astro";
import { supabase } from "../../../lib/supabase";

export const getStaticPaths: GetStaticPaths =
	async (): Promise<GetStaticPathsResult> => {
		const { data, error } = await supabase.from("events").select("slug");

		if (error) throw error;

		return data.map((row) => {
			return {
				params: { slug: row.slug },
			};
		});
	};

export const POST: APIRoute = async ({ request, params, redirect }) => {
	const { data: user, error } = await supabase.auth.getUser();

	if (error) {
		return new Response(error.message, { status: 500 });
	}

	if (user) {
		const { slug } = params;

		if (!slug) {
			return new Response("'slug' not set.", { status: 400 });
		}

		const { error } = await supabase
			.from("rsvps")
			.insert({ auth_id: user.user.id, slug: slug });

		if (error) {
			return new Response(error.message, { status: 500 });
		}
	}

	return redirect(request.headers.get("referer") || "/", 302);
};

export const DELETE: APIRoute = async ({ request, params, redirect }) => {
	const { data: user, error } = await supabase.auth.getUser();

	if (error) {
		return new Response(error.message, { status: 500 });
	}

	if (user) {
		const { slug } = params;

		if (!slug) {
			return new Response("'slug' not set.", { status: 400 });
		}

		const { error } = await supabase
			.from("rsvps")
			.delete()
			.eq("slug", slug)
			.eq("auth_id", user.user.id);

		if (error) {
			return new Response(error.message, { status: 500 });
		}
	}

	return redirect(request.headers.get("referer") || "/", 302);
};
