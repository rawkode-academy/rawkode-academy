import {
	endpoint,
	workflow,
	type WorkflowContext,
	type WorkflowSharedContext,
} from "@restatedev/restate-sdk/fetch";
import type { UserCreatedEventResponse } from "@workos-inc/node";
import { Resend } from "resend";

export const RestateUserRegisteredWorkflow = workflow({
	name: "user.registered",
	handlers: {
		run: async (ctx: WorkflowContext, payload: UserCreatedEventResponse) => {
			ctx.set("phase", "Waiting for Email Verification");
			await ctx.promise<string>("user.verifiedEmail");

			ctx.set("phase", "Sending Welcome Email");

			const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

			await ctx.run(async () => {
				const { error } = await resend.emails.send({
					from: "Rawkode Academy <hello@rawkode.academy>",
					to: [payload.data.email],
					subject: "Welcome to the Rawkode Academy",
					text: `Hi ${payload.data.first_name || "there!"
						},\n\nWelcome to the Rawkode Academy!\n\nWe'll never send you marketing emails, but we will send you important updates about your account.\n\nIf you have any questions, please reply to this email.\n\nThanks,\n\nThe Rawkode Academy Team`,
				});

				if (error) {
					throw new Error("Failed to send email");
				}
			});
			ctx.console.log(`User ${payload.data.id} registered`);
		},

		verifiedEmail: (ctx: WorkflowSharedContext) =>
			ctx.promise<string>("user.verifiedEmail").resolve(),
	},
});


const handler = endpoint().bind(RestateUserRegisteredWorkflow).withIdentityV1(
	Deno.env.get("RESTATE_IDENTITY_KEY") || "",
).bidirectional().handler();

Deno.serve({ port: 9080 }, handler.fetch);
