import * as clients from "@restatedev/restate-sdk-clients";
import { configure } from "@trigger.dev/sdk/v3";
import {
	WorkOS,
	type AuthenticationEmailVerificationSucceededEventResponse,
	type UserCreatedEventResponse,
} from "@workos-inc/node";
import type { APIRoute } from "astro";
import { getSecret } from "astro:env/server";
import { userRegistered as userRegisteredTrigger } from "../../trigger/user/registered.ts";
import { RestateUserRegisteredWorkflow } from "../../restate/user/registered.ts";

const workos = new WorkOS(getSecret("WORKOS_API_KEY") || "");
const webhookSecret = getSecret("WEBHOOK_SECRET_USER_REGISTERED") || "";

const restateApiKey = getSecret("RESTATE_API_KEY");
const triggerSecretKey = getSecret("TRIGGER_SECRET_KEY") || "";

export const POST: APIRoute = async ({ request }) => {
	const payload = await request.json();
	const workOsSignature = request.headers.get("workos-signature") || "";

	const webhook = await workos.webhooks.constructEvent({
		payload,
		sigHeader: workOsSignature,
		secret: webhookSecret,
	});

	const restate = clients.connect({
		url: getSecret("RESTATE_CLOUD_URL") || "",
		headers: {
			Authorization: `Bearer ${restateApiKey}`,
		},
	});

	try {
		switch (webhook.event) {
			case "user.created":
				await userCreated(restate, payload as UserCreatedEventResponse);
				break;

			case "authentication.email_verification_succeeded":
				await userEmailVerified(
					restate,
					payload as AuthenticationEmailVerificationSucceededEventResponse
				);
				break;
		}

		return new Response("{}", {
			headers: {
				"Content-Type": "application/json",
			},
		});
	} catch (error) {
		console.error(error);

		return new Response("{}", {
			headers: {
				"Content-Type": "application/json",
			},
			status: 500,
		});
	}
};

const userCreated = async (
	restate: clients.Ingress,
	payload: UserCreatedEventResponse
) => {
	await restate
		.workflowClient(RestateUserRegisteredWorkflow, payload.data.id)
		.workflowSubmit(payload);

	configure({
		secretKey: triggerSecretKey,
	});

	await userRegisteredTrigger.trigger(payload, {
		idempotencyKey: payload.id,
	});

	return;
};

const userEmailVerified = async (
	restate: clients.Ingress,
	payload: AuthenticationEmailVerificationSucceededEventResponse
) => {
	if (!payload.data.user_id) {
		console.debug(payload);
		throw new Error("User ID is required");
	}

	await restate
		.workflowClient(RestateUserRegisteredWorkflow, payload.data.user_id)
		.verifiedEmail();
	return;
};
