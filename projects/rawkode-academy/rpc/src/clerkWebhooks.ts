import { TriggerClient } from "@trigger.dev/sdk";
import { Webhook, WebhookVerificationError } from "svix";
import { Bindings } from ".";
type EventType = "user.created" | "user.deleted" | "user.updated";

interface EventBase {
	object: "event";
	type: EventType;
}

interface UserCreatedEvent extends EventBase {
	type: "user.created";
	data: {
		id: string;
		username: string | null;
	};
}

interface UserDeletedEvent extends EventBase {
	type: "user.deleted";
	data: {
		deleted: true;
		id: string;
	};
}

interface UserUpdatedEvent extends EventBase {
	type: "user.updated";
	data: {
		id: string;
		username: string | null;
	};
}

type UserEvent = UserCreatedEvent | UserDeletedEvent | UserUpdatedEvent;

export const setupClerkDevIntegration = async (
	client: TriggerClient,
	env: Bindings
) => {
	const clerkWebhookReceiver = client.defineHttpEndpoint({
		id: "clerk.com",
		title: "Clerk",
		source: "clerk.com",
		icon: "clerk",
		verify: async (
			request: Request
		): Promise<{ success: boolean; reason?: string }> => {
			const body = await request.text();
			const svixId = request.headers.get("svix-id") ?? "";
			const svixIdTimeStamp = request.headers.get("svix-timestamp") ?? "";
			const svixSignature = request.headers.get("svix-signature") ?? "";

			if (!svixId || !svixIdTimeStamp || !svixSignature) {
				return {
					success: false,
					reason: "Missing svix headers",
				};
			}

			const svixHeaders = {
				"svix-id": svixId,
				"svix-timestamp": svixIdTimeStamp,
				"svix-signature": svixSignature,
			};

			const wh = new Webhook(env.CLERK_WEBHOOK_SIGNING_SECRET as string);

			type WebhookEvent = string;

			try {
				wh.verify(body, svixHeaders) as WebhookEvent;
				return { success: true };
			} catch (err: unknown) {
				console.log(`❌ Error message: ${(err as Error).message}`);

				if (err instanceof WebhookVerificationError) {
					return {
						success: false,
						reason: `Webhook verification failed: ${err.message}`,
					};
				}

				return {
					success: false,
					reason: "Unknown error",
				};
			}
		},
	});

	client.defineJob({
		id: "clerk-sync-user-activity",
		name: "Sync user activities from Clerk.dev",
		version: "0.0.1",
		trigger: clerkWebhookReceiver.onRequest(),
		enabled: true,
		run: async (request, io) => {
			const event: UserEvent = await request.json();

			switch (event.type) {
				case "user.created": {
					await io.logger.info("event: user.created");
					break;
				}
				case "user.deleted": {
					await io.logger.info("event: user.deleted");
					break;
				}
				case "user.updated": {
					await io.logger.info("event: user.updated");
					break;
				}
			}
		},
	});
};
