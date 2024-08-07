import type { APIRoute } from "astro";
import { getSecret } from "astro:env/server";
import { WorkOS } from "@workos-inc/node";

export const POST: APIRoute = async ({ request }) => {
	const payload = await request.json();
	const workos = new WorkOS(getSecret("WORKOS_API_KEY") || "");
	const workOsSignature = request.headers.get("workos-signature") || "";
	const webhookSecret = getSecret("WEBHOOK_SECRET_USER_REGISTERED") || "";

	await workos.webhooks.constructEvent({
		payload: payload,
		sigHeader: workOsSignature,
		secret: webhookSecret,
	});

	return new Response(
		JSON.stringify({
			name: "rawkode",
		})
	);
};
