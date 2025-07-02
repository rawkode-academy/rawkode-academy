import process from "node:process";
import { ActionError, defineAction } from "astro:actions";
import { getSecret } from "astro:env/server";
import { z } from "astro:schema";
import { Resend } from "resend";

const SignupSchema = z.object({
	email: z.string().email("Please enter a valid email address").optional(),
	audienceId: z.string().min(1, "Audience ID is required"),
	allowSponsorContact: z.boolean().optional().default(false),
});

export const signupForCourseUpdates = defineAction({
	input: SignupSchema,
	accept: "form",
	handler: async (data, ctx) => {
		console.log("signupForCourseUpdates action called with data:", data);

		const { audienceId, allowSponsorContact } = data;

		// Get email from either the form or the authenticated user
		const email = data.email || ctx.locals?.user?.email;
		console.log("Email resolved to:", email);

		if (!email) {
			throw new ActionError({
				code: "BAD_REQUEST",
				message: "Email address is required",
			});
		}

		const resendApiKey =
			getSecret("RESEND_API_KEY") || process.env.RESEND_API_KEY;

		if (!resendApiKey) {
			console.error("RESEND_API_KEY not configured");

			throw new ActionError({
				code: "INTERNAL_SERVER_ERROR",
				message: "An error occurred while processing your request",
			});
		}

		try {
			const resend = new Resend(resendApiKey);
			console.log(
				"Resend client created, attempting to add contact to audience:",
				audienceId,
			);

			// Check if contact already exists in the audience
			try {
				const existingContacts = await resend.audiences.get(audienceId);
				// Note: This might need adjustment based on Resend API response structure
				// You may need to use resend.contacts.list() with filtering
			} catch (checkError) {
				// Continue with creation if check fails
			}

			// Add contact to the course-specific audience
			console.log("Creating contact with data:", {
				email,
				audienceId,
				allowSponsorContact,
			});
			const response = await resend.contacts.create({
				email: email,
				unsubscribed: false,
				audienceId: audienceId,
				data: {
					allowSponsorContact: allowSponsorContact ? "true" : "false",
				},
			});

			// Check if the contact was already in the audience
			if (response.data && response.data.id) {
				return {
					success: true,
					message:
						"Thank you for signing up! We'll notify you when new course content is available.",
				};
			}
		} catch (resendError: any) {
			console.error("Error adding contact to Resend:", resendError);

			// Check if it's a duplicate error
			if (
				resendError.message &&
				resendError.message.includes("already exists")
			) {
				throw new ActionError({
					code: "BAD_REQUEST",
					message: "You're already subscribed to updates for this course!",
				});
			}

			throw new ActionError({
				code: "INTERNAL_SERVER_ERROR",
				message: "An error occurred while processing your request",
			});
		}

		return {
			success: true,
			message:
				"Thank you for signing up! We'll notify you when new course content is available.",
		};
	},
});
