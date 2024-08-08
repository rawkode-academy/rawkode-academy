import { endpoint } from "@restatedev/restate-sdk/fetch";
import { userRegistered } from "../../restate/user/registered.ts";
import type { APIRoute } from "astro";
// import { getSecret } from "astro:env/server";

const handler = endpoint()
	.bind(userRegistered)
	// .withIdentityV1(getSecret("RESTATE_IDENTITY_KEY") || "")
	.handler();

export const GET: APIRoute = async ({ request }) => {
	return handler.fetch(request);
};

export const POST: APIRoute = async ({ request }) => {
	return handler.fetch(request);
};
