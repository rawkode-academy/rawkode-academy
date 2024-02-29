import { Hono } from "hono";
import { addMiddleware } from "@trigger.dev/hono";
import { TriggerClient } from "@trigger.dev/sdk";
import { setupClerkDevIntegration } from "./clerkWebhooks";

export type Bindings = {
	CLERK_WEBHOOK_SIGNING_SECRET: string;
	TRIGGER_API_KEY: string;
	TRIGGER_API_URL: string;
};

const app = new Hono<{ Bindings: Bindings }>();

addMiddleware(app, (env) => {
	const client = new TriggerClient({
		id: "rawkode-academy-Gpkz",
		apiKey: env.TRIGGER_API_KEY,
		apiUrl: env.TRIGGER_API_URL,
	});

	setupClerkDevIntegration(client, env);

	return client;
});

export default app;
