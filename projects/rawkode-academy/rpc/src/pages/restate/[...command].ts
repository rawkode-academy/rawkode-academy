import { endpoint } from "@restatedev/restate-sdk/fetch";
import type { APIRoute } from "astro";
import * as env from "astro:env/server";
import { RestateUserRegisteredWorkflow } from "../../restate/user/registered.ts";
import type { Env } from "../../restateEnv.ts";

const handler = endpoint()
	.bind(RestateUserRegisteredWorkflow)
	// .withIdentityV1(env.getSecret("RESTATE_IDENTITY_KEY") || "")
	.handler();

export const GET: APIRoute = async ({ request }) => {
	const envPassthrough: Env = {
		RESEND_API_KEY: env.RESEND_API_KEY,
		TRIGGER_SECRET_KEY: env.TRIGGER_SECRET_KEY,
		WEBHOOK_SECRET_USER_REGISTERED: env.WEBHOOK_SECRET_USER_REGISTERED,
		WORKOS_API_KEY: env.WORKOS_API_KEY,
	};

	return handler.fetch(request, envPassthrough);
};

export const POST: APIRoute = async ({ request }) => {
	const envPassthrough: Env = {
		RESEND_API_KEY: env.RESEND_API_KEY,
		TRIGGER_SECRET_KEY: env.TRIGGER_SECRET_KEY,
		WEBHOOK_SECRET_USER_REGISTERED: env.WEBHOOK_SECRET_USER_REGISTERED,
		WORKOS_API_KEY: env.WORKOS_API_KEY,
	};

	return handler.fetch(request, envPassthrough);
};
