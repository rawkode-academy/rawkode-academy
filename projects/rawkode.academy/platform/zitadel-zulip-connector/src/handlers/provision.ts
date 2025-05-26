import type { Context } from "hono";
import { type Env, ProvisionUserSchema, type UserMapping } from "../types";
import type { ZulipClient } from "../zulip";
import type { ZitadelClient } from "../zitadel";

type Variables = {
	zulipClient: ZulipClient;
	zitadelClient: ZitadelClient;
};

export async function provisionUser(
	c: Context<{ Bindings: Env; Variables: Variables }>,
) {
	const zulip = c.get("zulipClient") as ZulipClient;
	const zitadel = c.get("zitadelClient") as ZitadelClient;

	try {
		const body = await c.req.json();
		const request = ProvisionUserSchema.parse(body);

		const existingMapping = await c.env.USER_MAPPINGS.get(
			`user:${request.zitadelUserId}`,
		);

		if (existingMapping) {
			const mapping: UserMapping = JSON.parse(existingMapping);
			return c.json({
				status: "already_exists",
				zulipUserId: mapping.zulipUserId,
				email: mapping.email,
			});
		}

		// Fetch user details from Zitadel
		const zitadelUser = await zitadel.getUserById(request.zitadelUserId);

		if (!zitadelUser) {
			throw new Error(`User not found in Zitadel: ${request.zitadelUserId}`);
		}

		if (!zitadelUser.email) {
			throw new Error("User email not found in Zitadel");
		}

		let zulipUser = await zulip.getUserByEmail(zitadelUser.email);

		if (!zulipUser) {
			const fullName =
				zitadelUser.displayName ||
				`${zitadelUser.givenName || ""} ${zitadelUser.familyName || ""}`.trim() ||
				zitadelUser.userName;

			const createResult = await zulip.createUser({
				email: zitadelUser.email,
				full_name: fullName,
			});

			if (!createResult.success) {
				throw new Error(`Failed to create user: ${createResult.error}`);
			}

			zulipUser = await zulip.getUserByEmail(zitadelUser.email);

			if (!zulipUser) {
				throw new Error("Failed to retrieve created user");
			}

			await sendWelcomeMessage(zulip, zitadelUser.email);
		}

		if (!zulipUser) {
			throw new Error("User not found");
		}

		const mapping: UserMapping = {
			zitadelUserId: request.zitadelUserId,
			zulipUserId: zulipUser.user_id,
			email: zitadelUser.email,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		};

		await c.env.USER_MAPPINGS.put(
			`user:${request.zitadelUserId}`,
			JSON.stringify(mapping),
		);

		await c.env.USER_MAPPINGS.put(
			`email:${zitadelUser.email}`,
			request.zitadelUserId,
		);

		return c.json({
			status: "success",
			zulipUserId: zulipUser.user_id,
			email: zitadelUser.email,
			created: !existingMapping,
		});
	} catch (error) {
		console.error("Provisioning error:", error);

		if (error instanceof Error) {
			return c.json(
				{
					status: "error",
					error: error.message,
				},
				400,
			);
		}

		return c.json(
			{
				status: "error",
				error: "Internal server error",
			},
			500,
		);
	}
}

function generateSecurePassword(): string {
	// Generate a secure random password
	// Users will use SSO, so this is just a placeholder
	const array = new Uint8Array(32);
	crypto.getRandomValues(array);
	return btoa(String.fromCharCode(...array));
}

async function sendWelcomeMessage(zulip: ZulipClient, email: string) {
	await zulip.sendPrivateMessage(
		email,
		`Welcome to Rawkode Academy's Zulip! 🎉

Your account has been automatically created through our SSO system.

Here are some helpful tips:
- Check out #general for community discussions
- Visit your [account settings](${zulip.site}/#settings) to customize your experience

If you have any questions, feel free to ask in #help!`,
	);
}
