import * as clients from "@restatedev/restate-sdk-clients";
import { configure } from "@trigger.dev/sdk/v3";
import { WorkOS, type UserCreatedEvent } from "@workos-inc/node";
import type { APIRoute } from "astro";
import { getSecret } from "astro:env/server";
import { userRegistered as userRegisteredTrigger } from "../../trigger/user/registered.ts";
import { RestateUserRegisteredWorkflow } from "../../restate/user/registered.ts";

export const POST: APIRoute = async ({ request }) => {
	const payload: UserCreatedEvent = await request.json();
	const workos = new WorkOS(getSecret("WORKOS_API_KEY") || "");
	const workOsSignature = request.headers.get("workos-signature") || "";
	const webhookSecret = getSecret("WEBHOOK_SECRET_USER_REGISTERED") || "";
	const triggerSecretKey = getSecret("TRIGGER_SECRET_KEY") || "";

	await workos.webhooks.constructEvent({
		payload: payload,
		sigHeader: workOsSignature,
		secret: webhookSecret,
	});

	const restate = clients.connect({
		url: getSecret("RESTATE_CLOUD_URL") || "",
		headers: {
			Authorization: `Bearer ${getSecret("RESTATE_API_KEY") || ""}`,
		},
	});

	await restate
		.workflowClient(RestateUserRegisteredWorkflow, payload.data.id)
		.workflowSubmit(payload);

	configure({
		secretKey: triggerSecretKey,
	});

	await userRegisteredTrigger.trigger(payload, {
		idempotencyKey: payload.id,
	});

	return new Response("{}", {
		headers: {
			"Content-Type": "application/json",
		},
	});
};
