const logger = require("zitadel/log");
const http = require("zitadel/http");

function provisionZulipUserExternal(ctx, api) {
	if (
		ctx.v1.authRequest === undefined ||
		ctx.v1.authRequest.applicationId === ""
	) {
		logger.log("🤖 No auth request or app id provided");
		return;
	}

	if (ctx.v1.authRequest.applicationId !== "293097955970320066") {
		logger.log("Wrong application ID, skipping Zulip provisioning.");
		return;
	}

	const user = ctx.v1.authRequest;

	logger.log("Connecting user to Zulip");
	const response = http.fetch(
		"https://zitadel-zulip-connector.rawkodeacademy.workers.dev/api/users/provision",
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: {
				zitadelUserId: user.userId,
			},
		},
	);

	logger.log("Response body:", response.body);
	logger.log("Response status:", response.status);

	const json = response.json();

	logger.log("Response:");
	logger.log(JSON.stringify(json));

	// if (response.status === 200) {
	// 	api.v1.user.appendMetadata("zulipProvisioned", "true");

	// 	// Ensure zulipUserId is properly handled
	// 	if (json.zulipUserId !== undefined && json.zulipUserId !== null) {
	// 		// Convert to string safely, handling both primitive values and objects
	// 		const zulipUserIdStr = typeof json.zulipUserId === 'object'
	// 			? JSON.stringify(json.zulipUserId)
	// 			: String(json.zulipUserId);
	// 		api.v1.user.appendMetadata("zulipUserId", zulipUserIdStr);
	// 	} else {
	// 		logger.log("Warning: zulipUserId not found in response");
	// 	}
	// } else {
	// 	logger.log("Error: HTTP request failed with status", response.status);
	// }
}
