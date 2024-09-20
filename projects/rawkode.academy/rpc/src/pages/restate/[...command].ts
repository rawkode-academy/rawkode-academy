import { endpoint } from "@restatedev/restate-sdk/fetch";
import type { APIRoute } from "astro";
import * as env from "astro:env/server";
import { RestateUserRegisteredWorkflow } from "../../restate/user/registered.ts";
import type { Env } from "../../restateEnv.ts";

const handler = endpoint()
	.bind(RestateUserRegisteredWorkflow)
	.withIdentityV1(env.getSecret("RESTATE_IDENTITY_KEY") as string)
	.handler();

export const GET: APIRoute = async ({ request }) => {
	const envPassthrough: Env = {
		BASELIME_API_KEY: env.BASELIME_API_KEY as string,
		RESEND_API_KEY: env.RESEND_API_KEY as string,
		RESTATE_API_KEY: env.RESTATE_API_KEY as string,
		TRIGGER_SECRET_KEY: env.TRIGGER_SECRET_KEY as string,
		WEBHOOK_SECRET_USER_REGISTERED: env.WEBHOOK_SECRET_USER_REGISTERED as string,
		WORKOS_API_KEY: env.WORKOS_API_KEY as string,
	};

	return handler.fetch(request, envPassthrough);
};

export const POST: APIRoute = async ({ request }) => {
	const envPassthrough: Env = {
		BASELIME_API_KEY: env.BASELIME_API_KEY as string,
		RESEND_API_KEY: env.RESEND_API_KEY as string,
		RESTATE_API_KEY: env.RESTATE_API_KEY as string,
		TRIGGER_SECRET_KEY: env.TRIGGER_SECRET_KEY as string,
		WEBHOOK_SECRET_USER_REGISTERED: env.WEBHOOK_SECRET_USER_REGISTERED as string,
		WORKOS_API_KEY: env.WORKOS_API_KEY as string,
	};

	return handler.fetch(request, envPassthrough);
};
