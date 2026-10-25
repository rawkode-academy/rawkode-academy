import type { APIRoute } from "astro";
import { deleteSession, readCookie, SESSION_COOKIE, sessionCookie } from "@/lib/auth";
import { cmsBindings } from "@/lib/server";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
	const token = readCookie(request, SESSION_COOKIE);
	if (token) await deleteSession((await cmsBindings()).DB, token);
	return new Response(null, {
		status: 303,
		headers: { location: "/login", "set-cookie": sessionCookie("", 0) },
	});
};
