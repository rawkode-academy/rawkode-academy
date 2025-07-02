import type { APIRoute } from "astro";
import { getSecret } from "astro:env/server";
import { Resend } from "resend";
import process from "node:process";

export const POST: APIRoute = async ({ request }) => {
	try {
		const formData = await request.formData();
		const email = formData.get("email") as string;
		const audienceId = formData.get("audienceId") as string;
		// const allowSponsorContact = formData.get("allowSponsorContact") === "true";

		if (!email || !audienceId) {
			return new Response(
				JSON.stringify({ error: "Email and audience ID are required" }),
				{
					status: 400,
					headers: { "Content-Type": "application/json" },
				}
			);
		}

		const resendApiKey =
			getSecret("RESEND_API_KEY") || process.env.RESEND_API_KEY;

		if (!resendApiKey) {
			return new Response(
				JSON.stringify({ error: "Service configuration error" }),
				{
					status: 500,
					headers: { "Content-Type": "application/json" },
				}
			);
		}

		const resend = new Resend(resendApiKey);

		// Check if contact already exists
		try {
			const contact = await resend.contacts.get({
				email: email,
				audienceId: audienceId,
			});
			if (contact.data) {
				return new Response(
					JSON.stringify({ error: "You're already subscribed to updates for this course!" }),
					{
						status: 400,
						headers: { "Content-Type": "application/json" },
					}
				);
			}
		} catch (checkError: any) {
			// Continue with creation if contact doesn't exist
		}

		// Add contact to the course-specific audience
		await resend.contacts.create({
			email: email,
			unsubscribed: false,
			audienceId: audienceId,
		});

		return new Response(
			JSON.stringify({
				success: true,
				message: "Thank you for signing up! We'll notify you when new course content is available.",
			}),
			{
				status: 200,
				headers: { "Content-Type": "application/json" },
			}
		);
	} catch (error: any) {
		if (error.message && error.message.includes("already exists")) {
			return new Response(
				JSON.stringify({ error: "You're already subscribed to updates for this course!" }),
				{
					status: 400,
					headers: { "Content-Type": "application/json" },
				}
			);
		}

		return new Response(
			JSON.stringify({ error: "An error occurred while processing your request" }),
			{
				status: 500,
				headers: { "Content-Type": "application/json" },
			}
		);
	}
};