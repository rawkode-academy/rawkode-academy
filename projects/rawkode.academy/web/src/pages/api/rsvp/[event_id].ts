import type { APIRoute } from "astro";
import { supabase } from "../../../lib/supabase";

export const POST: APIRoute = async ({ params, redirect }) => {
	const { data: user, error } = await supabase.auth.getUser();

	if (error) {
		return new Response(error.message, { status: 500 });
	}

	if (user) {
		const { event_id } = params;

		if (!event_id) {
			return new Response("'event_id' not set.", { status: 400 });
		}

		const { error } = await supabase
			.from("rsvps")
			.insert({ auth_id: user.user.id, event_id: event_id });

		if (error) {
			return new Response(error.message, { status: 500 });
		}
	}

	return redirect("/events");
};

export const DELETE: APIRoute = async ({ params, redirect }) => {
	const { data: user, error } = await supabase.auth.getUser();

	if (error) {
		return new Response(error.message, { status: 500 });
	}

	if (user) {
		const { event_id } = params;

		if (!event_id) {
			return new Response("'event_id' not set.", { status: 400 });
		}

		const { error } = await supabase
			.from("rsvps")
			.delete()
			.eq("event_id", event_id)
			.eq("auth_id", user.user.id);

		if (error) {
			return new Response(error.message, { status: 500 });
		}
	}

	return redirect("/events");
};
