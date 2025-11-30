import { defineAction } from "astro:actions";
import { z } from "astro:schema";

export const email = {
	sendTest: defineAction({
		// No client-provided input; uses logged-in user context.
		input: z.object({}),
		handler: async (_input, context) => {
			const user = context.locals.user;

			if (!user?.email) {
				throw new Error("Unauthorized");
			}

			const result = await context.locals.runtime.env.EMAIL_SERVICE.sendServiceEmail(
				{
					recipient: {
						email: user.email,
						name: user.name ?? undefined,
						userId: user.id,
					},
					content: {
						subject: "Rawkode Academy - Test Email",
						htmlBody:
							"<h1>It works!</h1><p>This is a test email from Rawkode Academy.</p><p>If you see this, your email setup is healthy.</p>",
						textBody:
							"It works!\nThis is a test email from Rawkode Academy.\nIf you see this, your email setup is healthy.",
					},
				},
			);

			if (!result.success) {
				throw new Error(result.error ?? "Failed to send test email");
			}

			return {
				success: true,
				messageId: result.messageId,
			};
		},
	}),
};
